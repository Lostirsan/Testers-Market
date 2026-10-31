"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

type Q = { question: string; options: string[]; correct: number };
const blank = (): Q => ({ question: "", options: ["", "", ""], correct: 0 });

// Control questions that prove a tester actually played. Serialized into a hidden "questions" field.
export function QuestionsEditor() {
  const [qs, setQs] = useState<Q[]>([blank()]);
  const update = (i: number, patch: Partial<Q>) => setQs(qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const filled = qs.filter((q) => q.question.trim() && q.options.filter((o) => o.trim()).length >= 2);
  const payload = filled.map((q) => {
    const kept = q.options.map((o, idx) => ({ o: o.trim(), idx })).filter((x) => x.o);
    return { question: q.question.trim(), options: kept.map((x) => x.o), correct: Math.max(0, kept.findIndex((x) => x.idx === q.correct)) };
  });

  return (
    <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-4">
      <legend className="px-1 text-sm font-medium">Control questions (recommended)</legend>
      <p className="text-xs text-zinc-500">
        Ask something only a real player would know, e.g. &quot;What color is the first boss?&quot;. Testers must answer
        all questions correctly to send a report. They never see the right answers and get 2 attempts.
      </p>
      <input type="hidden" name="questions" value={JSON.stringify(payload)} />
      {qs.map((q, i) => (
        <div key={i} className="space-y-2 rounded-md bg-zinc-50 p-3">
          <input value={q.question} onChange={(e) => update(i, { question: e.target.value })}
            placeholder={`Question ${i + 1}`} className={inputClass} />
          {q.options.map((o, k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="radio" name={`correct_${i}`} checked={q.correct === k} onChange={() => update(i, { correct: k })}
                title="Correct answer" />
              <input value={o} placeholder={`Answer ${k + 1}`} className={inputClass}
                onChange={(e) => update(i, { options: q.options.map((x, m) => (m === k ? e.target.value : x)) })} />
            </label>
          ))}
          <div className="flex gap-3 text-xs">
            {q.options.length < 5 && (
              <button type="button" className="text-violet-700" onClick={() => update(i, { options: [...q.options, ""] })}>+ answer</button>
            )}
            <button type="button" className="text-zinc-500" onClick={() => setQs(qs.filter((_, j) => j !== i))}>Remove question</button>
          </div>
          <p className="text-xs text-zinc-500">Select the radio button next to the correct answer.</p>
        </div>
      ))}
      {qs.length < 3 && (
        <button type="button" onClick={() => setQs([...qs, blank()])} className="text-sm text-violet-700">+ Add question</button>
      )}
    </fieldset>
  );
}
