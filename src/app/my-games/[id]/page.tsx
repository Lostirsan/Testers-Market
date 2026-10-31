import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile, getWallet } from "@/lib/auth";
import { createCampaign, closeCampaign } from "../../actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, Empty, Field, Points, StatusBadge, inputClass, timeLeft } from "@/components/ui";
import { CostPreview } from "./CostPreview";
import { ReviewForm } from "./ReviewForm";
import type { Assignment, Campaign, Game, Profile, Report } from "@/lib/types";

type Row = Assignment & { test_reports: Report | null; profiles: Pick<Profile, "username"> };

export default async function ManageGamePage({ params }: PageProps<"/my-games/[id]">) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  const { data: game } = await supabase.from("games").select("*").eq("id", id).eq("owner_id", profile.id).single<Game>();
  if (!game) notFound();
  const { data: campaigns } = await supabase
    .from("test_campaigns").select("*").eq("game_id", id).order("created_at", { ascending: false }).returns<Campaign[]>();
  const active = campaigns?.find((c) => c.status === "active");
  const { data: assignments } = await supabase
    .from("test_assignments")
    .select("*, test_reports(*), profiles!test_assignments_tester_id_fkey(username)")
    .in("campaign_id", (campaigns ?? []).map((c) => c.id))
    .order("taken_at", { ascending: false })
    .returns<Row[]>();
  const wallet = await getWallet();
  const toReview = (assignments ?? []).filter((a) => a.status === "submitted");
  const others = (assignments ?? []).filter((a) => a.status !== "submitted");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{game.title}</h1>
          <p className="text-sm text-zinc-500">
            <Link href={`/games/${game.id}`} className="text-violet-700">Public page</Link>
            {" · "}<Link href={`/my-games/${game.id}/edit`} className="text-violet-700">Edit</Link>
          </p>
        </div>
      </div>

      {active ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Testing in progress</h2>
              <p className="text-sm text-zinc-600">
                {active.accepted} of {active.slots} reports accepted · <Points value={active.reward} /> per test ·{" "}
                {active.min_minutes} min
              </p>
            </div>
            <ActionForm action={closeCampaign}>
              <input type="hidden" name="campaign_id" value={active.id} />
              <SubmitButton variant="secondary">Close and refund unused points</SubmitButton>
            </ActionForm>
          </div>
        </Card>
      ) : (
        <Card>
          <h2 className="font-semibold">List this game for testing</h2>
          <p className="mb-4 text-sm text-zinc-600">
            You have <Points value={wallet?.spendable ?? 0} /> to spend
            {!!wallet?.locked && ` (+${wallet.locked} locked until your first accepted test)`}.
          </p>
          <ActionForm action={createCampaign} className="space-y-4">
            <input type="hidden" name="game_id" value={game.id} />
            <Field label="What should testers do?" hint="E.g. play the first two levels, try the boss fight, tell me if the controls feel good.">
              <textarea name="instructions" required minLength={20} rows={4} className={inputClass} />
            </Field>
            <CostPreview spendable={wallet?.spendable ?? 0} />
            <SubmitButton>List for testing</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Reports to review ({toReview.length})</h2>
        {toReview.length === 0 ? (
          <Empty>No reports waiting. They&apos;ll appear here when testers submit.</Empty>
        ) : (
          <div className="space-y-4">
            {toReview.map((a) => (
              <Card key={a.id}>
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    <Link href={`/u/${a.profiles.username}`} className="text-violet-700">@{a.profiles.username}</Link>
                    {" "}rated your game {a.test_reports?.game_rating}/5
                  </p>
                  <span className="text-xs text-amber-700">Auto-accept: {timeLeft(a.review_deadline_at)}</span>
                </div>
                <ReportBody report={a.test_reports} />
                <ReviewForm assignmentId={a.id} />
              </Card>
            ))}
          </div>
        )}
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">All tests</h2>
          <ul className="divide-y rounded-xl border border-zinc-200 bg-white text-sm">
            {others.map((a) => (
              <li key={a.id} className="p-4">
                <details>
                  <summary className="flex cursor-pointer items-center justify-between">
                    <span>@{a.profiles.username}</span>
                    <StatusBadge status={a.status} />
                  </summary>
                  <ReportBody report={a.test_reports} />
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReportBody({ report }: { report: Report | null }) {
  if (!report) return <p className="mt-2 text-sm text-zinc-500">No report yet.</p>;
  return (
    <div className="mt-3 space-y-3 text-sm">
      <p className="whitespace-pre-line text-zinc-800">{report.body}</p>
      {report.bugs && (
        <div>
          <h4 className="font-medium">Bugs</h4>
          <p className="whitespace-pre-line text-zinc-700">{report.bugs}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {report.media_urls.map((u) => (
          <a key={u} href={u} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="Screenshot" className="h-24 rounded border object-cover" />
          </a>
        ))}
      </div>
      {report.reject_reason && <p className="text-red-700">Rejected: {report.reject_reason}</p>}
    </div>
  );
}
