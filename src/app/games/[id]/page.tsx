import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { takeSlot, reportAbuse } from "../../actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, Points, inputClass } from "@/components/ui";
import type { Campaign, Game, Profile } from "@/lib/types";

export default async function GamePage({ params }: PageProps<"/games/[id]">) {
  const { id } = await params;
  const { supabase, profile } = await getSession();
  const { data: game } = await supabase
    .from("games").select("*, profiles(username, display_name)").eq("id", id)
    .single<Game & { profiles: Pick<Profile, "username" | "display_name"> }>();
  if (!game) notFound();
  const { data: campaign } = await supabase
    .from("test_campaigns").select("*").eq("game_id", id).eq("status", "active").maybeSingle<Campaign>();
  const { data: authorStats } = await supabase
    .from("author_stats").select("*").eq("user_id", game.owner_id).maybeSingle<{ reviewed: number; rejected: number }>();
  const mine = profile?.id === game.owner_id;
  const rejectRate = authorStats && authorStats.reviewed > 0
    ? Math.round((authorStats.rejected / authorStats.reviewed) * 100) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-violet-200 to-sky-100">
          {game.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.cover_url} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <h1 className="text-3xl font-bold">{game.title}</h1>
        <p className="text-sm text-zinc-500">
          by <Link href={`/u/${game.profiles.username}`} className="text-violet-700">@{game.profiles.username}</Link>
          {" · "}{game.genre}{game.platforms.length > 0 && ` · ${game.platforms.join(", ")}`}
        </p>
        <p className="whitespace-pre-line text-zinc-700">{game.description}</p>
      </div>

      <div className="space-y-4">
        {campaign ? (
          <Card>
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Test this game</h2>
              <Points value={campaign.reward} className="text-xl" />
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Play at least {campaign.min_minutes} minutes · {campaign.slots - campaign.accepted} paid slots left
            </p>
            <h3 className="mt-4 text-sm font-medium">What the developer wants</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-zinc-700">{campaign.instructions}</p>
            {rejectRate !== null && (
              <p className={`mt-3 text-xs ${rejectRate > 40 ? "text-red-600" : "text-zinc-500"}`}>
                This developer rejected {rejectRate}% of {authorStats!.reviewed} reviewed reports.
              </p>
            )}
            <div className="mt-4">
              {!profile ? (
                <Link href={`/login?next=/games/${id}`} className="block rounded-lg bg-violet-600 px-4 py-2 text-center text-sm font-medium text-white">
                  Sign in to test
                </Link>
              ) : mine ? (
                <Link href={`/my-games/${id}`} className="text-sm text-violet-700">Manage your campaign →</Link>
              ) : (
                <ActionForm action={takeSlot}>
                  <input type="hidden" name="campaign_id" value={campaign.id} />
                  <SubmitButton>Take a slot (48h to submit)</SubmitButton>
                </ActionForm>
              )}
            </div>
          </Card>
        ) : (
          <Card><p className="text-sm text-zinc-600">This game isn&apos;t looking for testers right now.</p></Card>
        )}
        {profile && !mine && (
          <details className="text-sm text-zinc-500">
            <summary className="cursor-pointer">Report a problem with this game</summary>
            <ActionForm action={reportAbuse} className="mt-2 space-y-2">
              <input type="hidden" name="target_type" value="game" />
              <input type="hidden" name="target_id" value={game.id} />
              <textarea name="reason" required minLength={5} rows={3} className={inputClass} placeholder="What's wrong?" />
              <SubmitButton variant="secondary">Send report</SubmitButton>
            </ActionForm>
          </details>
        )}
      </div>
    </div>
  );
}
