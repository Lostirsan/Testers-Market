import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { resolveDispute, reviewTask, setBan } from "../actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, Empty, PageTitle, fmtDate, inputClass } from "@/components/ui";

export const metadata = { title: "Admin" };

type DisputeRow = {
  id: string; comment: string; created_at: string;
  test_assignments: {
    tester_id: string; author_id: string;
    test_reports: { body: string; bugs: string | null; media_urls: string[]; reject_reason: string | null } | null;
    test_campaigns: { instructions: string; games: { title: string } };
  };
};

export default async function AdminPage() {
  const { supabase } = await requireStaff();
  const [{ data: disputes }, { data: pending }, { data: abuse }, { data: authors }] = await Promise.all([
    supabase.from("disputes")
      .select("id, comment, created_at, test_assignments(tester_id, author_id, test_reports(body, bugs, media_urls, reject_reason), test_campaigns(instructions, games(title)))")
      .is("resolved_at", null).order("created_at").returns<DisputeRow[]>(),
    supabase.from("task_completions").select("id, proof, created_at, tasks(title, reward), profiles(username)")
      .eq("status", "pending").order("created_at")
      .returns<{ id: string; proof: string | null; created_at: string; tasks: { title: string; reward: number }; profiles: { username: string } }[]>(),
    supabase.from("reports_abuse").select("*").eq("handled", false).order("created_at", { ascending: false }).limit(50),
    supabase.from("author_stats").select("*").gte("reviewed", 5).returns<{ user_id: string; reviewed: number; rejected: number }[]>(),
  ]);
  const flagged = (authors ?? []).filter((a) => a.rejected / a.reviewed > 0.4);

  return (
    <div className="space-y-8">
      <PageTitle>Moderation</PageTitle>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Open disputes ({disputes?.length ?? 0})</h2>
        {!disputes?.length ? <Empty>No open disputes.</Empty> : (
          <div className="space-y-4">
            {disputes.map((d) => {
              const a = d.test_assignments;
              return (
                <Card key={d.id}>
                  <p className="text-sm text-zinc-500">{a.test_campaigns.games.title} · {fmtDate(d.created_at)}</p>
                  <div className="mt-3 grid gap-4 text-sm md:grid-cols-2">
                    <div>
                      <h3 className="font-medium">Instructions</h3>
                      <p className="whitespace-pre-line text-zinc-700">{a.test_campaigns.instructions}</p>
                      <h3 className="mt-3 font-medium">Developer&apos;s reason</h3>
                      <p className="text-red-700">{a.test_reports?.reject_reason}</p>
                      <h3 className="mt-3 font-medium">Tester&apos;s dispute</h3>
                      <p>{d.comment}</p>
                    </div>
                    <div>
                      <h3 className="font-medium">Report</h3>
                      <p className="whitespace-pre-line text-zinc-700">{a.test_reports?.body}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {a.test_reports?.media_urls.map((u) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={u} alt="" className="h-20 rounded border" />
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                  <ActionForm action={resolveDispute} className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
                    <input type="hidden" name="dispute_id" value={d.id} />
                    <input name="note" required placeholder="Short note for both sides" className={`${inputClass} max-w-sm`} />
                    <SubmitButton name="tester_won" value="true">Tester is right: pay</SubmitButton>
                    <SubmitButton name="tester_won" value="false" variant="secondary">Developer is right</SubmitButton>
                  </ActionForm>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Task submissions ({pending?.length ?? 0})</h2>
        {!pending?.length ? <Empty>Nothing to review.</Empty> : (
          <ul className="divide-y rounded-xl border bg-white text-sm">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>@{p.profiles.username} · {p.tasks.title} ({p.tasks.reward} pts) · proof: {p.proof}</span>
                <span className="flex gap-2">
                  <ActionForm action={reviewTask}><input type="hidden" name="completion_id" value={p.id} />
                    <SubmitButton name="approve" value="true">Approve</SubmitButton></ActionForm>
                  <ActionForm action={reviewTask}><input type="hidden" name="completion_id" value={p.id} />
                    <SubmitButton name="approve" value="false" variant="secondary">Reject</SubmitButton></ActionForm>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Flagged developers (rejection rate over 40%)</h2>
        {!flagged.length ? <Empty>None.</Empty> : (
          <ul className="space-y-1 text-sm">
            {flagged.map((f) => (
              <li key={f.user_id}>{f.user_id}: {f.rejected}/{f.reviewed} rejected</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Abuse reports</h2>
        {!abuse?.length ? <Empty>None.</Empty> : (
          <ul className="divide-y rounded-xl border bg-white text-sm">
            {abuse.map((r) => (
              <li key={r.id} className="p-3">
                {r.target_type === "game" ? <Link href={`/games/${r.target_id}`} className="text-violet-700">game</Link> : r.target_type}
                {" "}· {r.reason}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Ban or unban a user</h2>
        <ActionForm action={setBan} className="flex flex-wrap gap-2">
          <input name="user_id" required placeholder="User id" className={`${inputClass} max-w-sm`} />
          <SubmitButton name="banned" value="true" variant="danger">Ban</SubmitButton>
          <SubmitButton name="banned" value="false" variant="secondary">Unban</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
