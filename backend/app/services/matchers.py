"""Matcher engine service wrapping existing pipeline router."""

from __future__ import annotations

from typing import Any

import numpy as np

from app.core.config import get_settings
from app.core.constants import MatcherEngine


def _normalize_engine(engine: str) -> str:
    e = (engine or "akaze").strip().lower().replace("-", "_")
    if e in {"superpointlightglue", "superpoint_lightglue", "superpoint+lightglue"}:
        return MatcherEngine.superpoint_lightglue.value
    if e == "loftr":
        return MatcherEngine.loftr.value
    return MatcherEngine.akaze.value


def to_pipeline_engine(engine: str) -> str:
    """Map platform engine ids to pipeline matcher_router ids."""
    e = _normalize_engine(engine)
    if e == MatcherEngine.superpoint_lightglue.value:
        return "superpoint-lightglue"
    if e == MatcherEngine.loftr.value:
        return "loftr"
    return "akaze"


def list_matcher_engines() -> list[dict[str, Any]]:
    from pipeline.matcher_router import list_engines

    settings = get_settings()
    out = []
    for item in list_engines():
        eng = item["engine"]
        platform_id = eng.replace("-", "_")
        out.append(
            {
                **item,
                "engine": platform_id,
                "pipeline_engine": eng,
                "device_preference": settings.model_device,
            }
        )
    return out


def match_images(image_a: np.ndarray, image_b: np.ndarray, engine: str, allow_fallback: bool = True) -> dict[str, Any]:
    from pipeline.matcher_router import match_images as _match

    pipe_engine = to_pipeline_engine(engine)
    result = _match(image_a, image_b, engine=pipe_engine, allow_fallback=allow_fallback)  # type: ignore[arg-type]
    # Normalize engine id in response to platform form
    if result.get("engine"):
        result["engine"] = str(result["engine"]).replace("-", "_")
    if result.get("requested_engine"):
        result["requested_engine"] = str(result["requested_engine"]).replace("-", "_")
    return result
