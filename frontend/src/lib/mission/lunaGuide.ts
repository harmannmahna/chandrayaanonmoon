import type { MatcherEngine, ReliabilityResult, RunRecord } from "./types";

/** Offline deterministic LunaGuide — only uses structured app results. */

export function explainRmse(rmsePx: number): string[] {
  return [
    `RMSE here is ${rmsePx.toFixed(2)} pixels of inlier reprojection error after the estimated transform.`,
    "It measures how tightly RANSAC inliers agree in image space — not lunar geodetic / map accuracy.",
    rmsePx <= 2
      ? "For a visual-overlay prototype, this RMSE is in a typically usable band."
      : "Elevated RMSE suggests residual misalignment; treat overlays as provisional.",
  ];
}

export function explainUnreliable(args: {
  reliability?: ReliabilityResult | null;
  rawMatches?: number;
  inlierRatio?: number;
  rmsePx?: number;
  coverage?: number;
  fallbackUsed?: boolean;
}): string[] {
  const lines: string[] = [];
  if (args.fallbackUsed) {
    lines.push("An AI engine was requested but unavailable — AKAZE classical baseline was used instead (labeled fallback).");
  }
  if (args.reliability?.reasons?.length) {
    lines.push(...args.reliability.reasons.slice(0, 6));
  } else {
    if ((args.rawMatches ?? 0) < 40) lines.push(`Sparse correspondence (${args.rawMatches ?? 0} raw matches).`);
    if ((args.inlierRatio ?? 1) < 0.35) lines.push(`Low inlier ratio (${((args.inlierRatio ?? 0) * 100).toFixed(1)}%).`);
    if ((args.rmsePx ?? 0) > 3) lines.push(`Elevated pixel RMSE (${args.rmsePx?.toFixed(2)} px).`);
    if ((args.coverage ?? 1) < 0.35) lines.push(`Limited spatial coverage (${((args.coverage ?? 0) * 100).toFixed(0)}%).`);
  }
  lines.push("Do not treat this as certified georeferencing or mission-final alignment.");
  return lines;
}

export function explainModelCompare(a: RunRecord, b: RunRecord): string[] {
  const lines = [
    `Comparing ${a.engineUsed} (${a.id}) vs ${b.engineUsed} (${b.id}).`,
  ];
  const betterRmse = a.metrics.rmsePx <= b.metrics.rmsePx ? a : b;
  const betterInliers = a.metrics.inlierCount >= b.metrics.inlierCount ? a : b;
  lines.push(
    `Lower pixel RMSE: ${betterRmse.engineUsed} (${betterRmse.metrics.rmsePx.toFixed(2)} px).`,
  );
  lines.push(
    `Higher inlier count: ${betterInliers.engineUsed} (${betterInliers.engineUsed === a.engineUsed ? a.metrics.inlierCount : b.metrics.inlierCount}).`,
  );
  if (a.fallbackUsed || b.fallbackUsed) {
    lines.push("At least one run used fallback — AI engine was unavailable; results are not a fair AI-vs-AI bakeoff.");
  }
  lines.push("Scores are prototype metrics on the current pair only — not a published benchmark.");
  return lines;
}

export function suggestNext(args: {
  engine: MatcherEngine;
  reliability?: ReliabilityResult | null;
  fallbackUsed?: boolean;
}): string[] {
  const tips: string[] = [];
  if (args.fallbackUsed || args.engine !== "akaze") {
    tips.push("If AI Fast/Robust show Unavailable, install backend/requirements-ai.txt and restart the API.");
  }
  const trust = args.reliability?.trust_label ?? "";
  if (trust.includes("Insufficient") || trust.includes("No stable")) {
    tips.push("Try CLAHE review again, ensure overlap exists, or switch engine (AKAZE baseline vs AI when available).");
    tips.push("Open Illumination Lab to inspect how sun-angle changes create false features.");
  } else if (trust.includes("analyst review")) {
    tips.push("Inspect red/blue tint overlay and unmatched points before trusting the warp.");
    tips.push("Export experiment JSON and compare with another engine on the same pair.");
  } else {
    tips.push("Proceed to Ice mission planner only after optical context is aligned for the ROI.");
  }
  tips.push("Remember: illustrative demo layers ≠ calibrated DFSAR; RMSE ≠ geodetic accuracy.");
  return tips;
}

