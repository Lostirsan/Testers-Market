import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { submitReport, abandonSlot, openDispute } from "../../actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, Field, Points, StatusBadge, inputClass, timeLeft } from "@/components/ui";
import type { Assignment, Campaign, Game, Report } from "@/lib/types";

type Row = Assignment & { test_campaigns: Campaign & { games: Game }; test_reports: Report | null };

export default async function TestPage({ params }: PageProps<"/tests/[id]">) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  const { data: a } = await supabase
    .from("test_assignments").select("*, test_campaigns(*, games(*)), test_reports(*)")
    .eq("id", id).eq("tester_id", profile.id).single<Row>();
  if (!a) notFound();
  const c = a.test_campaigns;
  const g = c.games;
  const canDispute = a.status === "rejected" && a.dispute_deadline_at && new Date(a.dispute_deadline_at) > new Date();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Testing {g.title}</h1>
          <StatusBadge status={a.status} />
        </div>

        {a.status === "taken" && (
          <Card>
            <h2 className="mb-1 font-semibold">Your report</h2>
            <p className="mb-4 text-sm text-zinc-600">Deadline: {timeLeft(a.deadline_at)}. Be specific and honest.</p>
            <ActionForm action={submitReport} className="space-y-4">
              <input type="hidden" name="assignment_id" value={a.id} />
              <Field label="What did you play and how did it feel?" hint="At least 150 characters.">
                <textarea name="body" required minLength={150} rows={8} className={inputClass}
                  placeholder="I played levels 1–3 for 20 minutes. The movement felt… The difficulty spike at… I'd love to see…" />
              </Field>
              <Field label="Bugs (optional)" hint="Steps to reproduce help a lot.">
                <textarea name="bugs" rows={4} className={inputClass} />
              </Field>
              <Field label="Your rating of the game">
                <select name="rating" defaultValue="4" className={inputClass}>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}
                </select>
              </Field>
              <Field label="Screenshots" hint="1 to 5 images, up to 5 MB each.">
                <input name="screenshots" type="file" multiple required accept="image/png,image/jpeg,image/webp,image/gif" className="text-sm" />
              </Field>
              <SubmitButton>Submit report</SubmitButton>
            </ActionForm>
            <ActionForm action={abandonSlot} className="mt-4 border-t pt-4">
              <input type="hidden" name="assignment_id" value={a.id} />
              <SubmitButton variant="secondary">Give up this slot</SubmitButton>
            </ActionForm>
          </Card>
        )}

        {a.test_reports && (
          <Card>
            <h2 className="mb-2 font-semibold">Your report</h2>
            <p className="whitespace-pre-line text-sm">{a.test_reports.body}</p>
            {a.status === "submitted" && (
              <p className="mt-3 text-sm text-amber-700">
                Waiting for the developer. Auto-accepted in {timeLeft(a.review_deadline_at)}.
              </p>
            )}
            {a.status === "accepted" && (
              <p className="mt-3 text-sm text-emerald-700">Accepted! You earned <Points value={c.reward} />.</p>
            )}
            {a.test_reports.reject_reason && (
              <p className="mt-3 text-sm text-red-700">Developer&apos;s reason: {a.test_reports.reject_reason}</p>
            )}
          </Card>
        )}

        {canDispute && (
          <Card>
            <h2 className="mb-1 font-semibold">Disagree?</h2>
            <p className="mb-3 text-sm text-zinc-600">
              Open a dispute within {timeLeft(a.dispute_deadline_at)}. A moderator will compare your report with the
              instructions.
            </p>
            <ActionForm action={openDispute} className="space-y-2">
              <input type="hidden" name="assignment_id" value={a.id} />
              <textarea name="comment" required minLength={10} rows={3} className={inputClass} />
              <SubmitButton variant="secondary">Open dispute</SubmitButton>
            </ActionForm>
          </Card>
        )}
        {a.status === "disputed" && <Card><p className="text-sm">A moderator is reviewing your dispute.</p></Card>}
      </div>

      <Card className="h-fit">
        <p className="text-sm text-zinc-500">Reward</p>
        <Points value={c.reward} className="text-2xl" />
        <p className="mt-3 text-sm text-zinc-500">Play at least {c.min_minutes} minutes</p>
        <h3 className="mt-4 text-sm font-medium">Instructions</h3>
        <p className="whitespace-pre-line text-sm text-zinc-700">{c.instructions}</p>
        <a href={g.build_url} target="_blank" rel="noreferrer noopener"
          className="mt-4 block rounded-lg bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white">
          Open the game build ↗
        </a>
        <Link href={`/games/${g.id}`} className="mt-2 block text-center text-sm text-violet-700">Game page</Link>
      </Card>
    </div>
  );
}
