import Link from "next/link";
import { requireProfile, getWallet } from "@/lib/auth";
import { Card, Empty, PageTitle, Points, StatusBadge, timeLeft } from "@/components/ui";
import type { Assignment, Campaign, Game } from "@/lib/types";

export const metadata = { title: "Dashboard" };

type Row = Assignment & { test_campaigns: Pick<Campaign, "reward"> & { games: Pick<Game, "title"> } };

export default async function Dashboard() {
  const { supabase, profile } = await requireProfile();
  const wallet = await getWallet();
  const { data: mine } = await supabase
    .from("test_assignments").select("*, test_campaigns(reward, games(title))")
    .eq("tester_id", profile.id).order("taken_at", { ascending: false }).limit(20).returns<Row[]>();
  const { count: toReview } = await supabase
    .from("test_assignments").select("id", { count: "exact", head: true })
    .eq("author_id", profile.id).eq("status", "submitted");

  return (
    <div className="space-y-6">
      <PageTitle>Hi, {profile.display_name ?? profile.username}</PageTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-zinc-500">Spendable</p>
          <Points value={wallet?.spendable ?? 0} className="text-2xl" />
          {!!wallet?.locked && (
            <p className="mt-1 text-xs text-zinc-500">+{wallet.locked} starter points unlock after your first accepted test</p>
          )}
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">Held in your campaigns</p>
          <Points value={wallet?.held ?? 0} className="text-2xl" />
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">Reports waiting for you</p>
          <p className="text-2xl font-semibold">{toReview ?? 0}</p>
          {!!toReview && <Link href="/my-games" className="text-sm text-violet-700">Review now →</Link>}
        </Card>
      </div>

      {!profile.starter_unlocked && (
        <Card className="border-violet-200 bg-violet-50">
          <p className="text-sm">
            New here? <Link href="/tasks" className="font-medium text-violet-700">Do the starter tasks</Link> for up to
            60 points, then <Link href="/games" className="font-medium text-violet-700">test your first game</Link>.
          </p>
        </Card>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your tests</h2>
          <Link href="/games" className="text-sm text-violet-700">Find more games →</Link>
        </div>
        {!mine?.length ? (
          <Empty>You haven&apos;t tested any games yet.</Empty>
        ) : (
          <ul className="divide-y rounded-xl border border-zinc-200 bg-white">
            {mine.map((a) => (
              <li key={a.id}>
                <Link href={`/tests/${a.id}`} className="flex items-center justify-between p-4 text-sm hover:bg-zinc-50">
                  <span className="font-medium">{a.test_campaigns.games.title}</span>
                  <span className="flex items-center gap-3">
                    {a.status === "taken" && <span className="text-xs text-zinc-500">{timeLeft(a.deadline_at)}</span>}
                    <Points value={a.test_campaigns.reward} />
                    <StatusBadge status={a.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