export function explainIceCandidate(args: {
  cpr: number;
  dop: number;
  shadowed: boolean;
  cprThr: number;
  dopThr: number;
}): string[] {
  return [
    `Candidate rule on the demo grid: CPR > ${args.cprThr.toFixed(2)} AND DOP < ${args.dopThr.toFixed(2)} AND doubly-shadowed mask.`,
    `This cell/cluster context: CPR=${args.cpr.toFixed(3)}, DOP=${args.dop.toFixed(3)}, shadowed=${args.shadowed ? "yes" : "no"}.`,
    "High CPR alone can also arise from rough rocks — DOP + shadow context reduce (but do not eliminate) ambiguity.",
    "This is a potential subsurface-ice signature on illustrative layers — not confirmed ice.",
  ];
}

export function explainRoute(args: {
  mode: string;
  distanceM?: number;
  meanSlope?: number;
  shadowFraction?: number;
  hazardCells?: number;
  feasibility?: string;
}): string[] {
  return [
    `Route mode: ${args.mode}.`,
    args.distanceM != null ? `Path length ≈ ${args.distanceM.toFixed(0)} m on the demo grid.` : "Path length unavailable.",
    args.meanSlope != null ? `Mean slope ≈ ${args.meanSlope.toFixed(1)}°.` : "Slope stats unavailable.",
    args.shadowFraction != null
      ? `Shadow exposure fraction ≈ ${(args.shadowFraction * 100).toFixed(0)}%.`
      : "Shadow exposure unavailable.",
    args.hazardCells != null ? `Hazard cells encountered: ${args.hazardCells}.` : "Hazard stats unavailable.",
    `Feasibility: ${args.feasibility ?? "n/a"} — prototype planning support, not certified rover navigation.`,
  ];
}

export function answerPrompt(
  prompt: string,
  ctx: {
    rmsePx?: number;
    reliability?: ReliabilityResult | null;
    rawMatches?: number;
    inlierRatio?: number;
    coverage?: number;
    fallbackUsed?: boolean;
    engine?: MatcherEngine;
    runA?: RunRecord | null;
    runB?: RunRecord | null;
    ice?: { cpr: number; dop: number; shadowed: boolean; cprThr: number; dopThr: number } | null;
    route?: {
      mode: string;
      distanceM?: number;
      meanSlope?: number;
      shadowFraction?: number;
      hazardCells?: number;
      feasibility?: string;
    } | null;
  },
): string[] {
  const p = prompt.toLowerCase();
  if (p.includes("rmse")) return explainRmse(ctx.rmsePx ?? 0);
  if (p.includes("unreliable") || p.includes("quality")) {
    return explainUnreliable({
      reliability: ctx.reliability,
      rawMatches: ctx.rawMatches,
      inlierRatio: ctx.inlierRatio,
      rmsePx: ctx.rmsePx,
      coverage: ctx.coverage,
      fallbackUsed: ctx.fallbackUsed,
    });
  }
  if (p.includes("better") || p.includes("compare")) {
    if (ctx.runA && ctx.runB) return explainModelCompare(ctx.runA, ctx.runB);
    return ["Select two experiment runs to compare model performance on the same metrics."];
  }
  if (p.includes("try next") || p.includes("next")) {
    return suggestNext({ engine: ctx.engine ?? "akaze", reliability: ctx.reliability, fallbackUsed: ctx.fallbackUsed });
  }
  if (p.includes("ice") || p.includes("cpr") || p.includes("dop")) {
    if (ctx.ice) return explainIceCandidate(ctx.ice);
    return ["Open LUNA/ICE, run candidate screening, then ask again with cluster metrics available."];
  }
  if (p.includes("route") || p.includes("rover")) {
    if (ctx.route) return explainRoute(ctx.route);
    return ["Plan a rover route in LUNA/ICE first, then ask why it was recommended."];
  }
  return [
    "LunaGuide answers only from structured prototype results (no external LLM).",
    "Try: Why was this registration unreliable? · What does RMSE mean? · What should I try next?",
  ];
}
