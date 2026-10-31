import { requireProfile, getWallet } from "@/lib/auth";
import { Card, Empty, PageTitle, fmtDate } from "@/components/ui";
import type { LedgerEntry } from "@/lib/types";

export const metadata = { title: "Wallet" };

const KIND: Record<string, string> = {
  task_reward: "Task reward",
  test_reward: "Test accepted",
  escrow_hold: "Held for your campaign",
  escrow_refund: "Campaign refund",
  purchase: "Purchase",
  admin: "Adjustment",
};

export default async function WalletPage() {
  const { supabase, profile } = await requireProfile();
  const wallet = await getWallet();
  const { data: entries } = await supabase
    .from("ledger_entries").select("*").eq("user_id", profile.id)
    .order("created_at", { ascending: false }).limit(100).returns<LedgerEntry[]>();
  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle>Wallet</PageTitle>
      <Card>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><p className="text-sm text-zinc-500">Balance</p><p className="text-2xl font-semibold">{wallet?.balance ?? 0}</p></div>
          <div><p className="text-sm text-zinc-500">Locked</p><p className="text-2xl font-semibold">{wallet?.locked ?? 0}</p></div>
          <div><p className="text-sm text-zinc-500">Spendable</p><p className="text-2xl font-semibold text-violet-700">{wallet?.spendable ?? 0}</p></div>
        </div>
      </Card>
      {!entries?.length ? (
        <Empty>No transactions yet.</Empty>
      ) : (
        <ul className="divide-y rounded-xl border border-zinc-200 bg-white text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between p-3">
              <div>
                <p>{KIND[e.kind] ?? e.kind}{e.note && <span className="text-zinc-500"> · {e.note}</span>}</p>
                <p className="text-xs text-zinc-500">{fmtDate(e.created_at)}</p>
              </div>
              <span className={`font-semibold ${e.amount > 0 ? "text-emerald-700" : "text-zinc-700"}`}>
                {e.amount > 0 ? "+" : ""}{e.amount}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
