import { runCLAHE, imageDataToDataUrl } from "@/app/lib/preprocessing/clahe";
import { findCorrespondences } from "@/app/lib/matching/loftrAdapter";
import { runClassicalMatching } from "@/app/lib/matching/classicalMatcher";
import { runRANSAC } from "@/app/lib/ransac/ransac";
import { warpToReference } from "@/app/lib/warp/homographyWarp";
import { computeMetrics, computeReprojectionRmse } from "@/app/lib/metrics/computeMetrics";
import { renderCoverageHeatmap } from "@/app/lib/metrics/spatialCoverage";
import { compareHomographies } from "@/app/lib/metrics/groundTruth";
import {
  refineMatchesSubPixel,
  summarizeSubPixel,
} from "@/app/lib/refine/subPixelRefinement";
import type {
  ImageKey,
  LoadedImage,
  PairId,
  PairPipelineResult,
} from "@/app/lib/types";
import { PAIR_DEFS } from "@/app/lib/types";

export type PipelineStage = "idle" | "preprocess" | "match" | "ransac" | "refine" | "warp" | "done";

export async function preprocessAll(
  images: Record<ImageKey, LoadedImage>,
): Promise<Record<ImageKey, LoadedImage>> {
  const out = {} as Record<ImageKey, LoadedImage>;
  for (const key of Object.keys(images) as ImageKey[]) {
    const processed = runCLAHE(images[key].imageData);
    out[key] = {
      ...images[key],
      imageData: processed,
      previewUrl: imageDataToDataUrl(processed),
    };
  }
  return out;
}

export async function runPairPipeline(
  left: LoadedImage,
  right: LoadedImage,
  pairId: PairId,
  options?: {
    enableSubPixel?: boolean;
    matcher?: "loftr" | "classical";
    classicalMethod?: "ORB" | "SIFT";
    H_gt?: number[][];
  },
): Promise<PairPipelineResult> {
  const matchResult =
    options?.matcher === "classical"
      ? runClassicalMatching(left.imageData, right.imageData, options.classicalMethod ?? "ORB")
      : await findCorrespondences(left.imageData, right.imageData);

  let ransac = runRANSAC(
    matchResult.matches,
    { width: left.imageData.width, height: left.imageData.height },
    { width: right.imageData.width, height: right.imageData.height },
  );

  if (!ransac.H) {
    const sx = right.imageData.width / left.imageData.width;
    const sy = right.imageData.height / left.imageData.height;
    ransac = {
      H: [
        [sx, 0, 0],
        [0, sy, 0],
        [0, 0, 1],
      ],
      inliers: matchResult.matches,
      outlierCount: 0,
    };
  }

  const H = ransac.H!;
  const rmseBefore = computeReprojectionRmse(ransac.inliers, H);
  let refinedMatches = undefined;
  let subPixel = undefined;
  if (options?.enableSubPixel) {
    refinedMatches = await refineMatchesSubPixel(left.imageData, right.imageData, ransac.inliers, {
      topN: 50,
      method: "quadratic",
    });
    const refinedForRmse = refinedMatches
      .filter((m) => m.refined)
      .map((m) => ({ x1: m.x1_sub, y1: m.y1_sub, x2: m.x2_sub, y2: m.y2_sub }));
    const rmseAfter = refinedForRmse.length
      ? computeReprojectionRmse(refinedForRmse, H)
      : rmseBefore;
    subPixel = summarizeSubPixel(refinedMatches, rmseBefore, rmseAfter);
  }

  const metrics = computeMetrics(
    ransac.inliers,
    H,
    { width: left.imageData.width, height: left.imageData.height },
    { width: right.imageData.width, height: right.imageData.height },
    matchResult.matches.length,
    refinedMatches,
  );
  if (subPixel) metrics.subPixel = subPixel;
  if (options?.H_gt) {
    metrics.groundTruth = compareHomographies(
      H,
      options.H_gt,
      left.imageData.width,
      left.imageData.height,
    );
  }

  const warped = warpToReference(left.imageData, right.imageData, H);
  const coverageHeatmapUrl = renderCoverageHeatmap(right.imageData, metrics.gridCoverage);

  return {
    pairId,
    left: left.key,
    right: right.key,
    matches: matchResult.matches,
    method: matchResult.method,
    ransac,
    refinedMatches,
    metrics,
    warpedPreviewUrl: warped.warpedUrl,
    overlayPreviewUrl: warped.overlayUrl,
    coverageHeatmapUrl,
  };
}

export async function runAllPairs(
  images: Record<ImageKey, LoadedImage>,
  options?: { enableSubPixel?: boolean; H_gtByPair?: Partial<Record<PairId, number[][]>> },
): Promise<Record<PairId, PairPipelineResult>> {
  const out = {} as Record<PairId, PairPipelineResult>;
  for (const pair of PAIR_DEFS) {
    out[pair.id] = await runPairPipeline(images[pair.left], images[pair.right], pair.id, {
      enableSubPixel: options?.enableSubPixel,
      H_gt: options?.H_gtByPair?.[pair.id],
    });
  }
  return out;
}
