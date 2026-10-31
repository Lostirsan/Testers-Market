import type { ReactNode } from "react";
import type { AssignmentStatus } from "@/lib/types";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-zinc-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{children}</h1>
      {sub && <p className="mt-1 text-zinc-600">{sub}</p>}
    </div>
  );
}

export function Points({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`font-semibold text-violet-700 ${className}`}>{value} pts</span>;
}

export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

const STATUS: Record<AssignmentStatus, [string, string]> = {
  taken: ["In progress", "bg-sky-100 text-sky-800"],
  submitted: ["Awaiting review", "bg-amber-100 text-amber-800"],
  accepted: ["Accepted", "bg-emerald-100 text-emerald-800"],
  rejected: ["Rejected", "bg-red-100 text-red-800"],
  disputed: ["Disputed", "bg-orange-100 text-orange-800"],
  rejected_final: ["Rejected", "bg-red-100 text-red-800"],
  expired: ["Expired", "bg-zinc-100 text-zinc-600"],
  abandoned: ["Abandoned", "bg-zinc-100 text-zinc-600"],
};

export function StatusBadge({ status }: { status: AssignmentStatus }) {
  const [label, cls] = STATUS[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">{children}</p>;
}

export function timeLeft(iso: string | null) {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "overdue";
  const h = Math.floor(ms / 3_600_000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : `${h}h left`;
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
