"use client";

import type { Match, PairPipelineResult } from "@/app/lib/types";
import type { RegistrationQuality } from "@/app/lib/metrics/qualityRules";

const QUALITY_CLASS: Record<RegistrationQuality, string> = {
  High: "badge-quality-high",
  Medium: "badge-quality-medium",
  Low: "badge-quality-low",
  Unreliable: "badge-quality-unreliable",
};

export function QualityBadge({ quality }: { quality: RegistrationQuality }) {
  return (
    <span className={`badge-quality mono ${QUALITY_CLASS[quality]}`}>
      {quality}
    </span>
  );
}

export function MatchCanvas({
  leftUrl,
  rightUrl,
  matches,
  inliers,
  refined,
  leftLabel = "LEFT",
  rightLabel = "RIGHT",
  leftSize,
  rightSize,
}: {
  leftUrl: string;
  rightUrl: string;
  matches?: Match[];
  inliers?: Match[];
  refined?: Array<Match & { refined?: boolean; x1_sub?: number; y1_sub?: number; x2_sub?: number; y2_sub?: number }>;
  leftLabel?: string;
  rightLabel?: string;
  leftSize?: { width: number; height: number };
  rightSize?: { width: number; height: number };
}) {
  const lw = leftSize?.width || 512;
  const lh = leftSize?.height || 512;
  const rw = rightSize?.width || 512;
  const rh = rightSize?.height || 512;
  const inlierKeys = new Set((inliers || []).map((m) => `${m.x1}:${m.y1}:${m.x2}:${m.y2}`));
  const draw = refined?.length ? refined : matches || [];
  return (
    <div className="canvas-frame relative grid h-[360px] grid-cols-2 gap-8 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={leftUrl} alt={leftLabel} className="h-full w-full object-cover opacity-80 grayscale" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={rightUrl} alt={rightLabel} className="h-full w-full object-cover opacity-80 grayscale" />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 420" preserveAspectRatio="none">
        {draw.slice(0, 80).map((m, index) => {
          const key = `${m.x1}:${m.y1}:${m.x2}:${m.y2}`;
          const refinedPoint = Boolean((m as { refined?: boolean }).refined);
          const isInlier = !inliers || inlierKeys.has(key) || refinedPoint;
          const rx1 = Number((m as { x1_sub?: number }).x1_sub ?? m.x1);
          const ry1 = Number((m as { y1_sub?: number }).y1_sub ?? m.y1);
          const rx2 = Number((m as { x2_sub?: number }).x2_sub ?? m.x2);
          const ry2 = Number((m as { y2_sub?: number }).y2_sub ?? m.y2);
          const x1 = (rx1 / lw) * 480;
          const y1 = (ry1 / lh) * 420;
          const x2 = 520 + (rx2 / rw) * 480;
          const y2 = (ry2 / rh) * 420;
          const stroke = refinedPoint ? "rgba(126,231,255,0.85)" : isInlier ? "rgba(74,222,128,0.6)" : "rgba(251,113,133,0.4)";
          return (
            <g key={index}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth="0.8" />
              <circle cx={x1} cy={y1} r="2.4" fill="#0b0b0b" stroke={stroke} />
              <circle cx={x2} cy={y2} r="2.4" fill="#0b0b0b" stroke={stroke} />
            </g>
          );
        })}
      </svg>
      <span className="absolute left-3 top-3 border border-[var(--border)] bg-black/70 px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-[var(--text-muted)] mono">
        {leftLabel}
      </span>
      <span className="absolute right-3 top-3 border border-[var(--border)] bg-black/70 px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-[var(--text-muted)] mono">
        {rightLabel}
      </span>
    </div>
  );
}

export function CoveragePanel({ pair }: { pair: PairPipelineResult }) {
  const g = pair.metrics.gridCoverage;
  return (
    <div className="panel">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="kicker">Coverage</div>
        <span className={`mono text-[10px] uppercase tracking-[0.12em] ${g.uniformRegistration ? "text-[var(--quality-high)]" : "text-[var(--quality-medium)]"}`}>
          Uniform: {g.uniformRegistration ? "Yes" : "No"}
        </span>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="canvas-frame overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pair.coverageHeatmapUrl} alt="Coverage heatmap" className="h-56 w-full object-contain" />
        </div>
        <div className="muted space-y-2 text-sm">
          <div>Filled cells: {g.filledCells}/{g.rows * g.cols}</div>
          <div>Min / max / mean: {g.minCellCount} / {g.maxCellCount} / {g.meanCellCount.toFixed(1)}</div>
          <div>Uniformity score: {g.uniformityScore.toFixed(3)}</div>
          <div className="grid grid-cols-3 gap-1 pt-2">
            {g.flatCounts.map((count, i) => (
              <div key={i} className="panel-muted px-2 py-3 text-center mono text-xs text-[var(--text-primary)]">
                {count}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
