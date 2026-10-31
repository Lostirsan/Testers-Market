"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import type { ActionState } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => Number.parseInt(str(f, k), 10);
const url = (v: string) => (v === "" ? null : v);

async function origin() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

// ---------------------------------------------------------------- auth

export async function signInWithProvider(formData: FormData) {
  const provider = str(formData, "provider") as "discord" | "github" | "google";
  const next = str(formData, "next") || "/dashboard";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent(error?.message ?? "oauth")}`);
  redirect(data.url);
}

export async function signInWithEmail(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = str(formData, "email");
  const captchaToken = str(formData, "cf-turnstile-response") || undefined;
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=/dashboard`, captchaToken },
  });
  if (error) return { error: error.message };
  return { ok: "Check your inbox for a sign-in link." };
}

// ---------------------------------------------------------------- profile

export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: friendlyError("not_authenticated") };
  const itch = str(formData, "itch_url");
  const steam = str(formData, "steam_url");
  for (const link of [itch, steam]) {
    if (link && !link.startsWith("https://")) return { error: "Links must start with https://" };
  }
  const { error } = await supabase
    .from("profiles")
    .update({
      username: str(formData, "username"),
      display_name: url(str(formData, "display_name")),
      bio: url(str(formData, "bio")),
      itch_url: url(itch),
      steam_url: url(steam),
    })
    .eq("id", auth.user.id);
  if (error) {
    if (error.code === "23505") return { error: "That username is taken." };
    if (error.code === "23514") return { error: "Username: 3–24 letters, digits or underscores." };
    return { error: friendlyError(error.message) };
  }
  revalidatePath("/", "layout");
  return { ok: "Profile saved." };
}

// ---------------------------------------------------------------- media

async function uploadImage(file: File, userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  if (!file || file.size === 0) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error("Each image must be under 5 MB.");
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error("Images must be PNG, JPG, WebP or GIF.");
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

// ---------------------------------------------------------------- games

export async function saveGame(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: friendlyError("not_authenticated") };
  const id = str(formData, "id");
  const buildUrl = str(formData, "build_url");
  if (!buildUrl.startsWith("https://")) return { error: "The build link must start with https://" };
  let cover: string | null = null;
  try {
    cover = await uploadImage(formData.get("cover") as File, auth.user.id, supabase);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const row = {
    title: str(formData, "title"),
    description: str(formData, "description"),
    genre: str(formData, "genre"),
    platforms: formData.getAll("platforms").map(String),
    build_url: buildUrl,
    ...(cover ? { cover_url: cover } : {}),
  };
  if (row.title.length < 2) return { error: "Add a title." };
  if (row.description.length < 20) return { error: "Description needs at least 20 characters." };
  if (row.genre.length < 2) return { error: "Add a genre." };

  let gameId = id;
  if (id) {
    const { error } = await supabase.from("games").update(row).eq("id", id);
    if (error) return { error: friendlyError(error.message) };
  } else {
    const { data, error } = await supabase
      .from("games")
      .insert({ ...row, owner_id: auth.user.id })
      .select("id")
      .single();
    if (error) return { error: friendlyError(error.message) };
    gameId = data.id;
  }
  revalidatePath("/my-games");
  redirect(`/my-games/${gameId}`);
}

// ---------------------------------------------------------------- campaigns

export async function createCampaign(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const gameId = str(formData, "game_id");
  const { error } = await supabase.rpc("create_campaign", {
    p_game: gameId,
    p_instructions: str(formData, "instructions"),
    p_min_minutes: int(formData, "min_minutes"),
    p_reward: int(formData, "reward"),
    p_slots: int(formData, "slots"),
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath(`/my-games/${gameId}`);
  revalidatePath("/games");
  return { ok: "Your game is listed for testing." };
}

export async function closeCampaign(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_campaign", { p_id: str(formData, "campaign_id") });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: "Campaign closed. Unused points were returned to you." };
}

// ---------------------------------------------------------------- testing

export async function takeSlot(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("take_slot", { p_campaign: str(formData, "campaign_id") });
  if (error) return { error: friendlyError(error.message) };
  redirect(`/tests/${data}`);
}

export async function abandonSlot(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("abandon_slot", { p_assignment: str(formData, "assignment_id") });
  if (error) return { error: friendlyError(error.message) };
  redirect("/dashboard");
}

export async function submitReport(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: friendlyError("not_authenticated") };
  const id = str(formData, "assignment_id");
  const body = str(formData, "body");
  if (body.length < 150) return { error: `Your report is too short (${body.length}/150 characters).` };
  const files = formData.getAll("screenshots").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: friendlyError("screenshot_required") };
  if (files.length > 5) return { error: "Attach at most 5 screenshots." };
  let media: string[];
  try {
    media = (await Promise.all(files.map((f) => uploadImage(f, auth.user.id, supabase)))).filter(
      (u): u is string => !!u,
    );
  } catch (e) {
    return { error: (e as Error).message };
  }
  const { error } = await supabase.rpc("submit_report", {
    p_assignment: id,
    p_body: body,
    p_bugs: url(str(formData, "bugs")),
    p_rating: int(formData, "rating"),
    p_media: media,
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath(`/tests/${id}`);
  return { ok: "Report sent. The developer has 72 hours to review it." };
}

export async function acceptReport(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_report", {
    p_assignment: str(formData, "assignment_id"),
    p_score: int(formData, "score"),
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: "Accepted. The tester got their points." };
}

export async function rejectReport(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_report", {
    p_assignment: str(formData, "assignment_id"),
    p_reason: str(formData, "reason"),
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: "Rejected. The tester can dispute this within 72 hours." };
}

export async function openDispute(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const id = str(formData, "assignment_id");
  const { error } = await supabase.rpc("open_dispute", { p_assignment: id, p_comment: str(formData, "comment") });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath(`/tests/${id}`);
  return { ok: "Dispute opened. A moderator will review it." };
}

// ---------------------------------------------------------------- tasks

export async function claimStarterTask(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_starter_task", { p_code: str(formData, "code") });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: `+${data} points` };
}

export async function submitTask(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_task", {
    p_task: str(formData, "task_id"),
    p_proof: str(formData, "proof"),
  });
  if (error) {
    if (error.code === "23505") return { error: "You already submitted this task." };
    return { error: friendlyError(error.message) };
  }
  revalidatePath("/tasks");
  return { ok: "Submitted for review." };
}

export async function reportAbuse(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: friendlyError("not_authenticated") };
  const { error } = await supabase.from("reports_abuse").insert({
    reporter_id: auth.user.id,
    target_type: str(formData, "target_type"),
    target_id: str(formData, "target_id"),
    reason: str(formData, "reason"),
  });
  if (error) return { error: "Please describe the problem (at least 5 characters)." };
  return { ok: "Thanks, a moderator will take a look." };
}

// ---------------------------------------------------------------- staff

export async function resolveDispute(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_dispute", {
    p_dispute: str(formData, "dispute_id"),
    p_tester_won: str(formData, "tester_won") === "true",
    p_note: str(formData, "note"),
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/admin");
  return { ok: "Resolved." };
}

export async function reviewTask(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_task", {
    p_completion: str(formData, "completion_id"),
    p_approve: str(formData, "approve") === "true",
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/admin");
  return { ok: "Done." };
}

export async function setBan(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_ban", {
    p_user: str(formData, "user_id"),
    p_banned: str(formData, "banned") === "true",
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/admin");
  return { ok: "Updated." };
}
