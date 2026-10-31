import { PageTitle } from "@/components/ui";

export const metadata = { title: "Rules" };

const RULES: [string, string[]][] = [
  ["Points", [
    "Everyone starts at 0 points. Starter tasks give up to 60 points.",
    "Starter points unlock after your first test of someone else's game is accepted.",
    "Points can't be exchanged for money.",
  ]],
  ["Listing your game", [
    "Set a reward per test: at least 1 point per minute you ask testers to play, minimum 10, maximum 200.",
    "The reward for every slot plus a 10% platform fee is held when you list. The fee is burned, not kept by anyone.",
    "Close a campaign at any time to get unused points back.",
    "Add up to 3 control questions about your game. Testers must answer them correctly to submit a report.",
  ]],
  ["Testing", [
    "You can have up to 3 tests in progress. Each must be submitted within 48 hours.",
    "A report needs at least 150 characters and one screenshot. Be specific: what you did, what broke, what felt good.",
    "If the developer added control questions, you get 2 attempts to answer them all correctly. After that the slot is lost.",
    "You can't test your own games, and you can test the same developer at most 3 times in 30 days.",
  ]],
  ["Reviews and disputes", [
    "Developers have 72 hours to review a report. Silence means the report is accepted automatically.",
    "A rejection must include a reason. The tester can dispute it within 72 hours, and a moderator decides.",
    "Developers who reject too many reports are flagged for review.",
  ]],
  ["Not allowed", [
    "Multiple accounts, trading points between your own accounts, copy-paste or AI-generated filler reports.",
    "Builds with malware, or links that require payment. Use itch.io, Steam keys, WebGL or a trusted host.",
    "Breaking these rules leads to a ban and removal of points.",
  ]],
];

export default function RulesPage() {
  return (
    <div className="max-w-3xl">
      <PageTitle sub="Short version: test honestly, review fairly, and everyone gets better games.">How it works</PageTitle>
      <div className="space-y-6">
        {RULES.map(([title, items]) => (
          <section key={title}>
            <h2 className="mb-2 text-lg font-semibold">{title}</h2>
            <ul className="list-disc space-y-1 pl-5 text-zinc-700">
              {items.map((i) => <li key={i}>{i}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
