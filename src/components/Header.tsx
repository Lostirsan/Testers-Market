import Link from "next/link";
import { getSession, getWallet } from "@/lib/auth";

export async function Header() {
  const { profile } = await getSession();
  const wallet = profile ? await getWallet() : null;
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-zinc-900">
          Testers<span className="text-violet-600">Market</span>
        </Link>
        <nav className="flex flex-1 items-center gap-4 text-sm text-zinc-700">
          <Link href="/games" className="hover:text-violet-700">Find games to test</Link>
          {profile && (
            <>
              <Link href="/dashboard" className="hover:text-violet-700">Dashboard</Link>
              <Link href="/my-games" className="hover:text-violet-700">My games</Link>
              <Link href="/tasks" className="hover:text-violet-700">Earn points</Link>
              {profile.role !== "user" && <Link href="/admin" className="hover:text-violet-700">Admin</Link>}
            </>
          )}
        </nav>
        {profile ? (
          <div className="flex items-center gap-4 text-sm">
            <Link href="/wallet" className="rounded-full bg-violet-50 px-3 py-1 font-semibold text-violet-700">
              {wallet?.spendable ?? 0} pts
              {!!wallet?.locked && <span className="ml-1 font-normal text-violet-500">(+{wallet.locked} locked)</span>}
            </Link>
            <Link href="/profile" className="text-zinc-700 hover:text-violet-700">@{profile.username}</Link>
            <form action="/auth/signout" method="post">
              <button className="text-zinc-500 hover:text-zinc-800">Sign out</button>
            </form>
          </div>
        ) : (
          <Link href="/login" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
