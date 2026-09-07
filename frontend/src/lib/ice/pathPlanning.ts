import type { CraterDataset, RouteParams, RoverRoute } from "./types";

type Node = { x: number; y: number; g: number; f: number; px: number; py: number };

class MinHeap {
  private a: Node[] = [];
  get size() {
    return this.a.length;
  }
  push(n: Node) {
    this.a.push(n);
    this.up(this.a.length - 1);
  }
  pop(): Node | undefined {
    if (!this.a.length) return;
    const top = this.a[0]!;
    const last = this.a.pop()!;
    if (this.a.length) {
      this.a[0] = last;
      this.down(0);
    }
    return top;
  }
  private up(i: number) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[i]!.f >= this.a[p]!.f) break;
      [this.a[i], this.a[p]] = [this.a[p]!, this.a[i]!];
      i = p;
    }
  }
  private down(i: number) {
    for (;;) {
      let s = i;
      const l = i * 2 + 1;
      const r = l + 1;
      if (l < this.a.length && this.a[l]!.f < this.a[s]!.f) s = l;
      if (r < this.a.length && this.a[r]!.f < this.a[s]!.f) s = r;
      if (s === i) break;
      [this.a[i], this.a[s]] = [this.a[s]!, this.a[i]!];
      i = s;
    }
  }
}

function key(x: number, y: number) {
  return `${x},${y}`;
}

export function isTraversable(
  dataset: CraterDataset,
  x: number,
  y: number,
  routeParams: RouteParams,
  allowPsrEntry: boolean,
): boolean {
  const { width: w, height: h } = dataset;
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  const i = y * w + x;
  if (dataset.hazard.values[i]! >= 0.85) return false;
  if (dataset.slopeDegrees.values[i]! >= routeParams.hardRejectSlopeDeg) return false;
  if (dataset.doublyShadowedMask.values[i] && !allowPsrEntry) {
    // allow only near goal approach — caller gates goal cells
    return false;
  }
  if (routeParams.mode === "solar-aware" && dataset.illumination.values[i]! < 0.05 && !allowPsrEntry) {
    // Soft reject extreme shadow in solar-aware (still allow via cost if needed for approach)
    // Hard block only near-zero illumination away from PSR approach.
    if (dataset.illumination.values[i]! < 0.03) return false;
  }
  return true;
}

export function computeTraversalCost(
  dataset: CraterDataset,
  x: number,
  y: number,
  routeParams: RouteParams,
  stepDist: number,
): number {
  const i = y * dataset.width + x;
  const slopeN = Math.min(1, dataset.slopeDegrees.values[i]! / routeParams.hardRejectSlopeDeg);
  const rough = dataset.roughness.values[i]!;
  const haz = dataset.hazard.values[i]!;
  const shadow = 1 - dataset.illumination.values[i]!;
  let shadowW = routeParams.shadowWeight;
  if (routeParams.mode === "science-first") shadowW *= 0.35;
  if (routeParams.mode === "solar-aware") shadowW *= 1.6;
  if (routeParams.mode === "battery-supported") shadowW *= 0.85;
  return (
    routeParams.distanceWeight * stepDist +
    routeParams.slopeWeight * slopeN +
    routeParams.roughnessWeight * rough +
    routeParams.hazardWeight * haz +
    shadowW * shadow
  );
}

