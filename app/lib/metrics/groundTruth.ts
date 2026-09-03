import { project } from "@/app/lib/ransac/ransac";

export interface GroundTruthValidation {
  H_gt: number[][];
  H_est: number[][];
  elementWiseAbsDiff: number[][];
  meanAbsDiff: number;
  maxCornerError: number;
  meanCornerError: number;
  note: string;
}

export function compareHomographies(
  H_est: number[][],
  H_gt: number[][],
  width: number,
  height: number,
): GroundTruthValidation {
  const elementWiseAbsDiff = H_est.map((row, r) => row.map((v, c) => Math.abs(v - H_gt[r][c])));
  const flat = elementWiseAbsDiff.flat();
  const meanAbsDiff = flat.reduce((a, b) => a + b, 0) / flat.length;
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  const errors = corners.map(([x, y]) => {
    const a = project(H_est, x, y);
    const b = project(H_gt, x, y);
    return Math.hypot(a.x - b.x, a.y - b.y);
  });
  return {
    H_gt,
    H_est,
    elementWiseAbsDiff,
    meanAbsDiff,
    maxCornerError: Math.max(...errors),
    meanCornerError: errors.reduce((a, b) => a + b, 0) / errors.length,
    note: "This demonstrates internal consistency on a controlled synthetic pair. Real data lacks exact ground truth.",
  };
}
