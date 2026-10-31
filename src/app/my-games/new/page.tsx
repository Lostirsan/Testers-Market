import { requireProfile } from "@/lib/auth";
import { Card, PageTitle } from "@/components/ui";
import { GameForm } from "../GameForm";

export const metadata = { title: "Add a game" };

export default async function NewGamePage() {
  await requireProfile();
  return (
    <div className="max-w-2xl">
      <PageTitle sub="Adding a game is free. You choose when to list it for testing.">Add a game</PageTitle>
      <Card><GameForm /></Card>
    </div>
  );
}
