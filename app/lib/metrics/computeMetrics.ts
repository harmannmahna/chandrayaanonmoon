import type { Match, MetricsResult } from "@/app/lib/types";
import { project } from "@/app/lib/ransac/ransac";
import { computeGridCoverage } from "@/app/lib/metrics/spatialCoverage";
import { assessRegistrationQuality } from "@/app/lib/metrics/qualityRules";
import type { RefinedMatch } from "@/app/lib/refine/subPixelRefinement";

export function computeReprojectionRmse(
  matches: Array<Pick<Match, "x1" | "y1" | "x2" | "y2">>,
  H: number[][],
): number {
  if (!matches.length) return 0;
  const errors = matches.map((m) => {
    const p = project(H, m.x1, m.y1);
    return Math.hypot(p.x - m.x2, p.y - m.y2);
  });
  return Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
}

export function computeMetrics(
  inliers: Match[],
  H: number[][],
  img1Size: { width: number; height: number },
  img2Size: { width: number; height: number },
  totalMatches: number,
  refined?: RefinedMatch[],
): MetricsResult {
  const rmse = computeReprojectionRmse(inliers, H);
  const refinedPairs =
    refined
      ?.filter((m) => m.refined)
      .map((m) => ({ x1: m.x1_sub, y1: m.y1_sub, x2: m.x2_sub, y2: m.y2_sub })) ?? [];
  const refinedRmse = refinedPairs.length ? computeReprojectionRmse(refinedPairs, H) : undefined;
  const gridCoverage = computeGridCoverage(inliers, img2Size.width, img2Size.height);
  const inlierRatio = totalMatches ? inliers.length / totalMatches : 0;
  const confidence: MetricsResult["confidence"] =
    inliers.length >= 20 ? "HIGH" : inliers.length >= 10 ? "MED" : "LOW";

  const base: MetricsResult = {
    rmse,
    refinedRmse,
    inlierRatio,
    inlierCount: inliers.length,
    totalMatches,
    coverage: gridCoverage.filledCells / (gridCoverage.rows * gridCoverage.cols),
    occupiedCells: gridCoverage.filledCells,
    cellCounts: gridCoverage.flatCounts,
    confidence,
    gridCoverage,
    quality: "Medium",
    uniformRegistration: gridCoverage.uniformRegistration,
  };
  base.quality = assessRegistrationQuality(base);
  void img1Size;
  return base;
}
