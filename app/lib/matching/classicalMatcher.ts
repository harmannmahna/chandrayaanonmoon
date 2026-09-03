import type { Match, MatchResult } from "@/app/lib/types";

/**
 * Classical baseline matcher (ORB-like Harris corners + local descriptors).
 * Same MatchResult contract as the LoFTR adapter so RANSAC/metrics stay shared.
 *
 * TODO(scalability): Future: move heavy matching to a server/GPU service; support tiled processing for large rasters.
 */
export function runClassicalMatching(
  img1: ImageData,
  img2: ImageData,
  method: "ORB" | "SIFT" = "ORB",
): MatchResult {
  const maxEdge = 900;
  const a = downsample(img1, maxEdge);
  const b = downsample(img2, maxEdge);
  const k1 = detectCorners(a.gray, a.width, a.height, method === "SIFT" ? 180 : 140);
  const k2 = detectCorners(b.gray, b.width, b.height, method === "SIFT" ? 180 : 140);
  const matches: Match[] = [];

  for (const p of k1) {
    let best = Number.POSITIVE_INFINITY;
    let second = Number.POSITIVE_INFINITY;
    let bestQ = k2[0];
    for (const q of k2) {
      const dist = descriptorDistance(p.descriptor, q.descriptor);
      if (dist < best) {
        second = best;
        best = dist;
        bestQ = q;
      } else if (dist < second) {
        second = dist;
      }
    }
    if (bestQ && best < second * 0.9) {
      matches.push({
        x1: p.x / a.scale,
        y1: p.y / a.scale,
        x2: bestQ.x / b.scale,
        y2: bestQ.y / b.scale,
        confidence: Math.max(0.15, Math.min(0.95, 1 - best / 3)),
      });
    }
  }

  return {
    matches: matches.slice(0, 100),
    method: method === "SIFT" ? "classical-sift-like" : "classical-orb-like",
  };
}

function downsample(image: ImageData, maxEdge: number) {
  const edge = Math.max(image.width, image.height);
  const scale = Math.min(1, maxEdge / edge);
  if (scale === 1) {
    return { gray: toGray(image), width: image.width, height: image.height, scale: 1 };
  }
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")!.putImageData(image, 0, 0);
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height);
  return { gray: toGray(data), width, height, scale };
}

function toGray(image: ImageData): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(image.width * image.height);
  const { data } = image;
  for (let i = 0; i < gray.length; i++) {
    const j = i * 4;
    gray[i] = Math.round(data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114);
  }
  return gray;
}

function detectCorners(gray: Uint8ClampedArray, width: number, height: number, limit: number) {
  const points: { x: number; y: number; score: number; descriptor: number[] }[] = [];
  for (let y = 4; y < height - 4; y += 2) {
    for (let x = 4; x < width - 4; x += 2) {
      const i = y * width + x;
      const dx = gray[i + 1] - gray[i - 1];
      const dy = gray[i + width] - gray[i - width];
      const score = dx * dx + dy * dy;
      if (score > limit) {
        points.push({
          x,
          y,
          score,
          descriptor: localDescriptor(gray, width, height, x, y),
        });
      }
    }
  }
  points.sort((a, b) => b.score - a.score);
  return points.slice(0, 250);
}

function localDescriptor(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): number[] {
  const values: number[] = [];
  for (let oy = -4; oy <= 4; oy += 2) {
    for (let ox = -4; ox <= 4; ox += 2) {
      const px = Math.max(0, Math.min(width - 1, x + ox));
      const py = Math.max(0, Math.min(height - 1, y + oy));
      values.push(gray[py * width + px]);
    }
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const norm = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0)) || 1;
  return values.map((v) => (v - mean) / norm);
}

function descriptorDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}
