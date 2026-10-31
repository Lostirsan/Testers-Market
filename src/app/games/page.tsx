import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageTitle, Points } from "@/components/ui";
import type { Campaign, Game } from "@/lib/types";

export const metadata = { title: "Find games to test" };

type Row = Campaign & { games: Game };

export default async function GamesPage({ searchParams }: PageProps<"/games">) {
  const sp = await searchParams;
  const genre = typeof sp.genre === "string" ? sp.genre : "";
  const sort = sp.sort === "reward" ? "reward" : "created_at";
  const supabase = await createClient();
  const { data } = await supabase
    .from("test_campaigns")
    .select("*, games(*)")
    .eq("status", "active")
    .order(sort, { ascending: false })
    .limit(60)
    .returns<Row[]>();
  const rows = (data ?? []).filter((r) => !genre || r.games.genre.toLowerCase() === genre.toLowerCase());
  const { data: slots } = await supabase
    .from("campaign_slots").select("campaign_id, occupied").in("campaign_id", rows.map((r) => r.id));
  const occupied = new Map((slots ?? []).map((s) => [s.campaign_id as string, s.occupied as number]));
  const genres = [...new Set((data ?? []).map((r) => r.games.genre))].sort();

  return (
    <div>
      <PageTitle sub="Play a game for the time asked, send a report, earn the reward.">Games looking for testers</PageTitle>
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/games" className={`rounded-full px-3 py-1 ${!genre ? "bg-violet-600 text-white" : "bg-white border"}`}>All</Link>
        {genres.map((g) => (
          <Link key={g} href={`/games?genre=${encodeURIComponent(g)}`}
            className={`rounded-full px-3 py-1 ${genre === g ? "bg-violet-600 text-white" : "bg-white border"}`}>{g}</Link>
        ))}
        <span className="flex-1" />
        <Link href={`/games?sort=reward${genre ? `&genre=${genre}` : ""}`} className="text-violet-700">Highest reward</Link>
        <Link href={`/games${genre ? `?genre=${genre}` : ""}`} className="text-violet-700">Newest</Link>
      </div>
      {rows.length === 0 ? (
        <Empty>No games are looking for testers right now. List yours and be the first!</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => {
            const free = Math.max(c.slots - (occupied.get(c.id) ?? 0), 0);
            return (
              <Link key={c.id} href={`/games/${c.game_id}`}
                className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md">
                <div className="aspect-video bg-gradient-to-br from-violet-200 to-sky-100">
                  {c.games.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.games.cover_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold group-hover:text-violet-700">{c.games.title}</h3>
                    <Points value={c.reward} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {c.games.genre} · {c.min_minutes} min · {c.games.platforms.join(", ") || "Any platform"}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-600">{c.games.description}</p>
                  <p className="mt-3 text-xs font-medium text-zinc-700">
                    {free > 0 ? `${free} of ${c.slots} slots free` : "All slots taken"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
