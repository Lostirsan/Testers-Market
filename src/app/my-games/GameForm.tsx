import { saveGame } from "../actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Field, inputClass } from "@/components/ui";
import type { Game } from "@/lib/types";

const PLATFORMS = ["Windows", "macOS", "Linux", "Web", "Android", "iOS"];

export function GameForm({ game }: { game?: Game }) {
  return (
    <ActionForm action={saveGame} className="space-y-4">
      {game && <input type="hidden" name="id" value={game.id} />}
      <Field label="Title"><input name="title" required defaultValue={game?.title} className={inputClass} /></Field>
      <Field label="Description" hint="What is the game, what stage is it in, what makes it special?">
        <textarea name="description" required minLength={20} rows={5} defaultValue={game?.description} className={inputClass} />
      </Field>
      <Field label="Genre"><input name="genre" required defaultValue={game?.genre} placeholder="Platformer" className={inputClass} /></Field>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Platforms</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {PLATFORMS.map((p) => (
            <label key={p} className="flex items-center gap-1">
              <input type="checkbox" name="platforms" value={p} defaultChecked={game?.platforms.includes(p)} /> {p}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Build link" hint="itch.io page, WebGL build, Steam key page or another https link. Never paid links.">
        <input name="build_url" type="url" required defaultValue={game?.build_url} placeholder="https://you.itch.io/game" className={inputClass} />
      </Field>
      <Field label="Cover image" hint="Optional. PNG, JPG or WebP up to 5 MB, 16:9 looks best.">
        <input name="cover" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="text-sm" />
      </Field>
      <SubmitButton>{game ? "Save changes" : "Add game"}</SubmitButton>
    </ActionForm>
  );
}
