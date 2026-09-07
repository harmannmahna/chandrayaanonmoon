"""MatcherEngine router: akaze | superpoint-lightglue | loftr.

Preserves classical AKAZE baseline. AI engines never invent matches —
they return status=unavailable when dependencies/weights are missing.
"""

from __future__ import annotations

import time
from typing import Any, Literal

import numpy as np

from pipeline.ai_engines import probe_torch_stack, run_loftr, run_superpoint_lightglue
from pipeline.matcher import run_loftr_style

MatcherEngine = Literal["akaze", "superpoint-lightglue", "loftr"]

ENGINE_META: dict[str, dict[str, str]] = {
    "akaze": {
        "label": "Classical Baseline",
        "ui_label": "AKAZE",
        "description": "AKAZE + Lowe ratio test — always available classical baseline.",
    },
    "superpoint-lightglue": {
        "label": "AI Fast",
        "ui_label": "SuperPoint + LightGlue",
        "description": "Pretrained SuperPoint + LightGlue (optional torch/kornia).",
    },
    "loftr": {
        "label": "AI Robust",
        "ui_label": "LoFTR",
        "description": "Pretrained LoFTR outdoor weights (optional torch/kornia).",
    },
}


def list_engines() -> list[dict[str, Any]]:
    stack = probe_torch_stack()
    ai_ready = bool(stack["torch"] and stack["kornia"])
    out: list[dict[str, Any]] = []
    for engine, meta in ENGINE_META.items():
        if engine == "akaze":
            available = True
            status = "available"
            detail = "OpenCV AKAZE baseline"
        else:
            available = ai_ready
            status = "available" if ai_ready else "unavailable"
            detail = (
                f"torch={stack.get('torch_version', 'no')} kornia={stack.get('kornia_version', 'no')} "
                f"cuda={stack['cuda']}"
                if ai_ready
                else (stack.get("detail") or "Optional AI deps not installed")
            )
        out.append(
            {
                "engine": engine,
                **meta,
                "available": available,
                "status": status,
                "detail": detail,
            }
        )
    return out


def match_images(
    image_a: np.ndarray,
    image_b: np.ndarray,
    engine: MatcherEngine = "akaze",
    *,
    allow_fallback: bool = True,
) -> dict[str, Any]:
    """Uniform matcher interface used by /match and /process/loftr."""
    engine_norm: MatcherEngine
    if engine not in ENGINE_META:
        engine_norm = "akaze"
    else:
        engine_norm = engine  # type: ignore[assignment]

    t0 = time.perf_counter()
    fallback_used = False
    requested = engine_norm

    if engine_norm == "akaze":
        result = run_loftr_style(image_a, image_b)
        result.update(
            {
                "available": True,
                "status": "ok",
                "engine": "akaze",
                "matcher": "AKAZE + Lowe ratio (classical baseline)",
            }
        )
    elif engine_norm == "superpoint-lightglue":
        result = run_superpoint_lightglue(image_a, image_b)
    else:
        result = run_loftr(image_a, image_b)

    if result.get("status") == "unavailable" or result.get("available") is False:
        unavailable_error = str(result.get("error") or "Model unavailable")
        if allow_fallback and engine_norm != "akaze":
            fallback_used = True
            result = run_loftr_style(image_a, image_b)
            result.update(
                {
                    "available": True,
                    "status": "fallback",
                    "engine": "akaze",
                    "requested_engine": requested,
                    "fallback_used": True,
                    "fallback_reason": (
                        f"Requested {requested} unavailable — used AKAZE classical baseline. "
                        f"{unavailable_error}"
                    ).strip(),
                    "matcher": "AKAZE + Lowe ratio (fallback from unavailable AI engine)",
                }
            )
        else:
            # Explicit unavailable — do not invent matches
            elapsed = (time.perf_counter() - t0) * 1000.0
            return {
                "available": False,
                "status": "unavailable",
                "engine": engine_norm,
                "requested_engine": requested,
                "fallback_used": False,
                "error": unavailable_error,
                "mkpts0": [],
                "mkpts1": [],
                "mconf": [],
                "num_matches": 0,
                "runtime_ms": round(elapsed, 2),
                "matcher": ENGINE_META[engine_norm]["ui_label"],
            }

    if "runtime_ms" not in result:
        result["runtime_ms"] = round((time.perf_counter() - t0) * 1000.0, 2)
    result.setdefault("requested_engine", requested)
    result.setdefault("fallback_used", fallback_used)
    result.setdefault("engine", engine_norm if not fallback_used else "akaze")
    return result
