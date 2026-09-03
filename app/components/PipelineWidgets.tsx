"use client";

import type { Match, PairPipelineResult } from "@/app/lib/types";
import type { RegistrationQuality } from "@/app/lib/metrics/qualityRules";
import { qualityTone } from "@/app/lib/metrics/qualityRules";

export function QualityBadge({ quality }: { quality: RegistrationQuality }) {
  const tone = qualityTone(quality);
  const cls =
    tone === "good"
      ? "border-[#71821f] text-[#d8ff3e] bg-[rgba(216,255,62,0.08)]"
      : tone === "bad"
        ? "border-[#642828] text-[#ff8c8c] bg-[rgba(255,140,140,0.08)]"
        : "border-[#6a5a12] text-[#d8c23e] bg-[rgba(216,194,62,0.08)]";
  return (
    <span className={`inline-flex border px-2 py-1 text-[10px] uppercase tracking-[0.12em] mono ${cls}`}>
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
    <div className="relative grid h-[360px] grid-cols-2 gap-8 overflow-hidden border border-[#292927] bg-[#050505]">
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
          const stroke = refinedPoint ? "rgba(120,200,255,0.8)" : isInlier ? "rgba(216,255,62,0.55)" : "rgba(255,84,84,0.35)";
          return (
            <g key={index}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth="0.8" />
              <circle cx={x1} cy={y1} r="2.4" fill="#0b0b0b" stroke={stroke} />
              <circle cx={x2} cy={y2} r="2.4" fill="#0b0b0b" stroke={stroke} />
            </g>
          );
        })}
      </svg>
      <span className="absolute left-3 top-3 border border-[#444] bg-black/80 px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-[#aaa] mono">
        {leftLabel}
      </span>
      <span className="absolute right-3 top-3 border border-[#444] bg-black/80 px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-[#aaa] mono">
        {rightLabel}
      </span>
    </div>
  );
}

export function CoveragePanel({ pair }: { pair: PairPipelineResult }) {
  const g = pair.metrics.gridCoverage;
  return (
    <div className="border border-[#292927] bg-[#101010]">
      <div className="flex items-center justify-between border-b border-[#292927] px-4 py-3">
        <div className="mono text-[10px] uppercase tracking-[0.12em] text-[#888]">Coverage</div>
        <span className={`mono text-[10px] uppercase tracking-[0.12em] ${g.uniformRegistration ? "text-[#d8ff3e]" : "text-[#d8c23e]"}`}>
          Uniform: {g.uniformRegistration ? "Yes" : "No"}
        </span>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="overflow-hidden border border-[#292927] bg-[#050505]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pair.coverageHeatmapUrl} alt="Coverage heatmap" className="h-56 w-full object-contain" />
        </div>
        <div className="space-y-2 text-sm text-[#9a9a96]">
          <div>Filled cells: {g.filledCells}/{g.rows * g.cols}</div>
          <div>Min / max / mean: {g.minCellCount} / {g.maxCellCount} / {g.meanCellCount.toFixed(1)}</div>
          <div>Uniformity score: {g.uniformityScore.toFixed(3)}</div>
          <div className="grid grid-cols-3 gap-1 pt-2">
            {g.flatCounts.map((count, i) => (
              <div key={i} className="border border-[#292927] bg-[#0d0d0d] px-2 py-3 text-center mono text-xs text-white">
                {count}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
