const STEPS = ["Preprocessing", "AI / classical matching", "RANSAC", "Refinement", "Confidence audit"] as const;

export function ProcessingStatus({
  active,
  stepIndex,
}: {
  active: boolean;
  stepIndex: number;
}) {
  if (!active) return null;
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/25 px-4 py-3">
      <p className="kicker mb-2">Processing</p>
      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => {
          const state = i < stepIndex ? "done" : i === stepIndex ? "active" : "pending";
          return (
            <span
              key={label}
              className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                state === "done"
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : state === "active"
                    ? "border-[var(--warn)] text-[var(--warn)]"
                    : "border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
