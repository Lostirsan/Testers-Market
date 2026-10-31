import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile, Wallet } from "./types";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Profile | null };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  return { supabase, user, profile };
});

export async function requireProfile() {
  const s = await getSession();
  if (!s.user || !s.profile) redirect("/login");
  return { supabase: s.supabase, profile: s.profile };
}

export async function requireStaff() {
  const s = await requireProfile();
  if (s.profile.role === "user") redirect("/dashboard");
  return s;
}

export const getWallet = cache(async (): Promise<Wallet | null> => {
  const { supabase, user } = await getSession();
  if (!user) return null;
  const { data } = await supabase.rpc("wallet").single<Wallet>();
  return data ?? null;
});
