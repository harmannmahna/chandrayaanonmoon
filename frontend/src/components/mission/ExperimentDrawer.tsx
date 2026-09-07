import { exportAllRunsJson, exportRunJson } from "../../lib/mission/runHistory";
import type { RunRecord } from "../../lib/mission/types";

export function ExperimentDrawer({
  open,
  onClose,
  runs,
  selectedIds,
  onToggleSelect,
  onReproduce,
}: {
  open: boolean;
  onClose: () => void;
  runs: RunRecord[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onReproduce: (run: RunRecord) => void;
}) {
  if (!open) return null;
  const a = runs.find((r) => r.id === selectedIds[0]);
  const b = runs.find((r) => r.id === selectedIds[1]);

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/50 backdrop-blur-sm">
      <button type="button" className="h-full flex-1 cursor-default" aria-label="Close history" onClick={onClose} />
      <aside className="glass-strong flex h-full w-full max-w-md flex-col overflow-hidden border-l border-[var(--border)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <p className="kicker">Experiment history</p>
            <p className="text-xs text-[var(--muted)]">Last {runs.length} runs · localStorage</p>
          </div>
          <button type="button" className="btn btn-secondary !min-h-8 !px-3 text-xs" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {!runs.length ? (
            <p className="text-sm text-[var(--muted)]">No runs yet. Complete Register through RANSAC to record an experiment.</p>
          ) : (
            runs.map((run) => {
              const selected = selectedIds.includes(run.id);
              return (
                <div
                  key={run.id}
                  className={`rounded-2xl border p-3 ${selected ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {run.engineUsed}
                        {run.fallbackUsed ? " · fallback" : ""}
                      </p>
                      <p className="text-[10px] text-[var(--muted)]">{new Date(run.timestamp).toLocaleString()}</p>
                    </div>
                    <button type="button" className="text-[10px] uppercase tracking-wider text-[var(--accent)]" onClick={() => onToggleSelect(run.id)}>
                      {selected ? "Selected" : "Select"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    matches {run.matchStats.rawMatches} · inliers {run.metrics.inlierCount} · RMSE {run.metrics.rmsePx.toFixed(2)} px ·{" "}
                    {run.quality?.trust_label ?? run.outputStatus}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className="btn btn-secondary !min-h-8 !px-2 text-[10px]" onClick={() => onReproduce(run)}>
                      Reproduce
                    </button>
                    <button type="button" className="btn btn-secondary !min-h-8 !px-2 text-[10px]" onClick={() => exportRunJson(run)}>
                      Export JSON
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {a && b ? (
          <div className="border-t border-[var(--border)] p-4 text-xs leading-5 text-[var(--muted)]">
            <p className="kicker mb-2">Side-by-side</p>
            <div className="grid grid-cols-2 gap-2">
              {[a, b].map((r) => (
                <div key={r.id} className="rounded-xl border border-[var(--border)] p-2">
                  <p className="font-medium text-[var(--text)]">{r.engineUsed}</p>
                  <p>RMSE {r.metrics.rmsePx.toFixed(2)}</p>
                  <p>Inliers {r.metrics.inlierCount}</p>
                  <p>Coverage {(r.metrics.spatialCoverage * 100).toFixed(0)}%</p>
                  <p>Score {r.quality?.score ?? "—"}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="border-t border-[var(--border)] p-4">
          <button type="button" className="btn btn-secondary w-full text-xs" disabled={!runs.length} onClick={() => exportAllRunsJson(runs)}>
            Export all experiments JSON
          </button>
        </div>
      </aside>
    </div>
  );
}
