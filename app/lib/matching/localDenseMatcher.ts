import type { Match, MatchResult } from "@/app/lib/types";

function toGray(image: ImageData): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(image.width * image.height);
  const { data } = image;
  for (let i = 0; i < gray.length; i++) {
    const j = i * 4;
    gray[i] = Math.round(data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114);
  }
  return gray;
}

function describe(gray: Uint8ClampedArray, width: number, height: number, x: number, y: number): number[] {
  const values: number[] = [];
  for (let oy = -6; oy <= 6; oy += 3) {
    for (let ox = -6; ox <= 6; ox += 3) {
      const px = Math.max(0, Math.min(width - 1, x + ox));
      const py = Math.max(0, Math.min(height - 1, y + oy));
      values.push(gray[py * width + px]);
    }
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const norm = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0)) || 1;
  return values.map((v) => (v - mean) / norm);
}

function distance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

/**
 * Lightweight dense-grid prototype matcher used by the LoFTR adapter in-browser.
 */
export function runLocalDenseMatcher(img1: ImageData, img2: ImageData): MatchResult {
  const g1 = toGray(img1);
  const g2 = toGray(img2);
  const cols = 12;
  const rows = 9;
  const points1: { x: number; y: number; d: number[] }[] = [];
  const points2: { x: number; y: number; d: number[] }[] = [];

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const x1 = Math.floor(((cx + 0.5) / cols) * img1.width);
      const y1 = Math.floor(((cy + 0.5) / rows) * img1.height);
      const x2 = Math.floor(((cx + 0.5) / cols) * img2.width);
      const y2 = Math.floor(((cy + 0.5) / rows) * img2.height);
      points1.push({ x: x1, y: y1, d: describe(g1, img1.width, img1.height, x1, y1) });
      points2.push({ x: x2, y: y2, d: describe(g2, img2.width, img2.height, x2, y2) });
    }
  }

  const matches: Match[] = [];
  for (const p of points1) {
    const ranked = points2
      .map((q) => ({ q, dist: distance(p.d, q.d) }))
      .sort((a, b) => a.dist - b.dist);
    if (ranked.length > 1 && ranked[0].dist < ranked[1].dist * 0.94) {
      matches.push({
        x1: p.x,
        y1: p.y,
        x2: ranked[0].q.x,
        y2: ranked[0].q.y,
        confidence: Math.max(0.2, Math.min(0.99, 1 - ranked[0].dist / 2.2)),
      });
    }
  }

  return { matches: matches.slice(0, 120), method: "loftr-adapter-local-dense" };
}
