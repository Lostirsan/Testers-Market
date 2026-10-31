import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, fmtDate } from "@/components/ui";
import type { Game, Profile } from "@/lib/types";

export default async function UserPage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("*").ilike("username", username).single<Profile>();
  if (!p) notFound();
  const [{ data: ts }, { data: games }] = await Promise.all([
    supabase.from("tester_stats").select("*").eq("user_id", p.id).single<{ accepted: number; rejected: number; avg_score: number | null }>(),
    supabase.from("games").select("*").eq("owner_id", p.id).returns<Game[]>(),
  ]);
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        {p.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatar_url} alt="" className="h-16 w-16 rounded-full" />
        )}
        <div>
          <h1 className="text-2xl font-bold">{p.display_name ?? p.username}</h1>
          <p className="text-sm text-zinc-500">@{p.username} · joined {fmtDate(p.created_at)}</p>
        </div>
      </div>
      {p.bio && <p className="text-zinc-700">{p.bio}</p>}
      <div className="flex gap-4 text-sm">
        {p.itch_url && <a href={p.itch_url} className="text-violet-700" rel="noreferrer nofollow">itch.io ↗</a>}
        {p.steam_url && <a href={p.steam_url} className="text-violet-700" rel="noreferrer nofollow">Steam ↗</a>}
      </div>
      <Card>
        <h2 className="mb-2 font-semibold">As a tester</h2>
        <p className="text-sm text-zinc-700">
          {ts?.accepted ?? 0} accepted reports · {ts?.rejected ?? 0} rejected
          {ts?.avg_score != null && ` · rated ${ts.avg_score}/5 by developers`}
        </p>
      </Card>
      {!!games?.length && (
        <section>
          <h2 className="mb-2 font-semibold">Games</h2>
          <ul className="space-y-1">
            {games.map((g) => (
              <li key={g.id}><Link href={`/games/${g.id}`} className="text-violet-700">{g.title}</Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
