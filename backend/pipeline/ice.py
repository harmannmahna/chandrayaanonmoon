from __future__ import annotations

from pathlib import Path
from typing import Any

import cv2
import numpy as np


def _load_job_optical(result_dir: Path, job_id: str) -> np.ndarray | None:
    """Prefer CLAHE-enhanced reference, then RANSAC overlay/warped, then upload."""
    backend_root = result_dir.parent if result_dir.name == "results" else result_dir
    upload_root = backend_root / "uploads"
    candidates = [
        result_dir / job_id / "clahe" / "enhanced_0.png",
        result_dir / job_id / "clahe" / "original_0.png",
        result_dir / job_id / "ransac" / "overlay.png",
        result_dir / job_id / "ransac" / "warped.png",
        upload_root / job_id / "img_0.png",
    ]
    for path in candidates:
        if path.exists():
            img = cv2.imread(str(path))
            if img is not None:
                return img
    return None


def run_ice_detection(result_dir: Path, job_id: str | None = None) -> dict[str, Any]:
    """
    Ice screening demo using CPR/DOP criteria:
      candidate when CPR > 1 AND DOP < 0.13

    If job_id points at a registration upload, the optical base is that scene so
    ice candidates are shown on the same lunar area the user registered.
    CPR/DOP maps remain synthetic (no DFSAR archive in-browser) but are shaped
    by dark/shadow structure in the provided photo.
    """
    optical: np.ndarray | None = None
    source = "synthetic_demo"
    if job_id:
        optical = _load_job_optical(result_dir, job_id)
        if optical is not None:
            source = f"registration_job:{job_id}"

    if optical is None:
        rng = np.random.default_rng(7)
        h, w = 512, 512
        optical = np.zeros((h, w), dtype=np.uint8)
        for _ in range(35):
            c = (int(rng.integers(30, w - 30)), int(rng.integers(30, h - 30)))
            r = int(rng.integers(10, 60))
            cv2.circle(optical, c, r, int(rng.integers(50, 180)), -1)
            cv2.circle(optical, c, r, 220, 1)
        optical = cv2.cvtColor(optical, cv2.COLOR_GRAY2BGR)

    h, w = optical.shape[:2]
    gray = cv2.cvtColor(optical, cv2.COLOR_BGR2GRAY)
    rng = np.random.default_rng(abs(hash(job_id or "ice_demo")) % (2**32))

    # Shadow-like bowls from dark terrain in THIS image (PSR proxies on the uploaded area)
    blur = cv2.GaussianBlur(gray, (31, 31), 0)
    dark = blur < np.percentile(blur, 28)
    dark = cv2.morphologyEx(dark.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)).astype(bool)

    num, labels, stats, _ = cv2.connectedComponentsWithStats(dark.astype(np.uint8), connectivity=8)
    # Keep the two largest non-background dark blobs as candidate bowls
    areas = [(i, int(stats[i, cv2.CC_STAT_AREA])) for i in range(1, num)]
    areas.sort(key=lambda t: t[1], reverse=True)
    keep = [i for i, a in areas[:2] if a > (h * w) * 0.004]
    if not keep:
        # Fallback ellipses if the photo has little dark structure
        yy, xx = np.mgrid[0:h, 0:w]
        psr = ((xx - w * 0.35) ** 2 / (w * 0.14) ** 2 + (yy - h * 0.62) ** 2 / (h * 0.11) ** 2) < 1
        psr2 = ((xx - w * 0.70) ** 2 / (w * 0.09) ** 2 + (yy - h * 0.32) ** 2 / (h * 0.08) ** 2) < 1
    else:
        psr = labels == keep[0]
        psr2 = labels == keep[1] if len(keep) > 1 else np.zeros_like(psr)

    cpr = rng.normal(0.55, 0.12, (h, w))
    dop = rng.normal(0.35, 0.08, (h, w))
    if np.any(psr):
        cpr[psr] = rng.normal(1.35, 0.15, int(np.count_nonzero(psr)))
        dop[psr] = rng.normal(0.08, 0.02, int(np.count_nonzero(psr)))
    if np.any(psr2):
        cpr[psr2] = rng.normal(1.15, 0.1, int(np.count_nonzero(psr2)))
        dop[psr2] = rng.normal(0.18, 0.03, int(np.count_nonzero(psr2)))  # CPR-only / clutter

    cpr = np.clip(cpr, 0, 3)
    dop = np.clip(dop, 0, 1)

    both = (cpr > 1.0) & (dop < 0.13)
    cpr_only = (cpr > 1.0) & (dop >= 0.13)
    neither = ~(both | cpr_only)

    overlay = optical.copy()
    overlay[neither] = (overlay[neither].astype(np.float32) * 0.55).astype(np.uint8)
    overlay[cpr_only] = (
        0.35 * overlay[cpr_only].astype(np.float32) + 0.65 * np.array([40, 160, 255], dtype=np.float32)
    ).astype(np.uint8)
    overlay[both] = (
        0.25 * overlay[both].astype(np.float32) + 0.75 * np.array([180, 220, 40], dtype=np.float32)
    ).astype(np.uint8)

    area_px = int(np.count_nonzero(both))
    m_per_px = 2.0
    volume_m3 = area_px * (m_per_px**2) * 5.0 * 0.08

    out_root = result_dir / (job_id or "ice_demo")
    out_root.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out_root / "ice_overlay.png"), overlay)
    cv2.imwrite(str(out_root / "optical.png"), optical)

    regions: list[dict[str, Any]] = []
    for name, mask, conf in (
        ("Shadowed bowl A — CPR+DOP ice-like", psr & both, "high"),
        ("Shadowed bowl B — CPR-only (likely rocky clutter)", psr2 & cpr_only, "low"),
    ):
        ys, xs = np.where(mask)
        if len(xs) == 0:
            continue
        regions.append(
            {
                "name": name,
                "confidence": conf,
                "bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
                "mean_cpr": round(float(cpr[mask].mean()), 3),
                "mean_dop": round(float(dop[mask].mean()), 3),
            }
        )

    used_registered = source.startswith("registration_job")
    terrain_note = (
        "Screening ran on your registered lunar scene. Darker / shadowed patches were treated as "
        "PSR-like bowls; lime marks CPR+DOP ice-like candidates, cyan/orange marks CPR-only clutter."
        if used_registered
        else (
            "OHRC morphology check on demo terrain: bowl A looks smooth and shadowed (ice-like), "
            "bowl B fails the DOP gate (rocky clutter)."
        )
    )
    relevance = (
        "These ice-formation highlights are drawn on the same area you uploaded/registered. "
        "CPR/DOP layers are demo radar proxies shaped by that photo’s shadows — registration is "
        "what lets optical context and radar criteria share one pixel grid."
        if used_registered
        else (
            "Registration is the enabler: DFSAR radar and OHRC optical must be pixel-aligned "
            "before CPR/DOP overlays can be trusted. Upload or run demo registration first to "
            "screen ice on your own lunar patch."
        )
    )

    return {
        "criteria": "CPR > 1 AND DOP < 0.13",
        "overlay_url": f"/results/{out_root.name}/ice_overlay.png",
        "optical_url": f"/results/{out_root.name}/optical.png",
        "candidate_pixels": area_px,
        "estimated_ice_volume_m3": round(volume_m3, 1),
        "regions": regions,
        "terrain_note": terrain_note,
        "relevance": relevance,
        "landing_path_status": "in progress — suggested landing marker / rover waypoint not shipped for this round",
        "source_image": source,
        "used_registration_job": used_registered,
    }
