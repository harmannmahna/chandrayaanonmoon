from __future__ import annotations

from typing import Any

import cv2
import numpy as np


def _local_contrast(gray: np.ndarray, win: int = 16) -> float:
    """Mean local standard deviation — more sensitive than global std for CLAHE."""
    g = gray.astype(np.float32)
    mean = cv2.blur(g, (win, win))
    mean_sq = cv2.blur(g * g, (win, win))
    var = np.maximum(mean_sq - mean * mean, 0.0)
    return float(np.mean(np.sqrt(var)))


def run_clahe(img: np.ndarray, clip_limit: float = 3.5, tile: int = 8) -> tuple[np.ndarray, dict[str, Any]]:
    """Contrast Limited Adaptive Histogram Equalization on luminance channel."""
    if img.ndim == 2:
        gray = img.copy()
        lab = None
    else:
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        gray = lab[:, :, 0].copy()

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile, tile))
    enhanced_l = clahe.apply(gray)

    if lab is None:
        out = enhanced_l
    else:
        lab[:, :, 0] = enhanced_l
        out = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    before_local = _local_contrast(gray)
    after_local = _local_contrast(enhanced_l)
    edges_before = cv2.Canny(gray, 50, 120)
    edges_after = cv2.Canny(enhanced_l, 50, 120)
    gain = after_local / max(before_local, 1e-6)
    edge_before_n = int(np.count_nonzero(edges_before))
    edge_after_n = int(np.count_nonzero(edges_after))

    return out, {
        "clip_limit": clip_limit,
        "tile": tile,
        "contrast_gain": round(gain, 3),
        "edge_pixels_before": edge_before_n,
        "edge_pixels_after": edge_after_n,
        "note": (
            f"Local contrast gain ×{gain:.2f}. "
            f"Visible edge pixels {edge_before_n} → {edge_after_n}."
        ),
    }
