import { useState } from "react";
import { answerPrompt } from "../../lib/mission/lunaGuide";
import type { MatcherEngine, ReliabilityResult, RunRecord } from "../../lib/mission/types";

const PROMPTS = [
  "Why was this registration unreliable?",
  "What does RMSE mean?",
  "What should I try next?",
  "Why did this model perform better?",
] as const;

export function LunaGuidePanel({
  rmsePx,
  reliability,
  rawMatches,
  inlierRatio,
  coverage,
  fallbackUsed,
  engine,
  runA,
  runB,
}: {
  rmsePx?: number;
  reliability?: ReliabilityResult | null;
  rawMatches?: number;
  inlierRatio?: number;
  coverage?: number;
  fallbackUsed?: boolean;
  engine?: MatcherEngine;
  runA?: RunRecord | null;
  runB?: RunRecord | null;
}) {
  const [prompt, setPrompt] = useState<string>(PROMPTS[0]);
  const lines = answerPrompt(prompt, {
    rmsePx,
    reliability,
    rawMatches,
    inlierRatio,
    coverage,
    fallbackUsed,
    engine,
    runA,
    runB,
  });

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
      <p className="kicker">LunaGuide AI · offline evidence assistant</p>
      <p className="mt-1 text-[11px] text-[var(--muted)]">Deterministic answers from structured results only — no external LLM.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-wider ${
              prompt === p ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"
            }`}
            onClick={() => setPrompt(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted)]">
        {lines.map((l) => (
          <li key={l} className="flex gap-2">
            <span className="text-[var(--accent)]">•</span>
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
