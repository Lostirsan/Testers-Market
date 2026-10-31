import { requireProfile } from "@/lib/auth";
import { updateProfile } from "../actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, Field, PageTitle, inputClass } from "@/components/ui";

export const metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const { profile } = await requireProfile();
  return (
    <div className="max-w-2xl">
      <PageTitle sub="Other developers see this when you test their games.">Your profile</PageTitle>
      <Card>
        <ActionForm action={updateProfile} className="space-y-4">
          <Field label="Username" hint="3–24 letters, digits or underscores.">
            <input name="username" required defaultValue={profile.username} className={inputClass} />
          </Field>
          <Field label="Display name"><input name="display_name" defaultValue={profile.display_name ?? ""} className={inputClass} /></Field>
          <Field label="Bio" hint="What do you make? What do you like to play?">
            <textarea name="bio" rows={3} maxLength={500} defaultValue={profile.bio ?? ""} className={inputClass} />
          </Field>
          <Field label="itch.io"><input name="itch_url" type="url" defaultValue={profile.itch_url ?? ""} placeholder="https://you.itch.io" className={inputClass} /></Field>
          <Field label="Steam"><input name="steam_url" type="url" defaultValue={profile.steam_url ?? ""} className={inputClass} /></Field>
          <SubmitButton>Save profile</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
