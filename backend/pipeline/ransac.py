from __future__ import annotations

from typing import Any

import cv2
import numpy as np


def run_ransac(
    ref_bgr: np.ndarray,
    src_bgr: np.ndarray,
    mkpts0: list[list[float]],
    mkpts1: list[list[float]],
    mconf: list[float] | None = None,
) -> dict[str, Any]:
    pts0 = np.asarray(mkpts0, dtype=np.float32)
    pts1 = np.asarray(mkpts1, dtype=np.float32)
    if len(pts0) < 4:
        H = np.eye(3, dtype=np.float64)
        inlier_mask = np.zeros((len(pts0),), dtype=bool)
        rmse = 999.0
        inlier_ratio = 0.0
    else:
        H, mask = cv2.findHomography(pts1, pts0, cv2.RANSAC, ransacReprojThreshold=3.0, maxIters=5000)
        if H is None:
            H = np.eye(3, dtype=np.float64)
            inlier_mask = np.zeros((len(pts0),), dtype=bool)
        else:
            inlier_mask = mask.ravel().astype(bool)
        if inlier_mask.any():
            proj = _project(pts1[inlier_mask], H)
            err = np.linalg.norm(proj - pts0[inlier_mask], axis=1)
            rmse = float(np.sqrt(np.mean(err**2)))
        else:
            rmse = 999.0
        inlier_ratio = float(inlier_mask.mean()) if len(inlier_mask) else 0.0

    h, w = ref_bgr.shape[:2]
    warped = cv2.warpPerspective(src_bgr, H, (w, h))
    overlay = cv2.addWeighted(ref_bgr, 0.5, warped, 0.5, 0)
    tint = _tint_overlay(ref_bgr, warped)

    coverage = _spatial_coverage(inlier_mask, pts0, w, h)
    rot, scale, tx, ty = _decompose(H)
    conclusion = _conclusion(rot, scale, tx, ty, coverage, rmse, inlier_ratio, len(pts0))

    return {
        "H": H.astype(np.float64),
        "inlier_ratio": round(inlier_ratio, 4),
        "inlier_count": int(inlier_mask.sum()) if len(inlier_mask) else 0,
        "rmse_px": round(rmse, 3),
        "spatial_coverage": round(coverage, 4),
        "rotation_deg": round(rot, 3),
        "scale": round(scale, 4),
        "translation_px": [round(tx, 2), round(ty, 2)],
        "warped": warped,
        "overlay": overlay,
        "tint_overlay": tint,
        "conclusion": conclusion,
    }


def _project(pts: np.ndarray, H: np.ndarray) -> np.ndarray:
    ones = np.ones((len(pts), 1), dtype=np.float64)
    hp = np.hstack([pts.astype(np.float64), ones])
    proj = (H @ hp.T).T
    proj = proj[:, :2] / np.maximum(proj[:, 2:3], 1e-8)
    return proj


def _spatial_coverage(mask: np.ndarray, pts0: np.ndarray, w: int, h: int, grid: int = 4) -> float:
    if len(pts0) == 0 or not mask.any():
        return 0.0
    filled = set()
    for (x, y), keep in zip(pts0, mask):
        if not keep:
            continue
        gx = min(grid - 1, max(0, int(x / w * grid)))
        gy = min(grid - 1, max(0, int(y / h * grid)))
        filled.add((gx, gy))
    return len(filled) / float(grid * grid)


def _decompose(H: np.ndarray) -> tuple[float, float, float, float]:
    """Extract rough rotation (deg), scale, and translation from homography."""
    H = H / (H[2, 2] + 1e-12)
    A = H[:2, :2]
    # Polar-ish decomposition via SVD
    U, S, Vt = np.linalg.svd(A)
    R = U @ Vt
    if np.linalg.det(R) < 0:
        U[:, -1] *= -1
        R = U @ Vt
    rot = float(np.degrees(np.arctan2(R[1, 0], R[0, 0])))
    scale = float(np.sqrt(max(S[0] * S[1], 0)))
    tx, ty = float(H[0, 2]), float(H[1, 2])
    return rot, scale, tx, ty


def _tint_overlay(ref: np.ndarray, warped: np.ndarray) -> np.ndarray:
    """Cyan reference + yellow warped — aligned areas look neutral; misalignment fringes."""
    ref_f = ref.astype(np.float32)
    war_f = warped.astype(np.float32)
    cyan = ref_f.copy()
    cyan[:, :, 2] *= 0.35  # reduce red
    yellow = war_f.copy()
    yellow[:, :, 0] *= 0.35  # reduce blue
    blend = np.clip(0.55 * cyan + 0.55 * yellow, 0, 255).astype(np.uint8)
    return blend


def _conclusion(
    rot: float,
    scale: float,
    tx: float,
    ty: float,
    coverage: float,
    rmse: float,
    inlier_ratio: float,
    n_matches: int,
) -> str:
    shadow_note = (
        "Shadows likely differ between frames (sun-angle change), which explains weak patches "
        "in crater floors."
        if inlier_ratio < 0.55 or n_matches < 40
        else "Illumination is similar enough that dense matches remain stable across most tiles."
    )
    quality = (
        "agree closely"
        if rmse < 2.5 and coverage > 0.6
        else "agree reasonably"
        if rmse < 5 and coverage > 0.4
        else "still show residual misalignment — treat exports as experimental"
    )
    return (
        f"{shadow_note} After alignment, the images {quality}: "
        f"a {tx:.0f}×{ty:.0f} px translation, a {rot:.1f}° rotation, and a {scale:.2f}× scale "
        f"difference were corrected, achieving {coverage*100:.0f}% spatial coverage with an "
        f"RMSE of {rmse:.1f} pixels (inlier ratio {inlier_ratio*100:.0f}%)."
    )
