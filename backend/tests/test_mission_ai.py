"""Unit checks for Match Reliability Agent + matcher router availability."""

from __future__ import annotations

import numpy as np

from pipeline.matcher_router import list_engines, match_images
from pipeline.reliability import score_registration


def test_reliability_trusted_band():
    result = score_registration(
        raw_match_count=220,
        inlier_count=120,
        inlier_ratio=0.75,
        rmse_px=0.9,
        spatial_coverage=0.8,
        mkpts0=[[10, 10], [200, 40], [80, 180], [300, 220], [150, 90], [40, 250]],
        image_width=400,
        image_height=300,
    )
    assert result["score"] >= 75
    assert result["trust_label"] == "Trusted for visual overlay"
    assert "geodetic" in result["limitation"].lower()


def test_reliability_no_stable():
    result = score_registration(
        raw_match_count=3,
        inlier_count=2,
        inlier_ratio=0.1,
        rmse_px=12.0,
        spatial_coverage=0.05,
    )
    assert result["trust_label"] == "No stable correspondence found"


def test_list_engines_always_includes_akaze():
    engines = list_engines()
    ids = {e["engine"] for e in engines}
    assert ids == {"akaze", "superpoint-lightglue", "loftr"}
    akaze = next(e for e in engines if e["engine"] == "akaze")
    assert akaze["available"] is True


def test_match_images_akaze_on_synthetic():
    rng = np.random.default_rng(0)
    a = (rng.random((256, 256)) * 255).astype(np.uint8)
    b = np.roll(a, shift=12, axis=1)
    a_bgr = np.stack([a, a, a], axis=-1)
    b_bgr = np.stack([b, b, b], axis=-1)
    out = match_images(a_bgr, b_bgr, engine="akaze", allow_fallback=False)
    assert out["status"] == "ok"
    assert out["engine"] == "akaze"
    assert out["num_matches"] >= 0
    assert "AKAZE" in out["matcher"]


def test_ai_unavailable_without_fake_when_no_fallback():
    rng = np.random.default_rng(1)
    a = (rng.random((128, 128, 3)) * 255).astype(np.uint8)
    b = (rng.random((128, 128, 3)) * 255).astype(np.uint8)
    out = match_images(a, b, engine="loftr", allow_fallback=False)
    # Without torch/kornia this is unavailable; with deps it may be ok.
    assert out["status"] in {"unavailable", "ok"}
    if out["status"] == "unavailable":
        assert out["num_matches"] == 0
        assert out["mkpts0"] == []
        assert out.get("available") is False
