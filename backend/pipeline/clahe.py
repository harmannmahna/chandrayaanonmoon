from __future__ import annotations

from typing import Any

import cv2
import numpy as np


def run_clahe(img: np.ndarray, clip_limit: float = 2.5, tile: int = 8) -> tuple[np.ndarray, dict[str, Any]]:
    """Contrast Limited Adaptive Histogram Equalization on luminance channel."""
    if img.ndim == 2:
        gray = img
        lab = None
    else:
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        gray = lab[:, :, 0]

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile, tile))
    enhanced_l = clahe.apply(gray)

    if lab is None:
        out = enhanced_l
    else:
        lab[:, :, 0] = enhanced_l
        out = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # Simple contrast / edge proxies for UI notes
    before_std = float(np.std(gray))
    after_std = float(np.std(enhanced_l))
    edges_before = cv2.Canny(gray, 60, 140)
    edges_after = cv2.Canny(enhanced_l, 60, 140)
    gain = after_std / max(before_std, 1e-6)

    return out, {
        "clip_limit": clip_limit,
        "tile": tile,
        "contrast_gain": round(gain, 3),
        "edge_pixels_before": int(np.count_nonzero(edges_before)),
        "edge_pixels_after": int(np.count_nonzero(edges_after)),
        "note": (
            f"Local contrast gain ×{gain:.2f}. "
            f"Visible edge pixels {int(np.count_nonzero(edges_before))} → {int(np.count_nonzero(edges_after))}."
        ),
    }
