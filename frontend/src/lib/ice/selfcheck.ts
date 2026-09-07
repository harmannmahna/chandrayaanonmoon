/**
 * Lightweight deterministic checks for LUNA/ICE core logic.
 * Run: npx tsx src/lib/ice/selfcheck.ts  (or via npm run ice:selfcheck)
 */
import { buildDemoCraterDataset } from "./demoData";
import {
  computeRadarCandidateMask,
  connectedComponents,
  runIceAnalysis,
} from "./iceAnalysis";
import { createLandingSuitabilityGrid, rankLandingCandidates } from "./landingAnalysis";
import { planAStarRoute } from "./pathPlanning";
import { computeIceVolumeScenario } from "./volumeEstimator";
import { DEFAULT_ICE_PARAMS, DEFAULT_LANDING_PARAMS, DEFAULT_ROUTE_PARAMS } from "./types";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const ds = buildDemoCraterDataset(26166);
const params = { ...DEFAULT_ICE_PARAMS };

// 1. Candidate logic
{
  const mask = computeRadarCandidateMask(ds, params);
  let insideOk = false;
  let outsideHighCprRejected = true;
  for (let i = 0; i < mask.values.length; i++) {
    const cpr = ds.cpr.values[i]!;
    const dop = ds.dop.values[i]!;
    const psr = ds.doublyShadowedMask.values[i] === 1;
    if (cpr > 1 && dop < 0.13 && psr) {
      assert(mask.values[i] === 1, "inside mask high CPR low DOP should be candidate");
      insideOk = true;
    }
    if (cpr > 1 && !psr && mask.values[i] === 1) outsideHighCprRejected = false;
    if (cpr > 1 && dop >= 0.13 && mask.values[i] === 1) {
      throw new Error("high CPR with DOP>=0.13 must be rejected");
    }
  }
  assert(insideOk, "expected at least one in-mask candidate");
  assert(outsideHighCprRejected, "high CPR outside mask must not be candidate");
}

// 2. Cluster filtering
{
  const tiny = { width: 4, height: 4, values: new Uint8Array(16) };
  tiny.values[0] = 1;
  tiny.values[1] = 1;
  assert(connectedComponents(tiny, 3).length === 0, "tiny cluster filtered");
  tiny.values[4] = 1;
  assert(connectedComponents(tiny, 3).length === 1, "larger cluster retained");
}

// 3. Landing
{
  const { clusters } = runIceAnalysis(ds, params);
  assert(clusters.length > 0, "demo should yield clusters");
  const grid = createLandingSuitabilityGrid(ds, clusters[0]!, DEFAULT_LANDING_PARAMS);
  for (let i = 0; i < grid.values.length; i++) {
    if (ds.doublyShadowedMask.values[i]) assert(grid.values[i] === 0, "PSR rejected for landing");
    if (ds.slopeDegrees.values[i]! >= DEFAULT_LANDING_PARAMS.rejectSlopeDeg) {
      assert(grid.values[i] === 0, "steep rejected");
    }
  }
  const lz = rankLandingCandidates(grid, ds, clusters[0]!, DEFAULT_LANDING_PARAMS);
  assert(lz.length > 0, "expected landing candidates");
}

// 4. Pathfinding
{
  const { clusters } = runIceAnalysis(ds, params);
  const grid = createLandingSuitabilityGrid(ds, clusters[0]!, DEFAULT_LANDING_PARAMS);
  const lz = rankLandingCandidates(grid, ds, clusters[0]!, DEFAULT_LANDING_PARAMS)[0]!;
  const goal = { x: Math.round(clusters[0]!.centroid.x), y: Math.round(clusters[0]!.centroid.y) };
  const sci = planAStarRoute(ds, { x: lz.x, y: lz.y }, goal, { ...DEFAULT_ROUTE_PARAMS, mode: "science-first", shadowWeight: 0.3 });
  const sol = planAStarRoute(ds, { x: lz.x, y: lz.y }, goal, { ...DEFAULT_ROUTE_PARAMS, mode: "solar-aware", shadowWeight: 2.2 });
  assert(sci, "science-first route exists");
  assert(sol, "solar-aware route exists");
  assert(sol!.shadowDistanceMeters <= sci!.shadowDistanceMeters + 1e-6, "solar-aware should not increase dark exposure vs science-first when both exist");
}

// 5. Volume
{
  const v = computeIceVolumeScenario(1000, { assumedDepthMeters: 2, iceFraction: 0.5, densityKgPerM3: 917 }, "Custom");
  assert(Math.abs(v.volumeM3 - 1000) < 1e-6, "volume formula");
  assert(Math.abs(v.massKg - 917000) < 1e-3, "mass formula");
  let threw = false;
  try {
    computeIceVolumeScenario(10, { assumedDepthMeters: 6, iceFraction: 0.1, densityKgPerM3: 917 }, "Custom");
  } catch {
    threw = true;
  }
  assert(threw, "invalid depth rejected");
}

console.log("LUNA/ICE selfcheck: all assertions passed");
