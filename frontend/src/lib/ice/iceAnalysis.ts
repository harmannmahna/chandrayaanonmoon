import type {
  BooleanGrid,
  CraterDataset,
  Grid,
  IceAnalysisParams,
  IceAppQuality,
  IceCandidateCluster,
  IceEvidenceSummary,
} from "./types";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function normalizeGrid(grid: Grid): Grid {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < grid.values.length; i++) {
    const v = grid.values[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  const out = new Float32Array(grid.values.length);
  for (let i = 0; i < grid.values.length; i++) out[i] = (grid.values[i]! - min) / span;
  return { ...grid, values: out };
}

/** IceCandidate = (CPR > thr) AND (DOP < thr) AND DoublyShadowedMask */
export function computeRadarCandidateMask(dataset: CraterDataset, params: IceAnalysisParams): BooleanGrid {
  const n = dataset.width * dataset.height;
  const values = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const ok =
      dataset.cpr.values[i]! > params.cprThreshold &&
      dataset.dop.values[i]! < params.dopThreshold &&
      dataset.doublyShadowedMask.values[i] === 1;
    values[i] = ok ? 1 : 0;
  }
  return { width: dataset.width, height: dataset.height, values };
}

export function computeIceConfidence(dataset: CraterDataset, params: IceAnalysisParams): Grid {
  const n = dataset.width * dataset.height;
  const values = new Float32Array(n);
  const roughN = normalizeGrid(dataset.roughness);
  for (let i = 0; i < n; i++) {
    const cpr = dataset.cpr.values[i]!;
    const dop = dataset.dop.values[i]!;
    const inMask = dataset.doublyShadowedMask.values[i] === 1;
    const cprScore = clamp((cpr - params.cprThreshold) / 0.8, 0, 1);
    const dopScore = clamp((params.dopThreshold - dop) / Math.max(params.dopThreshold, 1e-6), 0, 1);
    const psrScore = inMask ? 1 : 0;
    const terrainScore = params.roughnessPenaltyEnabled ? 1 - roughN.values[i]! : 1;
    let conf = 0.45 * cprScore + 0.3 * dopScore + 0.15 * psrScore + 0.1 * terrainScore;
    if (!inMask) conf *= 0.05; // strongly reduce outside doubly-shadowed mask
    values[i] = conf;
  }
  return { width: dataset.width, height: dataset.height, cellSizeMeters: dataset.cellSizeMeters, values };
}

type Cell = { x: number; y: number };

export function connectedComponents(mask: BooleanGrid, minClusterCells: number): Cell[][] {
  const { width: w, height: h, values } = mask;
  const seen = new Uint8Array(w * h);
  const clusters: Cell[][] = [];
  const dirs = [-1, 0, 1];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (!values[start] || seen[start]) continue;
      const stack: Cell[] = [{ x, y }];
      seen[start] = 1;
      const cells: Cell[] = [];
      while (stack.length) {
        const c = stack.pop()!;
        cells.push(c);
        for (const dy of dirs) {
          for (const dx of dirs) {
            if (dx === 0 && dy === 0) continue;
            const nx = c.x + dx;
            const ny = c.y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const ni = ny * w + nx;
            if (!values[ni] || seen[ni]) continue;
            seen[ni] = 1;
            stack.push({ x: nx, y: ny });
          }
        }
      }
      if (cells.length >= minClusterCells) clusters.push(cells);
    }
  }
  return clusters;
}

export function extractIceClusters(
  dataset: CraterDataset,
  candidateMask: BooleanGrid,
  confidenceGrid: Grid,
  params: IceAnalysisParams,
): IceCandidateCluster[] {
  const groups = connectedComponents(candidateMask, params.minClusterCells);
  const cellArea = dataset.cellSizeMeters * dataset.cellSizeMeters;
  const clusters: IceCandidateCluster[] = groups.map((cells, i) => {
    let sumCpr = 0;
    let sumDop = 0;
    let sumConf = 0;
    let sumSlope = 0;
    let sx = 0;
    let sy = 0;
    for (const c of cells) {
      const id = c.y * dataset.width + c.x;
      sumCpr += dataset.cpr.values[id]!;
      sumDop += dataset.dop.values[id]!;
      sumConf += confidenceGrid.values[id]!;
      sumSlope += dataset.slopeDegrees.values[id]!;
      sx += c.x;
      sy += c.y;
    }
    const n = cells.length;
    const meanConfidence = sumConf / n;
    const areaM2 = n * cellArea;
    let priority: IceCandidateCluster["priority"] = "Low";
    if (meanConfidence >= 0.55 && areaM2 >= 800) priority = "High";
    else if (meanConfidence >= 0.4 || areaM2 >= 400) priority = "Medium";
    return {
      id: `ICE-${String(i + 1).padStart(2, "0")}`,
      cells,
      areaM2,
      centroid: { x: sx / n, y: sy / n },
      meanCPR: sumCpr / n,
      meanDOP: sumDop / n,
      meanConfidence,
      meanSlope: sumSlope / n,
      priority,
    };
  });
  clusters.sort((a, b) => b.meanConfidence * b.areaM2 - a.meanConfidence * a.areaM2);
  return clusters.filter((c) => c.meanConfidence >= params.confidenceThreshold * 0.5);
}

export function summarizeIceEvidence(
  clusters: IceCandidateCluster[],
  params: IceAnalysisParams,
): IceEvidenceSummary {
  if (!clusters.length) {
    return {
      totalCandidateAreaM2: 0,
      clusterCount: 0,
      bestCluster: null,
      quality: "Insufficient Data",
      warnings: ["No radar-consistent ice candidate clusters under current thresholds."],
      explanation: `No cells satisfied CPR > ${params.cprThreshold} AND DOP < ${params.dopThreshold} inside the doubly-shadowed mask with sufficient cluster size.`,
    };
  }
  const best = clusters[0]!;
  const totalCandidateAreaM2 = clusters.reduce((s, c) => s + c.areaM2, 0);
  let quality: IceAppQuality = "Low Evidence";
  if (best.priority === "High" && best.meanConfidence >= 0.55) quality = "High Evidence";
  else if (best.meanConfidence >= 0.4) quality = "Moderate Evidence";

  const warnings: string[] = [];
  if (quality === "High Evidence") {
    warnings.push("High Evidence still means a potential subsurface-ice signature — not confirmed ice.");
  }
  if (clusters.some((c) => c.meanSlope > 8)) {
    warnings.push("Some clusters sit on steeper floor slopes — traverse approach may be constrained.");
  }

  return {
    totalCandidateAreaM2,
    clusterCount: clusters.length,
    bestCluster: best,
    quality,
    warnings,
    explanation: `Candidate selected because its radar signature satisfies CPR > ${params.cprThreshold} and DOP < ${params.dopThreshold} inside the doubly-shadowed mask.`,
  };
}

export function runIceAnalysis(dataset: CraterDataset, params: IceAnalysisParams) {
  const candidateMask = computeRadarCandidateMask(dataset, params);
  const confidence = computeIceConfidence(dataset, params);
  const clusters = extractIceClusters(dataset, candidateMask, confidence, params);
  const summary = summarizeIceEvidence(clusters, params);
  return { candidateMask, confidence, clusters, summary };
}
