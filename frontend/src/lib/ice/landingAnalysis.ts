import type {
  CraterDataset,
  Grid,
  IceCandidateCluster,
  LandingCandidate,
  LandingParams,
} from "./types";
import { normalizeGrid } from "./iceAnalysis";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Approximate Euclidean distance transform to target cells (multi-source BFS + refine). */
export function computeDistanceTransformToTarget(
  targetCells: Array<{ x: number; y: number }>,
  width: number,
  height: number,
): Float32Array {
  const dist = new Float32Array(width * height).fill(1e9);
  if (!targetCells.length) return dist;
  const q: Array<{ x: number; y: number }> = [];
  for (const c of targetCells) {
    if (c.x < 0 || c.y < 0 || c.x >= width || c.y >= height) continue;
    const i = c.y * width + c.x;
    dist[i] = 0;
    q.push(c);
  }
  let qi = 0;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  while (qi < q.length) {
    const cur = q[qi++]!;
    const base = dist[cur.y * width + cur.x]!;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const step = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1;
      const ni = ny * width + nx;
      const nd = base + step;
      if (nd < dist[ni]!) {
        dist[ni] = nd;
        q.push({ x: nx, y: ny });
      }
    }
  }
  return dist;
}

function dilatePsr(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  if (radius <= 0) return mask;
  const out = new Uint8Array(mask);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          out[ny * w + nx] = 1;
        }
      }
    }
  }
  return out;
}

export function createLandingSuitabilityGrid(
  dataset: CraterDataset,
  targetCluster: IceCandidateCluster,
  params: LandingParams,
): Grid {
  const { width: w, height: h, cellSizeMeters } = dataset;
  const values = new Float32Array(w * h);
  const distCells = computeDistanceTransformToTarget(targetCluster.cells, w, h);
  let maxDist = 1;
  for (let i = 0; i < distCells.length; i++) {
    const d = distCells[i]!;
    if (d < 1e8 && d > maxDist) maxDist = d;
  }
  const slopeN = normalizeGrid(dataset.slopeDegrees);
  const roughN = normalizeGrid(dataset.roughness);
  const hazardN = normalizeGrid(dataset.hazard);
  const buffer = dilatePsr(dataset.doublyShadowedMask.values, w, h, params.craterBufferCells);

  const weightSum =
    params.slopeWeight +
    params.roughnessWeight +
    params.hazardWeight +
    params.illuminationWeight +
    params.targetDistanceWeight;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const slope = dataset.slopeDegrees.values[i]!;
      const haz = dataset.hazard.values[i]!;
      if (buffer[i] || slope >= params.rejectSlopeDeg || haz >= 0.7) {
        values[i] = 0;
        continue;
      }
      const slopeScore = 1 - slopeN.values[i]!;
      const roughnessScore = 1 - roughN.values[i]!;
      const hazardScore = 1 - hazardN.values[i]!;
      const illuminationScore = dataset.illumination.values[i]!;
      const distanceScore = 1 - clamp(distCells[i]! / maxDist, 0, 1);
      const raw =
        (params.slopeWeight * slopeScore +
          params.roughnessWeight * roughnessScore +
          params.hazardWeight * hazardScore +
          params.illuminationWeight * illuminationScore +
          params.targetDistanceWeight * distanceScore) /
        weightSum;
      values[i] = raw * 100;
    }
  }
  return { width: w, height: h, cellSizeMeters, values };
}

export function rankLandingCandidates(
  suitabilityGrid: Grid,
  dataset: CraterDataset,
  targetCluster: IceCandidateCluster,
  params: LandingParams,
  count = 5,
  minSeparationCells = 10,
): LandingCandidate[] {
  const { width: w, height: h, cellSizeMeters } = dataset;
  const distCells = computeDistanceTransformToTarget(targetCluster.cells, w, h);
  const ranked: Array<{ x: number; y: number; score: number }> = [];
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      const score = suitabilityGrid.values[i]!;
      if (score < 15) continue;
      // local maxima
      let isMax = true;
      for (let dy = -2; dy <= 2 && isMax; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (suitabilityGrid.values[(y + dy) * w + (x + dx)]! > score) isMax = false;
        }
      }
      if (isMax) ranked.push({ x, y, score });
    }
  }
  ranked.sort((a, b) => b.score - a.score);

  const picked: LandingCandidate[] = [];
  for (const p of ranked) {
    if (picked.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < minSeparationCells)) continue;
    const i = p.y * w + p.x;
    const slope = dataset.slopeDegrees.values[i]!;
    const roughness = dataset.roughness.values[i]!;
    const illumination = dataset.illumination.values[i]!;
    const hazard = dataset.hazard.values[i]!;
    const distanceToTargetMeters = distCells[i]! * cellSizeMeters;
    const reasons: string[] = [];
    if (slope <= params.preferredSlopeDeg) reasons.push("Low slope");
    else if (slope < params.rejectSlopeDeg) reasons.push("Moderate slope");
    if (illumination >= 0.6) reasons.push("High illumination");
    if (hazard < 0.2) reasons.push("Low roughness / hazard");
    reasons.push("Outside permanently shadowed zone");
    if (distanceToTargetMeters < 250) reasons.push("Near target");

    let status: LandingCandidate["status"] = "Feasible";
    if (p.score >= 70 && slope <= params.preferredSlopeDeg) status = "Preferred";
    else if (p.score < 40 || slope > params.preferredSlopeDeg + 2) status = "Risky";

    picked.push({
      id: `LZ-${String(picked.length + 1).padStart(2, "0")}`,
      x: p.x,
      y: p.y,
      score: Math.round(p.score * 10) / 10,
      slopeDegrees: slope,
      roughness,
      illumination,
      hazard,
      distanceToTargetMeters,
      status,
      reasons: reasons.slice(0, 4),
    });
    if (picked.length >= count) break;
  }
  return picked;
}
