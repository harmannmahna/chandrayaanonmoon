import type { ReliabilityResult } from "../../lib/mission/types";

export function ReliabilityPanel({ reliability }: { reliability: ReliabilityResult | null | undefined }) {
  if (!reliability) return null;
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
      <p className="kicker">Match reliability agent</p>
      <p className="mt-2 text-2xl font-semibold">{reliability.score.toFixed(0)}<span className="text-sm text-[var(--muted)]"> / 100</span></p>
      <p className="mt-1 text-sm font-medium text-[var(--accent)]">{reliability.trust_label}</p>
      <ul className="mt-3 space-y-1.5 text-xs leading-5 text-[var(--muted)]">
        {reliability.reasons.slice(0, 6).map((r) => (
          <li key={r}>• {r}</li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] uppercase tracking-wider text-[var(--warn)]">{reliability.limitation}</p>
    </div>
  );
}
