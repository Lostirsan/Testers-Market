"use client";

import { useState } from "react";
import { acceptReport, rejectReport } from "../../actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { inputClass } from "@/components/ui";

export function ReviewForm({ assignmentId }: { assignmentId: string }) {
  const [rejecting, setRejecting] = useState(false);
  return (
    <div className="mt-4 border-t pt-4">
      {!rejecting ? (
        <div className="flex flex-wrap items-end gap-3">
          <ActionForm action={acceptReport} className="flex items-end gap-3">
            <input type="hidden" name="assignment_id" value={assignmentId} />
            <label className="text-sm">
              <span className="block text-xs text-zinc-500">How useful was it?</span>
              <select name="score" defaultValue="4" className={inputClass}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}
              </select>
            </label>
            <SubmitButton>Accept and pay</SubmitButton>
          </ActionForm>
          <button onClick={() => setRejecting(true)} className="text-sm text-red-700 hover:underline">Reject…</button>
        </div>
      ) : (
        <ActionForm action={rejectReport} className="space-y-2">
          <input type="hidden" name="assignment_id" value={assignmentId} />
          <textarea name="reason" required minLength={20} rows={3} className={inputClass}
            placeholder="Why doesn't this report meet your instructions? The tester and a moderator will see this." />
          <div className="flex gap-2">
            <SubmitButton variant="danger">Reject report</SubmitButton>
            <button type="button" onClick={() => setRejecting(false)} className="text-sm text-zinc-600">Cancel</button>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
