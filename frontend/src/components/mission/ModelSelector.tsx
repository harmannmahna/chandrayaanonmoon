import type { MatcherEngine, MatcherEngineInfo } from "../../lib/mission/types";

const ORDER: MatcherEngine[] = ["superpoint-lightglue", "loftr", "akaze"];

const FALLBACK_META: Record<MatcherEngine, { label: string; ui: string }> = {
  "superpoint-lightglue": { label: "AI Fast", ui: "SuperPoint + LightGlue" },
  loftr: { label: "AI Robust", ui: "LoFTR" },
  akaze: { label: "Classical Baseline", ui: "AKAZE" },
};

export function ModelSelector({
  engines,
  value,
  onChange,
  loading,
  fallbackUsed,
}: {
  engines: MatcherEngineInfo[];
  value: MatcherEngine;
  onChange: (e: MatcherEngine) => void;
  loading?: boolean;
  /** When the last match fell back from the currently selected AI engine. */
  fallbackUsed?: boolean;
}) {
  const byId = Object.fromEntries(engines.map((e) => [e.engine, e]));

  return (
    <div className="space-y-2">
      <p className="kicker">Matcher engine</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {ORDER.map((id) => {
          const meta = byId[id];
          const available = meta?.available ?? id === "akaze";
          let status = loading ? "Loading" : available ? "Available" : "Unavailable";
          if (!loading && fallbackUsed && value === id && id !== "akaze") status = "Fallback used";
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              disabled={loading}
              onClick={() => onChange(id)}
              className={`rounded-2xl border px-3 py-3 text-left transition ${
                active
                  ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                  : "border-[var(--border)] bg-black/20 hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)]"
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                {meta?.label ?? FALLBACK_META[id].label}
              </p>
              <p className="mt-1 text-sm font-medium">{meta?.ui_label ?? FALLBACK_META[id].ui}</p>
              <p
                className={`mt-2 text-[10px] uppercase tracking-wider ${
                  status === "Unavailable" || status === "Fallback used"
                    ? "text-[var(--warn)]"
                    : available
                      ? "text-[var(--accent)]"
                      : "text-[var(--muted)]"
                }`}
              >
                {status}
              </p>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] leading-5 text-[var(--muted)]">
        AKAZE is the classical baseline. AI engines require optional torch/kornia — if Unavailable, runs can fall back to
        AKAZE and will be labeled Fallback used (never silently faked as LoFTR).
      </p>
    </div>
  );
}
