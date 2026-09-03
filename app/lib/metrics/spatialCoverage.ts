import type { Match } from "@/app/lib/types";

export interface GridCoverageResult {
  rows: number;
  cols: number;
  cells: number[][];
  flatCounts: number[];
  totalInliers: number;
  filledCells: number;
  minCellCount: number;
  maxCellCount: number;
  meanCellCount: number;
  uniformityScore: number;
  uniformRegistration: boolean;
}

/**
 * Measure how evenly inliers are distributed across a rows×cols grid.
 */
export function computeGridCoverage(
  matches: Match[],
  imgWidth: number,
  imgHeight: number,
  rows = 4,
  cols = 3,
): GridCoverageResult {
  const cells = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (const m of matches) {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor((m.x2 / imgWidth) * cols)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor((m.y2 / imgHeight) * rows)));
    cells[cy][cx] += 1;
  }
  const flatCounts = cells.flat();
  const filledCells = flatCounts.filter((n) => n > 0).length;
  const totalInliers = matches.length;
  const minCellCount = flatCounts.length ? Math.min(...flatCounts) : 0;
  const maxCellCount = flatCounts.length ? Math.max(...flatCounts) : 0;
  const meanCellCount = flatCounts.length ? flatCounts.reduce((a, b) => a + b, 0) / flatCounts.length : 0;
  const variance =
    flatCounts.length && meanCellCount > 0
      ? flatCounts.reduce((sum, n) => sum + (n - meanCellCount) ** 2, 0) / flatCounts.length
      : 0;
  const stdDev = Math.sqrt(variance);
  const uniformityScore =
    meanCellCount > 0 ? Math.max(0, Math.min(1, 1 - stdDev / meanCellCount)) : 0;
  const uniformRegistration = filledCells >= 8 && minCellCount >= 1 && totalInliers >= 12;

  return {
    rows,
    cols,
    cells,
    flatCounts,
    totalInliers,
    filledCells,
    minCellCount,
    maxCellCount,
    meanCellCount,
    uniformityScore,
    uniformRegistration,
  };
}

export function renderCoverageHeatmap(
  reference: ImageData,
  coverage: GridCoverageResult,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = reference.width;
  canvas.height = reference.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(reference, 0, 0);
  const cellW = reference.width / coverage.cols;
  const cellH = reference.height / coverage.rows;
  const max = Math.max(1, coverage.maxCellCount);
  for (let r = 0; r < coverage.rows; r++) {
    for (let c = 0; c < coverage.cols; c++) {
      const count = coverage.cells[r][c];
      ctx.fillStyle = `rgba(216,255,62,${0.08 + (count / max) * 0.45})`;
      ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.strokeRect(c * cellW, r * cellH, cellW, cellH);
      ctx.fillStyle = "#f2f2f0";
      ctx.font = "12px monospace";
      ctx.fillText(String(count), c * cellW + 8, r * cellH + 18);
    }
  }
  return canvas.toDataURL("image/png");
}