export function planAStarRoute(
  dataset: CraterDataset,
  start: { x: number; y: number },
  goal: { x: number; y: number },
  params: RouteParams,
): RoverRoute | null {
  const { width: w, height: h, cellSizeMeters } = dataset;
  const allowPsr = (x: number, y: number) => {
    // Permit PSR approach into the ice target neighborhood
    return Math.hypot(x - goal.x, y - goal.y) <= 18;
  };
  const trav = (x: number, y: number) => {
    if (x === goal.x && y === goal.y) return true;
    if (x === start.x && y === start.y) return true;
    const i = y * w + x;
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    if (dataset.hazard.values[i]! >= 0.92) return false;
    if (dataset.slopeDegrees.values[i]! > params.hardRejectSlopeDeg) return false;
    if (dataset.doublyShadowedMask.values[i]) return allowPsr(x, y);
    if (params.mode === "solar-aware" && dataset.illumination.values[i]! < 0.025) return false;
    return true;
  };

  const open = new MinHeap();
  const gScore = new Map<string, number>();
  const came = new Map<string, { x: number; y: number }>();
  const hCost = (x: number, y: number) => Math.hypot(x - goal.x, y - goal.y);
  const sk = key(start.x, start.y);
  gScore.set(sk, 0);
  open.push({ x: start.x, y: start.y, g: 0, f: hCost(start.x, start.y), px: -1, py: -1 });

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

  let found = false;
  let guard = 0;
  while (open.size && guard++ < w * h * 8) {
    const cur = open.pop()!;
    if (cur.x === goal.x && cur.y === goal.y) {
      found = true;
      break;
    }
    const ck = key(cur.x, cur.y);
    if ((gScore.get(ck) ?? Infinity) < cur.g - 1e-9) continue;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!trav(nx, ny)) continue;
      const step = (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1) * cellSizeMeters;
      const stepCost = computeTraversalCost(dataset, nx, ny, params, step / cellSizeMeters);
      const ng = cur.g + stepCost;
      const nk = key(nx, ny);
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        came.set(nk, { x: cur.x, y: cur.y });
        open.push({ x: nx, y: ny, g: ng, f: ng + hCost(nx, ny) * params.distanceWeight, px: cur.x, py: cur.y });
      }
    }
  }

  if (!found) return null;

  const cells: Array<{ x: number; y: number }> = [];
  let cur: { x: number; y: number } | undefined = goal;
  while (cur) {
    cells.push(cur);
    cur = came.get(key(cur.x, cur.y));
  }
  cells.reverse();

  let distanceMeters = 0;
  let maxSlope = 0;
  let sumSlope = 0;
  let shadowDistance = 0;
  let hazardCells = 0;
  let cost = gScore.get(key(goal.x, goal.y)) ?? 0;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!;
    const id = c.y * w + c.x;
    const slope = dataset.slopeDegrees.values[id]!;
    maxSlope = Math.max(maxSlope, slope);
    sumSlope += slope;
    if (dataset.illumination.values[id]! < 0.25) {
      if (i > 0) {
        const p = cells[i - 1]!;
        shadowDistance += Math.hypot(c.x - p.x, c.y - p.y) * cellSizeMeters;
      }
    }
    if (dataset.hazard.values[id]! > 0.4) hazardCells++;
    if (i > 0) {
      const p = cells[i - 1]!;
      distanceMeters += Math.hypot(c.x - p.x, c.y - p.y) * cellSizeMeters;
    }
  }
  const shadowFraction = distanceMeters > 0 ? shadowDistance / distanceMeters : 0;
  const warnings: string[] = [];
  let feasibility: RoverRoute["feasibility"] = "Feasible";
  if (params.mode === "battery-supported" && shadowDistance > params.batteryShadowBudgetMeters) {
    feasibility = shadowDistance > params.batteryShadowBudgetMeters * 1.5 ? "Infeasible" : "Conditional";
    warnings.push(
      `Shadow traverse ${shadowDistance.toFixed(0)} m exceeds battery shadow budget ${params.batteryShadowBudgetMeters} m.`,
    );
  }
  if (maxSlope > params.maxRoverSlopeDeg) {
    feasibility = feasibility === "Feasible" ? "Conditional" : feasibility;
    warnings.push(`Peak slope ${maxSlope.toFixed(1)}° exceeds preferred max rover slope ${params.maxRoverSlopeDeg}°.`);
  }
  if (hazardCells > 0) warnings.push(`Route brushes ${hazardCells} elevated-hazard cells.`);

  return {
    cells,
    distanceMeters,
    maxSlopeDegrees: maxSlope,
    meanSlopeDegrees: sumSlope / cells.length,
    shadowDistanceMeters: shadowDistance,
    shadowFraction,
    hazardCellsEncountered: hazardCells,
    estimatedCost: cost,
    feasibility,
    warnings,
  };
}
