import type { BooleanGrid, CraterDataset, Grid } from "./types";

/** Mulberry32 seeded PRNG — stable demo across reloads. */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGrid(w: number, h: number, cellSizeMeters: number, fill = 0): Grid {
  return { width: w, height: h, cellSizeMeters, values: new Float32Array(w * h).fill(fill) };
}

function makeBool(w: number, h: number): BooleanGrid {
  return { width: w, height: h, values: new Uint8Array(w * h) };
}

function idx(x: number, y: number, w: number) {
  return y * w + x;
}

/**
 * Illustrative demo grid — not calibrated Chandrayaan-2 DFSAR data.
 * Deterministic 160×160 doubly-shadowed crater with radar-consistent ice candidates.
 */
export function buildDemoCraterDataset(seed = 26166): CraterDataset {
  const W = 160;
  const H = 160;
  const cell = 5; // 5 m / cell → 800 m scene
  const rand = mulberry32(seed);

  const cpr = makeGrid(W, H, cell, 0.55);
  const dop = makeGrid(W, H, cell, 0.35);
  const slope = makeGrid(W, H, cell, 4);
  const rough = makeGrid(W, H, cell, 0.25);
  const illum = makeGrid(W, H, cell, 0.65);
  const hazard = makeGrid(W, H, cell, 0.08);
  const psr = makeBool(W, H);

  const cx = W * 0.48;
  const cy = H * 0.52;
  const rx = W * 0.28;
  const ry = H * 0.24;

  // Landing plateau (NW) — flat, illuminated, low hazard — bias scores via very low slope/hazard
  const lzCx = W * 0.22;
  const lzCy = H * 0.28;
  const lzR = W * 0.16;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y, W);
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const r2 = nx * nx + ny * ny;
      const inCrater = r2 < 1.05;
      const rim = Math.abs(r2 - 1) < 0.12;
      const floor = r2 < 0.72;

      // Doubly-shadowed floor mask (inner bowl)
      const shadowCore = r2 < 0.55 && ny > -0.15;
      if (shadowCore) psr.values[i] = 1;

      // Terrain
      if (rim) {
        slope.values[i] = 14 + rand() * 8;
        rough.values[i] = 0.55 + rand() * 0.3;
        hazard.values[i] = 0.35 + rand() * 0.4;
        illum.values[i] = 0.45 + rand() * 0.2;
      } else if (floor) {
        slope.values[i] = 2 + rand() * 5;
        rough.values[i] = 0.15 + rand() * 0.25;
        illum.values[i] = shadowCore ? 0.05 + rand() * 0.12 : 0.25 + rand() * 0.2;
        hazard.values[i] = 0.05 + rand() * 0.15;
      } else {
        slope.values[i] = 3 + rand() * 6;
        rough.values[i] = 0.2 + rand() * 0.25;
        illum.values[i] = 0.55 + rand() * 0.35;
        hazard.values[i] = 0.05 + rand() * 0.2;
      }

      // Background CPR/DOP noise
      cpr.values[i] = 0.45 + rand() * 0.35;
      dop.values[i] = 0.28 + rand() * 0.25;

      // Landing plateau override
      const dlx = (x - lzCx) / lzR;
      const dly = (y - lzCy) / lzR;
      if (dlx * dlx + dly * dly < 1) {
        slope.values[i] = 1.5 + rand() * 2.5;
        rough.values[i] = 0.08 + rand() * 0.1;
        hazard.values[i] = 0.02 + rand() * 0.06;
        illum.values[i] = 0.75 + rand() * 0.2;
      }

      // Rocky false-positive CPR outside mask (NE)
      if (!inCrater && x > W * 0.7 && y < H * 0.35) {
        cpr.values[i] = 1.2 + rand() * 0.4;
        dop.values[i] = 0.22 + rand() * 0.15;
        hazard.values[i] = 0.55 + rand() * 0.35;
        rough.values[i] = 0.6 + rand() * 0.3;
      }
    }
  }

  // Ice-like pockets inside PSR: high CPR, low DOP
  const pockets = [
    { x: cx - 8, y: cy + 6, r: 7 },
    { x: cx + 10, y: cy + 12, r: 6 },
    { x: cx - 2, y: cy + 18, r: 5 },
    { x: cx + 4, y: cy + 2, r: 4.5 },
  ];
  for (const p of pockets) {
    for (let y = Math.floor(p.y - p.r - 1); y <= p.y + p.r + 1; y++) {
      for (let x = Math.floor(p.x - p.r - 1); x <= p.x + p.r + 1; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const d = Math.hypot(x - p.x, y - p.y);
        if (d > p.r) continue;
        const i = idx(x, y, W);
        if (!psr.values[i]) continue;
        const t = 1 - d / p.r;
        cpr.values[i] = 1.15 + t * 0.55 + rand() * 0.08;
        dop.values[i] = 0.04 + (1 - t) * 0.06 + rand() * 0.02;
        rough.values[i] = Math.min(rough.values[i], 0.2);
      }
    }
  }

  // Hazard corridor between LZ and crater to force interesting A*
  for (let y = 40; y < 90; y++) {
    for (let x = 55; x < 72; x++) {
      const i = idx(x, y, W);
      if (psr.values[i]) continue;
      hazard.values[i] = 0.75 + rand() * 0.2;
      slope.values[i] = 16 + rand() * 6;
    }
  }

  // Dark band for solar-aware routing contrast
  for (let y = 55; y < 100; y++) {
    for (let x = 95; x < 115; x++) {
      const i = idx(x, y, W);
      if (psr.values[i]) continue;
      illum.values[i] = Math.min(illum.values[i], 0.12 + rand() * 0.1);
    }
  }

  return {
    id: "doubly_shadowed_crater_demo",
    name: "Doubly Shadowed Crater Demo",
    description:
      "Illustrative south-pole-style crater with PSR floor, radar-consistent ice candidate pockets, and a flat illuminated landing plateau.",
    sourceLabel: "Illustrative demo grid — not calibrated Chandrayaan-2 DFSAR data.",
    isSynthetic: true,
    width: W,
    height: H,
    cellSizeMeters: cell,
    cpr,
    dop,
    slopeDegrees: slope,
    roughness: rough,
    illumination: illum,
    hazard,
    doublyShadowedMask: psr,
  };
}
