import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { Card, PageTitle } from "@/components/ui";
import { GameForm } from "../../GameForm";
import type { Game } from "@/lib/types";

export default async function EditGamePage({ params }: PageProps<"/my-games/[id]/edit">) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  const { data: game } = await supabase.from("games").select("*").eq("id", id).eq("owner_id", profile.id).single<Game>();
  if (!game) notFound();
  return (
    <div className="max-w-2xl">
      <PageTitle>Edit {game.title}</PageTitle>
      <Card><GameForm game={game} /></Card>
    </div>
  );
}
