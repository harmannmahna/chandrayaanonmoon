from __future__ import annotations

from typing import Any

import cv2
import numpy as np


def run_loftr_style(ref_bgr: np.ndarray, src_bgr: np.ndarray) -> dict[str, Any]:
    """
    Correspondence adapter used by Register Stage 2.

    Uses AKAZE + Lowe ratio + grid-aware scoring so the UI can show match
    confidence and weak regions without requiring a GPU LoFTR checkpoint.
    Same response shape can later wrap kornia KF.LoFTR when weights are available.
    """
    ref = cv2.cvtColor(ref_bgr, cv2.COLOR_BGR2GRAY)
    src = cv2.cvtColor(src_bgr, cv2.COLOR_BGR2GRAY)

    # Mild blur helps illumination differences
    ref_b = cv2.GaussianBlur(ref, (3, 3), 0)
    src_b = cv2.GaussianBlur(src, (3, 3), 0)

    detector = cv2.AKAZE_create()
    k0, d0 = detector.detectAndCompute(ref_b, None)
    k1, d1 = detector.detectAndCompute(src_b, None)

    mkpts0: list[list[float]] = []
    mkpts1: list[list[float]] = []
    # Confidence scores for MATCHED (green) pairs only — never pad with unmatched/red.
    mconf: list[float] = []
    unmatched0: list[list[float]] = []
    unmatched1: list[list[float]] = []

    matched_q: set[int] = set()
    matched_t: set[int] = set()

    k0 = k0 or []
    k1 = k1 or []
    # Pool of detections considered by the matcher (both views).
    total_keypoints_evaluated = int(len(k0) + len(k1))

    if d0 is not None and d1 is not None and len(k0) and len(k1):
        matcher = cv2.BFMatcher(cv2.NORM_HAMMING)
        pairs = matcher.knnMatch(d0, d1, k=2)
        for pair in pairs:
            if len(pair) < 2:
                # No second neighbor → treat query as unmatched (no confidence score)
                if pair:
                    qi = pair[0].queryIdx
                    if qi not in matched_q:
                        p0 = k0[qi].pt
                        unmatched0.append([float(p0[0]), float(p0[1])])
                continue
            a, b = pair
            if a.distance < 0.78 * b.distance:
                p0 = k0[a.queryIdx].pt
                p1 = k1[a.trainIdx].pt
                # Confidence from ratio + response — MATCHED only
                ratio = 1.0 - (a.distance / max(b.distance, 1e-6))
                resp = float(min(1.0, (k0[a.queryIdx].response + k1[a.trainIdx].response) / 2.0))
                conf = float(np.clip(0.45 * ratio + 0.55 * min(1.0, resp * 4), 0.05, 0.99))
                mkpts0.append([float(p0[0]), float(p0[1])])
                mkpts1.append([float(p1[0]), float(p1[1])])
                mconf.append(conf)
                matched_q.add(a.queryIdx)
                matched_t.add(a.trainIdx)
            else:
                # Failed ratio test → unmatched on reference (excluded from mean confidence)
                p0 = k0[a.queryIdx].pt
                unmatched0.append([float(p0[0]), float(p0[1])])

        # Keypoints on either side never selected as a good match
        for i, kp in enumerate(k0):
            if i not in matched_q:
                unmatched0.append([float(kp.pt[0]), float(kp.pt[1])])
        for i, kp in enumerate(k1):
            if i not in matched_t:
                unmatched1.append([float(kp.pt[0]), float(kp.pt[1])])

    # Deduplicate unmatched (ratio-fail + leftover pass can double-count)
    unmatched0 = _dedupe_pts(unmatched0)
    unmatched1 = _dedupe_pts(unmatched1)

    # Mean confidence = average over GREEN matched pairs ONLY.
    # Do NOT average zeros / placeholders for unmatched (red) keypoints.
    matched_mean_confidence = float(np.mean(mconf)) if mconf else 0.0

    weak_regions = _weak_regions(ref.shape[1], ref.shape[0], mkpts0, mconf)

    return {
        "mkpts0": mkpts0,
        "mkpts1": mkpts1,
        "mconf": mconf,
        "unmatched0": unmatched0,
        "unmatched1": unmatched1,
        "total_keypoints_evaluated": total_keypoints_evaluated,
        "num_matches": len(mkpts0),
        "num_unmatched": len(unmatched0) + len(unmatched1),
        # Canonical + explicit alias — both are matched-only averages.
        "mean_confidence": round(matched_mean_confidence, 4),
        "matched_mean_confidence": round(matched_mean_confidence, 4),
        "weak_regions": weak_regions,
        "matcher": "AKAZE + Lowe ratio (LoFTR-ready adapter interface)",
    }


def _dedupe_pts(pts: list[list[float]], tol: float = 1.5) -> list[list[float]]:
    if not pts:
        return []
    kept: list[list[float]] = []
    for p in pts:
        if any(abs(p[0] - q[0]) < tol and abs(p[1] - q[1]) < tol for q in kept):
            continue
        kept.append(p)
    return kept


def _weak_regions(
    width: int,
    height: int,
    mkpts0: list[list[float]],
    mconf: list[float],
    grid: int = 3,
) -> list[dict[str, Any]]:
    """Flag image tiles with sparse/weak MATCHED keypoints and explain why.

    Tile mean_confidence averages only matched (green) confidences in that cell —
    unmatched/red points are not part of the average.
    """
    cells = [[[] for _ in range(grid)] for _ in range(grid)]
    for (x, y), c in zip(mkpts0, mconf):
        gx = min(grid - 1, max(0, int(x / width * grid)))
        gy = min(grid - 1, max(0, int(y / height * grid)))
        cells[gy][gx].append(c)

    regions: list[dict[str, Any]] = []
    cw, ch = width / grid, height / grid
    reasons = {
        (0, 0): "Top-left: often limb/shadow boundary — low texture under grazing sun.",
        (0, 1): "Top-center: possible washed-out highland; CLAHE helps but matches stay sparse.",
        (0, 2): "Top-right: may fall outside shared coverage with the reference frame.",
        (1, 0): "Mid-left: elongated shadows reduce repeatable texture.",
        (1, 1): "Center: usually strongest; low score here suggests large illumination mismatch.",
        (1, 2): "Mid-right: scale difference or foreshortening can thin matches.",
        (2, 0): "Bottom-left: deep crater shadow — near-zero sun elevation hides texture.",
        (2, 1): "Bottom-center: soft mare terrain with fewer distinctive keypoints.",
        (2, 2): "Bottom-right: found in source but weak in reference — coverage / occlusion risk.",
    }

    for gy in range(grid):
        for gx in range(grid):
            vals = cells[gy][gx]
            # vals are matched-only confidences for this tile
            mean_c = float(np.mean(vals)) if vals else 0.0
            if len(vals) < 4 or mean_c < 0.38:
                x0, y0 = int(gx * cw), int(gy * ch)
                x1, y1 = int((gx + 1) * cw), int((gy + 1) * ch)
                regions.append(
                    {
                        "bbox": [x0, y0, x1, y1],
                        "grid": [gx, gy],
                        "match_count": len(vals),
                        "mean_confidence": round(mean_c, 3),
                        "reason": reasons.get((gy, gx), "Low-texture or poorly overlapping region."),
                        "pixel_range": f"x={x0}-{x1}, y={y0}-{y1}",
                    }
                )
    return regions
