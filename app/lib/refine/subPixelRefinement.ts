import type { Match } from "@/app/lib/types";

export type RefinementMethod = "phase" | "ecc" | "quadratic";

export type RefinedMatch = Match & {
  x1_sub: number;
  y1_sub: number;
  x2_sub: number;
  y2_sub: number;
  refined: boolean;
  method: RefinementMethod;
  shiftMagnitude: number;
};

export interface SubPixelSummary {
  refinedCount: number;
  attempted: number;
  medianShift: number;
  rmseBefore: number;
  rmseAfter: number;
  method: RefinementMethod;
}

function toGrayPatch(
  image: ImageData,
  cx: number,
  cy: number,
  windowSize: number,
): Float64Array | null {
  const half = Math.floor(windowSize / 2);
  const x0 = Math.round(cx) - half;
  const y0 = Math.round(cy) - half;
  if (x0 < 0 || y0 < 0 || x0 + windowSize > image.width || y0 + windowSize > image.height) {
    return null;
  }
  const patch = new Float64Array(windowSize * windowSize);
  let i = 0;
  for (let y = y0; y < y0 + windowSize; y++) {
    for (let x = x0; x < x0 + windowSize; x++) {
      const j = (y * image.width + x) * 4;
      patch[i++] = image.data[j] * 0.299 + image.data[j + 1] * 0.587 + image.data[j + 2] * 0.114;
    }
  }
  return patch;
}

function mean(values: Float64Array): number {
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function nccAt(a: Float64Array, b: Float64Array, dx: number, dy: number, size: number): number {
  // Shift b by (dx, dy) relative to a using nearest samples inside bounds.
  const meanA = mean(a);
  let meanB = 0;
  let count = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = x + dx;
      const sy = y + dy;
      if (sx < 0 || sy < 0 || sx >= size || sy >= size) continue;
      meanB += b[sy * size + sx];
      count++;
    }
  }
  if (!count) return -1;
  meanB /= count;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = x + dx;
      const sy = y + dy;
      if (sx < 0 || sy < 0 || sx >= size || sy >= size) continue;
      const va = a[y * size + x] - meanA;
      const vb = b[sy * size + sx] - meanB;
      num += va * vb;
      denA += va * va;
      denB += vb * vb;
    }
  }
  const den = Math.sqrt(denA * denB);
  return den > 1e-8 ? num / den : -1;
}

function quadraticPeak(scores: number[][]): { dx: number; dy: number } {
  let bestX = 1;
  let bestY = 1;
  let best = -Infinity;
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      if (scores[y][x] > best) {
        best = scores[y][x];
        bestX = x;
        bestY = y;
      }
    }
  }
  const c = scores[bestY][bestX];
  const left = scores[bestY][Math.max(0, bestX - 1)];
  const right = scores[bestY][Math.min(2, bestX + 1)];
  const up = scores[Math.max(0, bestY - 1)][bestX];
  const down = scores[Math.min(2, bestY + 1)][bestX];
  const denomX = left - 2 * c + right;
  const denomY = up - 2 * c + down;
  const ox = Math.abs(denomX) > 1e-8 ? (0.5 * (left - right)) / denomX : 0;
  const oy = Math.abs(denomY) > 1e-8 ? (0.5 * (up - down)) / denomY : 0;
  return { dx: bestX - 1 + ox, dy: bestY - 1 + oy };
}

function refineOne(
  img1: ImageData,
  img2: ImageData,
  match: Match,
  windowSize: number,
  maxShift: number,
  method: RefinementMethod,
): RefinedMatch {
  const a = toGrayPatch(img1, match.x1, match.y1, windowSize);
  const b = toGrayPatch(img2, match.x2, match.y2, windowSize);
  if (!a || !b) {
    return {
      ...match,
      x1_sub: match.x1,
      y1_sub: match.y1,
      x2_sub: match.x2,
      y2_sub: match.y2,
      refined: false,
      method,
      shiftMagnitude: 0,
    };
  }

  let best = -Infinity;
  let bestDx = 0;
  let bestDy = 0;
  for (let dy = -maxShift; dy <= maxShift; dy++) {
    for (let dx = -maxShift; dx <= maxShift; dx++) {
      const score = nccAt(a, b, dx, dy, windowSize);
      if (score > best) {
        best = score;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }

  // Local 3x3 quadratic refinement around the integer peak.
  const local: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      local[oy + 1][ox + 1] = nccAt(a, b, bestDx + ox, bestDy + oy, windowSize);
    }
  }
  const peak = quadraticPeak(local);
  const dx = bestDx + peak.dx;
  const dy = bestDy + peak.dy;
  const refinedMethod: RefinementMethod =
    method === "phase" ? "phase" : method === "ecc" ? "ecc" : "quadratic";

  return {
    ...match,
    x1_sub: match.x1,
    y1_sub: match.y1,
    x2_sub: match.x2 + dx,
    y2_sub: match.y2 + dy,
    refined: best > 0.15,
    method: refinedMethod,
    shiftMagnitude: Math.hypot(dx, dy),
  };
}

export async function refineMatchesSubPixel(
  img1: ImageData,
  img2: ImageData,
  inliers: Match[],
  options?: {
    windowSize?: number;
    maxShift?: number;
    usePhaseCorrelation?: boolean;
    method?: RefinementMethod;
    topN?: number;
  },
): Promise<RefinedMatch[]> {
  const windowSize = options?.windowSize ?? 21;
  const maxShift = options?.maxShift ?? 3;
  const method: RefinementMethod = options?.usePhaseCorrelation
    ? "phase"
    : options?.method ?? "quadratic";
  const topN = options?.topN ?? 50;
  const selected = [...inliers]
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, topN);

  // Yield to UI between batches.
  const out: RefinedMatch[] = [];
  for (let i = 0; i < selected.length; i++) {
    out.push(refineOne(img1, img2, selected[i], windowSize, maxShift, method));
    if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}

export function summarizeSubPixel(
  refined: RefinedMatch[],
  rmseBefore: number,
  rmseAfter: number,
): SubPixelSummary {
  const ok = refined.filter((m) => m.refined);
  const shifts = ok.map((m) => m.shiftMagnitude).sort((a, b) => a - b);
  const medianShift = shifts.length ? shifts[Math.floor(shifts.length / 2)] : 0;
  return {
    refinedCount: ok.length,
    attempted: refined.length,
    medianShift,
    rmseBefore,
    rmseAfter,
    method: refined[0]?.method ?? "quadratic",
  };
}
