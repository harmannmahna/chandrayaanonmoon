import { calculateTerrainNormals } from "./craterTerrain";
import { getSunDirection } from "./solarMath";
import type { IlluminationGrid, IlluminationStats, SunState, TerrainGrid } from "./types";

/**
 * Illustrative synthetic terrain illumination; not a physical mission-grade
 * ray-tracing or photometric model.
 */
export function simulateCraterIllumination(terrain: TerrainGrid, sun: SunState): IlluminationGrid {
  const { width: w, height: h, heights } = terrain;
  const brightness = new Float32Array(w * h);
  const shadowMask = new Uint8Array(w * h);
  const normals = calculateTerrainNormals(terrain);
  const [sx, sy, sz] = getSunDirection(sun);

  // Lambert term
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const nx = normals[i * 3]!;
      const ny = normals[i * 3 + 1]!;
      const nz = normals[i * 3 + 2]!;
      const lambert = Math.max(0, nx * sx + ny * sy + nz * sz);
      brightness[i] = lambert;
    }
  }

  // Short directional occlusion sample along sun azimuth (approx shadow)
  const steps = 18;
  const stepLen = 1.1;
  const elevFactor = Math.max(0.05, Math.tan((Math.max(1, sun.elevationDeg) * Math.PI) / 180));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const h0 = heights[i]!;
      let shadowed = 0;
      for (let s = 1; s <= steps; s++) {
        const px = Math.round(x + sx * s * stepLen);
        const py = Math.round(y + sz * s * stepLen);
        if (px < 0 || py < 0 || px >= w || py >= h) break;
        const rise = s * stepLen * elevFactor * 0.02;
        if (heights[py * w + px]! > h0 + rise) {
          shadowed = 1;
          break;
        }
      }
      shadowMask[i] = shadowed;
      if (shadowed) brightness[i] *= 0.12;
      // Ambient floor
      brightness[i] = Math.min(1, brightness[i]! * 0.92 + 0.06);
    }
  }

  return { width: w, height: h, brightness, shadowMask };
}

export function summarizeIllumination(grid: IlluminationGrid): IlluminationStats {
  const n = grid.width * grid.height;
  let lit = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += grid.brightness[i]!;
    if (!grid.shadowMask[i] && grid.brightness[i]! > 0.18) lit++;
  }
  return {
    litFraction: lit / n,
    shadowFraction: 1 - lit / n,
    meanBrightness: sum / n,
  };
}

/** Count how often each cell is lit across azimuth samples (synthetic persistent-shadow proxy). */
export function accumulateIlluminationOverAzimuths(
  terrain: TerrainGrid,
  elevationDeg: number,
  azimuthSamples = 24,
): Float32Array {
  const n = terrain.width * terrain.height;
  const acc = new Float32Array(n);
  for (let k = 0; k < azimuthSamples; k++) {
    const az = (360 * k) / azimuthSamples;
    const grid = simulateCraterIllumination(terrain, { elevationDeg, azimuthDeg: az });
    for (let i = 0; i < n; i++) {
      if (!grid.shadowMask[i] && grid.brightness[i]! > 0.2) acc[i]! += 1;
    }
  }
  for (let i = 0; i < n; i++) acc[i]! /= azimuthSamples;
  return acc;
}
