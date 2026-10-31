import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { claimStarterTask, submitTask } from "../actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, Empty, PageTitle, Points, inputClass } from "@/components/ui";
import type { Task } from "@/lib/types";

export const metadata = { title: "Earn points" };

const HINT: Record<string, { href: string; label: string }> = {
  read_rules: { href: "/rules", label: "Read the rules" },
  complete_profile: { href: "/profile", label: "Edit profile" },
  add_game: { href: "/my-games/new", label: "Add a game" },
  first_test: { href: "/games", label: "Find a game" },
};

export default async function TasksPage() {
  const { supabase, profile } = await requireProfile();
  const { data: tasks } = await supabase.from("tasks").select("*").eq("active", true).order("sort").returns<Task[]>();
  const { data: done } = await supabase.from("task_completions").select("task_id, status").eq("user_id", profile.id);
  const status = new Map((done ?? []).map((d) => [d.task_id as string, d.status as string]));
  const starter = (tasks ?? []).filter((t) => t.kind === "starter");
  const other = (tasks ?? []).filter((t) => t.kind !== "starter");

  return (
    <div className="space-y-8">
      <PageTitle sub="Testing games is the main way to earn. These tasks help you get started.">Earn points</PageTitle>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Starter tasks</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {starter.map((t) => (
            <Card key={t.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">{t.title}</h3>
                  <p className="text-sm text-zinc-600">{t.description}</p>
                </div>
                <Points value={t.reward} />
              </div>
              <div className="mt-3 flex items-center gap-4">
                {status.has(t.id) ? (
                  <span className="text-sm font-medium text-emerald-700">Done ✓</span>
                ) : (
                  <>
                    <ActionForm action={claimStarterTask}>
                      <input type="hidden" name="code" value={t.code ?? ""} />
                      <SubmitButton>Claim</SubmitButton>
                    </ActionForm>
                    {t.code && HINT[t.code] && (
                      <Link href={HINT[t.code].href} className="text-sm text-violet-700">{HINT[t.code].label} →</Link>
                    )}
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Partner tasks</h2>
        {other.length === 0 ? (
          <Empty>No partner tasks yet. Check back soon.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {other.map((t) => (
              <Card key={t.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{t.title}</h3>
                    {t.advertiser && <p className="text-xs text-zinc-500">by {t.advertiser}</p>}
                    <p className="mt-1 text-sm text-zinc-600">{t.description}</p>
                  </div>
                  <Points value={t.reward} />
                </div>
                {t.action_url && (
                  <a href={t.action_url} target="_blank" rel="noreferrer sponsored" className="mt-2 inline-block text-sm text-violet-700">
                    Open ↗
                  </a>
                )}
                {status.has(t.id) ? (
                  <p className="mt-3 text-sm text-zinc-600">Status: {status.get(t.id)}</p>
                ) : (
                  <ActionForm action={submitTask} className="mt-3 flex gap-2">
                    <input type="hidden" name="task_id" value={t.id} />
                    <input name="proof" required placeholder="Your username or a link as proof" className={inputClass} />
                    <SubmitButton>Submit</SubmitButton>
                  </ActionForm>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
