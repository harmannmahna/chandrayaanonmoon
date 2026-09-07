import type { TerrainGrid } from "./types";

/** Mulberry32 for deterministic demo terrain. */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic synthetic crater height map (bowl + rim + a few rocks/ridges).
 * Educational only — not a lunar DEM product.
 */
export function generateSyntheticCraterTerrain(width = 128, height = 128, seed = 26166): TerrainGrid {
  const rand = mulberry32(seed);
  const heights = new Float32Array(width * height);
  const cx = (width - 1) * 0.5;
  const cy = (height - 1) * 0.52;
  const radius = Math.min(width, height) * 0.32;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const dx = (x - cx) / radius;
      const dy = (y - cy) / radius;
      const r = Math.hypot(dx, dy);
      let h = 0.42 + 0.03 * Math.sin(x * 0.08) * Math.cos(y * 0.07);

      if (r < 1.15) {
        // Rim bulge
        const rim = Math.exp(-((r - 1.0) ** 2) / 0.018) * 0.28;
        // Bowl floor
        const bowl = r < 1 ? -0.35 * (1 - r * r) : 0;
        h += rim + bowl;
      }

      // Small rocks / ridges
      heights[i] = h + (rand() - 0.5) * 0.012;
    }
  }

  // Explicit boulder bumps
  const rocks = [
    { x: cx - radius * 0.35, y: cy + radius * 0.15, s: 3.2, a: 0.09 },
    { x: cx + radius * 0.4, y: cy - radius * 0.1, s: 2.6, a: 0.07 },
    { x: cx + radius * 0.1, y: cy + radius * 0.45, s: 4.0, a: 0.06 },
  ];
  for (const rock of rocks) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const d = Math.hypot(x - rock.x, y - rock.y);
        if (d < rock.s * 2) {
          heights[y * width + x]! += rock.a * Math.exp(-(d * d) / (rock.s * rock.s));
        }
      }
    }
  }

  return { width, height, heights };
}

/** Approximate per-cell normals from height gradients (z up). */
export function calculateTerrainNormals(terrain: TerrainGrid): Float32Array {
  const { width: w, height: h, heights } = terrain;
  const normals = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = heights[y * w + Math.max(0, x - 1)]!;
      const x1 = heights[y * w + Math.min(w - 1, x + 1)]!;
      const y0 = heights[Math.max(0, y - 1) * w + x]!;
      const y1 = heights[Math.min(h - 1, y + 1) * w + x]!;
      let nx = x0 - x1;
      let ny = y0 - y1;
      let nz = 2 / Math.max(w, h);
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * w + x) * 3;
      normals[i] = nx;
      normals[i + 1] = nz; // map height-gradient into "up"
      normals[i + 2] = ny;
    }
  }
  return normals;
}
