"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";

// Mirrors the database rules: reward >= max(10, minutes), <= 200; fee = ceil(10%).
export function CostPreview({ spendable }: { spendable: number }) {
  const [minutes, setMinutes] = useState(15);
  const [reward, setReward] = useState(20);
  const [slots, setSlots] = useState(2);
  const minReward = Math.max(10, minutes);
  const fee = Math.ceil(reward * 0.1);
  const total = (reward + fee) * slots;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Minutes to play">
          <input name="min_minutes" type="number" min={5} max={180} value={minutes}
            onChange={(e) => setMinutes(+e.target.value)} className={inputClass} />
        </Field>
        <Field label="Reward per test" hint={`At least ${minReward}, at most 200`}>
          <input name="reward" type="number" min={minReward} max={200} value={reward}
            onChange={(e) => setReward(+e.target.value)} className={inputClass} />
        </Field>
        <Field label="Testers">
          <input name="slots" type="number" min={1} max={50} value={slots}
            onChange={(e) => setSlots(+e.target.value)} className={inputClass} />
        </Field>
      </div>
      <p className={`text-sm ${total > spendable ? "text-red-600" : "text-zinc-700"}`}>
        Held now: <strong>{total} pts</strong> ({slots} × ({reward} reward + {fee} fee)).
        {total > spendable && " You don't have enough points yet. Test a few games or lower the reward."}
        {" "}Unused slots are refunded when you close the campaign.
      </p>
    </div>
  );
}
