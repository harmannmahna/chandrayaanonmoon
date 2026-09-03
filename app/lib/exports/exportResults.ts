import type { MetricsResult, PairPipelineResult } from "@/app/lib/types";
import type { RefinedMatch } from "@/app/lib/refine/subPixelRefinement";

function downloadText(filename: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadUrl(filename: string, url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

function isRefinedMatch(value: unknown): value is RefinedMatch {
  return Boolean(value && typeof value === "object" && "x1_sub" in value && "y1_sub" in value);
}

export function exportPairResults(pair: PairPipelineResult, referenceUrl?: string) {
  const experimental = pair.metrics.quality === "Unreliable";
  const suffix = experimental ? ".experimental" : "";

  if (pair.warpedPreviewUrl) downloadUrl(`registered_source${suffix}.png`, pair.warpedPreviewUrl);
  if (referenceUrl) downloadUrl(`reference_image${suffix}.png`, referenceUrl);
  if (pair.overlayPreviewUrl) downloadUrl(`overlay_proof${suffix}.png`, pair.overlayPreviewUrl);
  if (pair.coverageHeatmapUrl) downloadUrl(`coverage_heatmap${suffix}.png`, pair.coverageHeatmapUrl);

  const sourceMatches = pair.refinedMatches?.length ? pair.refinedMatches : pair.ransac.inliers;
  const rows = sourceMatches.map((m, index) => {
    if (isRefinedMatch(m)) {
      return {
        id: index + 1,
        x_source: m.x1_sub,
        y_source: m.y1_sub,
        x_reference: m.x2_sub,
        y_reference: m.y2_sub,
        confidence: m.confidence ?? "",
        refined: m.refined,
      };
    }
    return {
      id: index + 1,
      x_source: m.x1,
      y_source: m.y1,
      x_reference: m.x2,
      y_reference: m.y2,
      confidence: m.confidence ?? "",
      refined: false,
    };
  });

  const csvHeader = experimental
    ? "# EXPERIMENTAL / UNRELIABLE REGISTRATION\nid,x_source,y_source,x_reference,y_reference,confidence,refined"
    : "id,x_source,y_source,x_reference,y_reference,confidence,refined";
  const csv = `${csvHeader}\n${rows.map((r) => Object.values(r).join(",")).join("\n")}`;
  downloadText(`match_points${suffix}.csv`, csv, "text/csv");

  downloadText(
    `homography${suffix}.json`,
    JSON.stringify({ pairId: pair.pairId, H: pair.ransac.H, experimental }, null, 2),
    "application/json",
  );

  downloadText(
    `metrics${suffix}.json`,
    JSON.stringify(
      {
        pairId: pair.pairId,
        method: pair.method,
        experimental,
        metrics: pair.metrics,
        gridCoverage: pair.metrics.gridCoverage,
        quality: pair.metrics.quality,
        groundTruth: pair.metrics.groundTruth ?? null,
      },
      null,
      2,
    ),
    "application/json",
  );
}

export function exportAllMetrics(pairs: PairPipelineResult[]) {
  const payload = {
    generatedAt: new Date().toISOString(),
    pairs: pairs.map((pair) => ({
      pairId: pair.pairId,
      method: pair.method,
      quality: pair.metrics.quality,
      metrics: pair.metrics as MetricsResult,
    })),
  };
  downloadText("metrics_all_pairs.json", JSON.stringify(payload, null, 2), "application/json");
}
