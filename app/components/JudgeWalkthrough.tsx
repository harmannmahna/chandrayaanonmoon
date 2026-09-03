"use client";

import Link from "next/link";

export type WalkthroughStep = {
  id: string;
  title: string;
  body: string;
  target?: string;
  href?: string;
};

export const JUDGE_STEPS: WalkthroughStep[] = [
  {
    id: "demo",
    title: "Load demo set",
    body: "Start with the curated three-image demo. It is the fastest way to show multi-modal OHRC / LRO / IIRS-style products without hunting for files.",
    target: "demo-load",
  },
  {
    id: "sensors",
    title: "Show sensor info",
    body: "Point to the sensor cards. Judges should see approximate GSD, modality, and why A/B/C are not interchangeable camera products.",
    target: "sensor-panel",
  },
  {
    id: "clahe",
    title: "Run preprocessing",
    body: "CLAHE boosts local contrast in shadowed lunar terrain. It does not solve illumination alone, but it makes correspondence finding more stable.",
    target: "stage-preprocess",
  },
  {
    id: "match",
    title: "Run matching",
    body: "The LoFTR-style adapter finds correspondences across lighting and scale differences. Emphasize that this stage is swappable for real LoFTR weights later.",
    target: "stage-match",
  },
  {
    id: "ransac",
    title: "Show RANSAC + homography",
    body: "RANSAC keeps geometrically consistent matches and estimates the transform H. Bad guesses become outliers instead of silently corrupting the warp.",
    target: "stage-ransac",
  },
  {
    id: "overlay",
    title: "Show overlay + registered image",
    body: "The registered product and 50/50 overlay are the visual proof. Clean crater edges mean success; ghosting means the transform failed.",
    target: "stage-results",
  },
  {
    id: "metrics",
    title: "Show metrics",
    body: "RMSE, inlier ratio, coverage, and quality answer “how do you know it worked?” Coverage and quality badges stop the demo from always looking confident.",
    target: "metrics-panel",
  },
  {
    id: "exports",
    title: "Show exports",
    body: "A scientist-facing product is more than a screenshot: registered PNG, overlay, match_points.csv, homography.json, and metrics.json.",
    target: "exports-panel",
  },
  {
    id: "baseline",
    title: "Open Baseline comparison",
    body: "Compare classical SIFT/ORB-style matching against the LoFTR-style adapter on the same pair so the robustness claim is concrete.",
    target: "baseline-tab",
  },
  {
    id: "gt",
    title: "Open Ground-truth validation",
    body: "Use the synthetic pair where H_gt is known. Corner error between H_est and H_gt shows internal consistency under controlled conditions.",
    target: "gt-panel",
  },
  {
    id: "context",
    title: "Open Context & Product Spec",
    body: "Finish with domain context: Chandrayaan-2 / LRO sensors, why registration matters, and the exact deliverable package.",
    href: "/context",
  },
];

type Props = {
  open: boolean;
  stepIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onJump: (index: number) => void;
};

export function JudgeWalkthrough({ open, stepIndex, onClose, onPrev, onNext, onJump }: Props) {
  if (!open) return null;
  const step = JUDGE_STEPS[stepIndex];
  const progress = ((stepIndex + 1) / JUDGE_STEPS.length) * 100;

  return (
    <aside className="panel fixed bottom-4 right-4 z-50 w-[min(420px,calc(100vw-2rem))]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div>
          <div className="kicker">Judge walkthrough</div>
          <div className="mt-1 text-sm text-[var(--text-primary)]">
            Step {stepIndex + 1} / {JUDGE_STEPS.length}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-ghost !px-2 !py-1"
        >
          Close
        </button>
      </div>

      <div className="h-1 bg-[color-mix(in_srgb,var(--accent-secondary)_18%,transparent)]">
        <div className="h-full bg-[var(--accent-primary)]" style={{ width: `${progress}%` }} />
      </div>

      <div className="space-y-3 px-4 py-4">
        <h3 className="text-lg font-medium tracking-tight text-[var(--text-primary)]">{step.title}</h3>
        <p className="muted text-sm leading-6">{step.body}</p>
        {step.href ? (
          <Link
            href={step.href}
            className="btn-secondary"
          >
            Open Context page
          </Link>
        ) : null}
      </div>

      <div className="flex gap-1 overflow-x-auto border-t border-[var(--border)] px-3 py-2">
        {JUDGE_STEPS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onJump(index)}
            className={`min-w-7 rounded px-2 py-1 text-[10px] mono ${
              index === stepIndex ? "btn-primary !px-2 !py-1" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)]"
            }`}
            aria-label={`Jump to step ${index + 1}`}
          >
            {index + 1}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={stepIndex === 0}
          className="btn-secondary"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="btn-primary"
        >
          {stepIndex === JUDGE_STEPS.length - 1 ? "Finish" : "Next"}
        </button>
      </div>
    </aside>
  );
}
