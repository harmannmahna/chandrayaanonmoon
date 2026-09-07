"""Offline unit tests for platform helpers (no Docker required)."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.services.matchers import _normalize_engine, to_pipeline_engine
from app.core.constants import DISCLAIMER, MatcherEngine


def test_engine_normalization():
    assert _normalize_engine("akaze") == MatcherEngine.akaze
    assert _normalize_engine("superpoint-lightglue") == MatcherEngine.superpoint_lightglue
    assert _normalize_engine("superpoint_lightglue") == MatcherEngine.superpoint_lightglue
    assert _normalize_engine("loftr") == MatcherEngine.loftr
    assert to_pipeline_engine("superpoint_lightglue") == "superpoint-lightglue"
    assert to_pipeline_engine("akaze") == "akaze"


def test_disclaimer_mentions_prototype():
    assert "prototype" in DISCLAIMER.lower() or "SIH" in DISCLAIMER


def test_object_key_layout():
    from app.services.storage import object_key_for

    key = object_key_for("abc", "datasets", "ref.png")
    assert key.startswith("projects/abc/datasets/")
    assert "ref.png" in key
