import { useMemo, useState } from "react";
import { answerPrompt } from "../../lib/mission/lunaGuide";

export function IceLunaGuide({
  cpr,
  dop,
  shadowed,
  cprThr,
  dopThr,
  route,
}: {
  cpr?: number;
  dop?: number;
  shadowed?: boolean;
  cprThr: number;
  dopThr: number;
  route?: {
    mode: string;
    distanceM?: number;
    meanSlope?: number;
    shadowFraction?: number;
    hazardCells?: number;
    feasibility?: string;
  } | null;
}) {
  const prompts = useMemo(() => {
    const list = ["Why is this a potential ice signature?"];
    if (route) list.push("Why is this route recommended?");
    return list;
  }, [route]);
  const [prompt, setPrompt] = useState(prompts[0]!);
  const lines = answerPrompt(prompt, {
    ice:
      cpr != null && dop != null && shadowed != null
        ? { cpr, dop, shadowed, cprThr, dopThr }
        : null,
    route: route ?? null,
  });

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
      <p className="kicker">LunaGuide AI · ice / route evidence</p>
      <p className="mt-1 text-[11px] text-[var(--muted)]">Offline deterministic explanations from planner metrics only.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {prompts.map((p) => (
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
