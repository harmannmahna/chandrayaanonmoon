import type { MatchResult } from "@/app/lib/types";

/**
 * LoFTR-style matcher adapter.
 *
 * TODO(scalability): Future: move heavy matching to a server/GPU service; support tiled processing for large rasters.
 * Keep this module as the single swap-point for remote LoFTR inference.
 */
export async function findCorrespondences(
  img1: ImageData,
  img2: ImageData,
): Promise<MatchResult> {
  const { runLocalDenseMatcher } = await import("./localDenseMatcher");
  return runLocalDenseMatcher(img1, img2);
}
