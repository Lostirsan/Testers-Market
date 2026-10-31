import Link from "next/link";
import { getSession } from "@/lib/auth";

const STEPS = [
  ["Start at 0 points", "Finish starter tasks for your first 60 points. They unlock after your first accepted test."],
  ["Test other games", "Pick a game, play it for the time asked and write an honest report with screenshots."],
  ["Get paid in points", "When the developer accepts your report, the points are yours. No answer in 72 hours means auto-accept."],
  ["List your own game", "Set a reward and the number of testers. Points are held safely until each report is accepted."],
];

export default async function Home() {
  const { profile } = await getSession();
  return (
    <div className="space-y-16">
      <section className="pt-8 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          Real playtesters for your indie game. Paid in points, not money.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">
          Test other developers&apos; games, earn points, and spend them to get your own game tested by people who
          actually make games.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href={profile ? "/games" : "/login"}
            className="rounded-lg bg-violet-600 px-6 py-3 font-medium text-white hover:bg-violet-700"
          >
            {profile ? "Find a game to test" : "Join for free"}
          </Link>
          <Link href="/rules" className="rounded-lg border border-zinc-300 bg-white px-6 py-3 font-medium hover:bg-zinc-50">
            How it works
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(([title, text], i) => (
          <div key={title} className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 font-bold text-violet-700">
              {i + 1}
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-zinc-600">{text}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-violet-600 p-8 text-center text-white">
        <h2 className="text-2xl font-bold">Fair by design</h2>
        <p className="mx-auto mt-2 max-w-2xl text-violet-100">
          Every point movement is recorded in a ledger. Developers must explain rejections, and testers can dispute
          them with a moderator. A 10% fee on each test is burned to keep points valuable.
        </p>
      </section>
    </div>
  );
}
