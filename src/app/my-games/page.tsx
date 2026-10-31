import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { Empty, PageTitle } from "@/components/ui";
import type { Campaign, Game } from "@/lib/types";

export const metadata = { title: "My games" };

export default async function MyGamesPage() {
  const { supabase, profile } = await requireProfile();
  const { data: games } = await supabase
    .from("games").select("*, test_campaigns(status, accepted, slots)")
    .eq("owner_id", profile.id).order("created_at", { ascending: false })
    .returns<(Game & { test_campaigns: Pick<Campaign, "status" | "accepted" | "slots">[] })[]>();
  return (
    <div>
      <div className="flex items-start justify-between">
        <PageTitle sub="Add games and list them for testing.">My games</PageTitle>
        <Link href="/my-games/new" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">Add game</Link>
      </div>
      {!games?.length ? (
        <Empty>You haven&apos;t added a game yet.</Empty>
      ) : (
        <ul className="divide-y rounded-xl border border-zinc-200 bg-white">
          {games.map((g) => {
            const active = g.test_campaigns.find((c) => c.status === "active");
            return (
              <li key={g.id}>
                <Link href={`/my-games/${g.id}`} className="flex items-center justify-between p-4 hover:bg-zinc-50">
                  <div>
                    <p className="font-medium">{g.title}</p>
                    <p className="text-xs text-zinc-500">{g.genre}</p>
                  </div>
                  <span className="text-sm text-zinc-600">
                    {active ? `Testing: ${active.accepted}/${active.slots} accepted` : "Not listed"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
