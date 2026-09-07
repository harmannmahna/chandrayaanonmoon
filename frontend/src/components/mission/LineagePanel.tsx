import type { LineageStep } from "../../lib/mission/types";

export function LineagePanel({
  steps,
  inputDataStatus,
  open,
  onToggle,
}: {
  steps: LineageStep[];
  inputDataStatus: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20">
      <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={onToggle}>
        <span className="kicker">Data lineage</span>
        <span className="text-xs text-[var(--muted)]">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-[var(--border)] px-4 py-3">
          <p className="text-[11px] text-[var(--muted)]">
            Input data status: <strong className="text-[var(--text)]">{inputDataStatus}</strong>
          </p>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.id} className="flex gap-3 text-xs">
                <span
                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    s.status === "done"
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : s.status === "active"
                        ? "border-[var(--warn)] text-[var(--warn)]"
                        : s.status === "error"
                          ? "border-[var(--danger)] text-[var(--danger)]"
                          : "border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {i + 1}
                </span>
                <span>
                  <strong className="text-[var(--text)]">{s.label}</strong>
                  {s.detail ? <span className="mt-0.5 block text-[var(--muted)]">{s.detail}</span> : null}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-[10px] leading-5 text-[var(--muted)]">
            Limitations: prototype pipeline · pixel RMSE ≠ geodetic accuracy · illustrative layers stay labeled.
          </p>
        </div>
      ) : null}
    </div>
  );
}
