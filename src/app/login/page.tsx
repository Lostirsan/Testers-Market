import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { signInWithProvider, signInWithEmail } from "../actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, inputClass } from "@/components/ui";
import { Turnstile } from "./Turnstile";

export const metadata = { title: "Sign in" };

const PROVIDERS = [
  ["discord", "Continue with Discord"],
  ["github", "Continue with GitHub"],
  ["google", "Continue with Google"],
] as const;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/dashboard";
  const { user } = await getSession();
  if (user) redirect(next);
  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <h1 className="text-xl font-bold">Sign in to Testers Market</h1>
        <p className="mt-1 text-sm text-zinc-600">New here? Signing in creates your account.</p>
        {typeof sp.error === "string" && <p className="mt-3 text-sm text-red-600">Sign-in failed: {sp.error}</p>}
        <div className="mt-5 space-y-2">
          {PROVIDERS.map(([id, label]) => (
            <form key={id} action={signInWithProvider}>
              <input type="hidden" name="provider" value={id} />
              <input type="hidden" name="next" value={next} />
              <button className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50">
                {label}
              </button>
            </form>
          ))}
        </div>
        <div className="my-5 flex items-center gap-3 text-xs text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200" /> or <span className="h-px flex-1 bg-zinc-200" />
        </div>
        <ActionForm action={signInWithEmail} className="space-y-3">
          <input name="email" type="email" required placeholder="you@studio.com" className={inputClass} />
          <Turnstile />
          <SubmitButton>Email me a sign-in link</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
