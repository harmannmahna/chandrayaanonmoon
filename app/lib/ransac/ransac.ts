import type { Match, RANSACResult } from "@/app/lib/types";

function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];
    if (Math.abs(m[col][col]) < 1e-10) return null;
    const div = m[col][col];
    for (let j = col; j <= n; j++) m[col][j] /= div;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row][col];
      for (let j = col; j <= n; j++) m[row][j] -= factor * m[col][j];
    }
  }
  return m.map((row) => row[n]);
}

export function project(H: number[] | number[][], x: number, y: number): { x: number; y: number } {
  const h = Array.isArray(H[0]) ? (H as number[][]).flat() : (H as number[]);
  const d = h[6] * x + h[7] * y + h[8];
  return {
    x: (h[0] * x + h[1] * y + h[2]) / d,
    y: (h[3] * x + h[4] * y + h[5]) / d,
  };
}

export function matrix3(h: number[]): number[][] {
  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], h[8]],
  ];
}

function homographyFrom(matches: Match[]): number[] | null {
  if (matches.length < 4) return null;
  const A: number[][] = [];
  const b: number[] = [];
  for (const m of matches) {
    const { x1: x, y1: y, x2: u, y2: v } = m;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  if (A.length === 8) {
    const h = solveLinear(A, b);
    return h ? [...h, 1] : null;
  }
  const AtA = Array.from({ length: 8 }, () => Array(8).fill(0));
  const Atb = Array(8).fill(0);
  for (let r = 0; r < A.length; r++) {
    for (let i = 0; i < 8; i++) {
      Atb[i] += A[r][i] * b[r];
      for (let j = 0; j < 8; j++) AtA[i][j] += A[r][i] * A[r][j];
    }
  }
  const h = solveLinear(AtA, Atb);
  return h ? [...h, 1] : null;
}

export function runRANSAC(
  matches: Match[],
  _img1Size?: { width: number; height: number },
  _img2Size?: { width: number; height: number },
  threshold = 5,
  iterations = 700,
): RANSACResult {
  if (matches.length < 4) {
    return { H: null, inliers: [], outlierCount: matches.length };
  }

  let best: Match[] = [];
  for (let iteration = 0; iteration < iterations; iteration++) {
    const selected: Match[] = [];
    while (selected.length < 4) {
      const item = matches[Math.floor(Math.random() * matches.length)];
      if (!selected.includes(item)) selected.push(item);
    }
    const h = homographyFrom(selected);
    if (!h) continue;
    const inliers = matches.filter((m) => {
      const p = project(h, m.x1, m.y1);
      return Number.isFinite(p.x) && Math.hypot(p.x - m.x2, p.y - m.y2) <= threshold;
    });
    if (inliers.length > best.length) best = inliers;
  }

  const h = homographyFrom(best.length >= 4 ? best : matches.slice(0, 4));
  if (!h) return { H: null, inliers: [], outlierCount: matches.length };
  const inliers = matches.filter((m) => {
    const p = project(h, m.x1, m.y1);
    return Math.hypot(p.x - m.x2, p.y - m.y2) <= threshold;
  });
  return {
    H: matrix3(h),
    inliers,
    outlierCount: matches.length - inliers.length,
  };
}

export function invertHomography(H: number[][]): number[][] | null {
  const [a, b, c] = H[0];
  const [d, e, f] = H[1];
  const [g, h, i] = H[2];
  const A = e * i - f * h;
  const B = c * h - b * i;
  const C = b * f - c * e;
  const D = f * g - d * i;
  const E = a * i - c * g;
  const F = c * d - a * f;
  const G = d * h - e * g;
  const Hh = b * g - a * h;
  const I = a * e - b * d;
  const det = a * A + b * D + c * G;
  if (Math.abs(det) < 1e-12) return null;
  return [
    [A / det, B / det, C / det],
    [D / det, E / det, F / det],
    [G / det, Hh / det, I / det],
  ];
}
