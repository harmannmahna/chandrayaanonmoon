"""Deterministic Match Reliability Agent (0–100) with explainable trust labels.

Internal quality score ≠ independent geodetic accuracy.
"""

from __future__ import annotations

from typing import Any


def _spatial_clustering_penalty(mkpts0: list[list[float]], width: int, height: int, grid: int = 4) -> float:
    if not mkpts0 or width <= 0 or height <= 0:
        return 1.0
    cells: set[tuple[int, int]] = set()
    for x, y in mkpts0:
        gx = min(grid - 1, max(0, int(float(x) / width * grid)))
        gy = min(grid - 1, max(0, int(float(y) / height * grid)))
        cells.add((gx, gy))
    coverage = len(cells) / float(grid * grid)
    # Low spread → higher penalty factor (closer to 1)
    return float(max(0.0, 1.0 - coverage))


def score_registration(
    *,
    raw_match_count: int,
    inlier_count: int,
    inlier_ratio: float,
    rmse_px: float,
    spatial_coverage: float,
    mkpts0: list[list[float]] | None = None,
    image_width: int | None = None,
    image_height: int | None = None,
    illumination_delta: float | None = None,
    resolution_ratio: float | None = None,
    blur_proxy: float | None = None,
) -> dict[str, Any]:
    reasons: list[str] = []
    score = 0.0

    # Raw matches
    if raw_match_count >= 200:
        score += 18
        reasons.append(f"Strong raw match count ({raw_match_count}).")
    elif raw_match_count >= 60:
        score += 12
        reasons.append(f"Moderate raw match count ({raw_match_count}).")
    elif raw_match_count >= 20:
        score += 6
        reasons.append(f"Sparse raw matches ({raw_match_count}).")
    else:
        reasons.append(f"Very few raw matches ({raw_match_count}).")

    # Inliers
    if inlier_count >= 80:
        score += 18
        reasons.append(f"High inlier count ({inlier_count}).")
    elif inlier_count >= 25:
        score += 12
        reasons.append(f"Moderate inlier count ({inlier_count}).")
    elif inlier_count >= 8:
        score += 6
        reasons.append(f"Low inlier count ({inlier_count}).")
    else:
        reasons.append(f"Insufficient inliers ({inlier_count}).")

    # Inlier ratio
    if inlier_ratio >= 0.7:
        score += 18
        reasons.append(f"High inlier ratio ({inlier_ratio * 100:.1f}%).")
    elif inlier_ratio >= 0.4:
        score += 12
        reasons.append(f"Moderate inlier ratio ({inlier_ratio * 100:.1f}%).")
    elif inlier_ratio >= 0.2:
        score += 6
        reasons.append(f"Low inlier ratio ({inlier_ratio * 100:.1f}%).")
    else:
        reasons.append(f"Poor inlier ratio ({inlier_ratio * 100:.1f}%).")

    # RMSE (pixel reprojection — not geodetic)
    if rmse_px <= 1.0:
        score += 18
        reasons.append(f"Low pixel RMSE ({rmse_px:.2f} px).")
    elif rmse_px <= 3.0:
        score += 12
        reasons.append(f"Acceptable pixel RMSE ({rmse_px:.2f} px).")
    elif rmse_px <= 6.0:
        score += 6
        reasons.append(f"Elevated pixel RMSE ({rmse_px:.2f} px).")
    else:
        reasons.append(f"High pixel RMSE ({rmse_px:.2f} px).")

    # Spatial coverage
    if spatial_coverage >= 0.7:
        score += 14
        reasons.append(f"Good spatial coverage ({spatial_coverage * 100:.0f}%).")
    elif spatial_coverage >= 0.4:
        score += 9
        reasons.append(f"Partial spatial coverage ({spatial_coverage * 100:.0f}%).")
    elif spatial_coverage >= 0.2:
        score += 4
        reasons.append(f"Limited spatial coverage ({spatial_coverage * 100:.0f}%).")
    else:
        reasons.append(f"Poor spatial coverage ({spatial_coverage * 100:.0f}%).")

    # Clustering penalty
    if mkpts0 and image_width and image_height:
        cluster_pen = _spatial_clustering_penalty(mkpts0, image_width, image_height)
        score -= cluster_pen * 8
        if cluster_pen > 0.55:
            reasons.append("Matches are spatially clustered — risk of local-only alignment.")

    if illumination_delta is not None:
        if illumination_delta > 0.35:
            score -= 6
            reasons.append(f"Large illumination difference proxy ({illumination_delta:.2f}).")
        elif illumination_delta < 0.12:
            score += 3
            reasons.append("Illumination difference proxy is mild.")

    if resolution_ratio is not None:
        r = resolution_ratio if resolution_ratio >= 1 else (1.0 / max(resolution_ratio, 1e-6))
        if r > 2.5:
            score -= 5
            reasons.append(f"Large resolution ratio (~{r:.1f}×) stresses correspondence.")

    if blur_proxy is not None:
        if blur_proxy < 40:
            score -= 5
            reasons.append("Blur/quality proxy suggests soft imagery.")
        elif blur_proxy > 120:
            score += 2

    score = float(max(0.0, min(100.0, round(score, 1))))

    if raw_match_count < 8 or inlier_count < 4:
        trust = "No stable correspondence found"
    elif score >= 75 and inlier_ratio >= 0.45 and rmse_px <= 3.0:
        trust = "Trusted for visual overlay"
    elif score >= 45:
        trust = "Use with analyst review"
    else:
        trust = "Insufficient evidence — do not treat as final"

    reasons.append(
        "Limitation: this internal quality score is not independent geodetic lunar accuracy."
    )

    return {
        "score": score,
        "trust_label": trust,
        "reasons": reasons,
        "limitation": "Internal quality score ≠ independent geodetic accuracy.",
    }
