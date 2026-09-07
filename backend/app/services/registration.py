"""Registration pipeline orchestration for Celery workers."""

from __future__ import annotations

import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from sqlalchemy.orm import Session

from app.core.constants import DISCLAIMER, RunStatus
from app.models import AnalysisRun, RegistrationResult
from app.services.matchers import list_matcher_engines, match_images, to_pipeline_engine
from app.services.storage import ObjectStorage
from pipeline.clahe import run_clahe
from pipeline.ransac import run_ransac
from pipeline.reliability import score_registration


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _update_run(db: Session, run: AnalysisRun, *, status: str, progress: float, message: str) -> None:
    run.status = status
    run.progress = progress
    run.message = message
    if status == RunStatus.preprocessing and run.started_at is None:
        run.started_at = _now()
    if status in {RunStatus.completed, RunStatus.failed, RunStatus.cancelled}:
        run.finished_at = _now()
    db.add(run)
    db.commit()
    db.refresh(run)


def execute_registration_run(db: Session, storage: ObjectStorage, run_id: uuid.UUID) -> dict[str, Any]:
    run = db.get(AnalysisRun, run_id)
    if not run:
        raise ValueError("Unknown analysis run")
    if run.status == RunStatus.cancelled:
        return {"status": "cancelled"}

    params = run.params or {}
    ref_key = params["reference_object_key"]
    src_key = params["source_object_key"]
    engine = params.get("engine", run.engine or "akaze")
    allow_fallback = bool(params.get("allow_fallback", True))

    with tempfile.TemporaryDirectory(prefix="lunamatch_reg_") as tmp:
        tmp_path = Path(tmp)
        ref_path = tmp_path / "ref.png"
        src_path = tmp_path / "src.png"
        storage.download_to_path(ref_key, str(ref_path))
        storage.download_to_path(src_key, str(src_path))
        ref = cv2.imread(str(ref_path), cv2.IMREAD_COLOR)
        src = cv2.imread(str(src_path), cv2.IMREAD_COLOR)
        if ref is None or src is None:
            _update_run(db, run, status=RunStatus.failed, progress=1.0, message="Could not decode input images")
            run.error = "Could not decode input images"
            db.commit()
            raise ValueError("Could not decode input images")

        _update_run(db, run, status=RunStatus.preprocessing, progress=0.15, message="CLAHE preprocessing…")
        if run.status == RunStatus.cancelled:
            return {"status": "cancelled"}

        if params.get("preprocessing", {}).get("clahe", True):
            ref_e, _ = run_clahe(ref)
            src_e, _ = run_clahe(src)
        else:
            ref_e, src_e = ref, src

        _update_run(db, run, status=RunStatus.matching, progress=0.4, message=f"Matching ({engine})…")
        match = match_images(ref_e, src_e, engine=engine, allow_fallback=allow_fallback)
        if match.get("status") == "unavailable":
            _update_run(db, run, status=RunStatus.failed, progress=1.0, message="Matcher unavailable")
            run.error = match.get("error") or "Matcher unavailable"
            db.commit()
            return {"status": "failed", "error": run.error}

        _update_run(db, run, status=RunStatus.ransac, progress=0.7, message="RANSAC geometric verification…")
        ransac = run_ransac(ref_e, src_e, match["mkpts0"], match["mkpts1"], match.get("mconf"))

        _update_run(db, run, status=RunStatus.refinement, progress=0.85, message="Confidence audit…")
        reliability = score_registration(
            raw_match_count=int(match.get("num_matches") or len(match.get("mkpts0") or [])),
            inlier_count=int(ransac["inlier_count"]),
            inlier_ratio=float(ransac["inlier_ratio"]),
            rmse_px=float(ransac["rmse_px"]),
            spatial_coverage=float(ransac["spatial_coverage"]),
            mkpts0=match.get("mkpts0") or [],
            image_width=int(ref_e.shape[1]),
            image_height=int(ref_e.shape[0]),
        )

        # Save outputs to MinIO
        prefix = f"projects/{run.project_id}/runs/{run.id}"
        object_keys: dict[str, str] = {}
        for name, img in (
            ("overlay.png", ransac["overlay"]),
            ("tint_overlay.png", ransac["tint_overlay"]),
            ("warped.png", ransac["warped"]),
        ):
            ok, buf = cv2.imencode(".png", img)
            if not ok:
                continue
            key = f"{prefix}/{name}"
            storage.put_bytes(key, buf.tobytes(), "image/png")
            object_keys[name.replace(".png", "")] = key

        # Match preview (simple side-by-side dots)
        preview = _simple_match_preview(ref_e, src_e, match)
        ok, buf = cv2.imencode(".png", preview)
        if ok:
            key = f"{prefix}/matches.png"
            storage.put_bytes(key, buf.tobytes(), "image/png")
            object_keys["matches"] = key

        metrics = {
            "raw_match_count": int(match.get("num_matches") or 0),
            "inlier_count": int(ransac["inlier_count"]),
            "inlier_ratio": float(ransac["inlier_ratio"]),
            "rmse_px": float(ransac["rmse_px"]),
            "spatial_coverage": float(ransac["spatial_coverage"]),
            "rotation_deg": float(ransac["rotation_deg"]),
            "scale": float(ransac["scale"]),
            "rmse_label": "pixel reprojection / inlier error (not geodetic)",
            "H": ransac["H"].tolist() if hasattr(ransac["H"], "tolist") else ransac["H"],
            "conclusion": ransac.get("conclusion"),
            "matcher": match.get("matcher"),
            "status": match.get("status"),
        }

        engines = {e["engine"]: e for e in list_matcher_engines()}
        used = str(match.get("engine") or engine)
        engine_meta = engines.get(used, {})

        existing = db.query(RegistrationResult).filter_by(run_id=run.id).one_or_none()
        payload = {
            "engine": used,
            "engine_version": str(engine_meta.get("detail") or match.get("matcher") or to_pipeline_engine(used)),
            "device": str(match.get("device") or "cpu"),
            "fallback_used": bool(match.get("fallback_used")),
            "runtime_ms": match.get("runtime_ms"),
            "metrics": metrics,
            "reliability": reliability,
            "object_keys": object_keys,
            "limitations": DISCLAIMER,
            "meta": {
                "requested_engine": match.get("requested_engine") or engine,
                "fallback_reason": match.get("fallback_reason"),
                "pipeline_engine": to_pipeline_engine(used),
            },
        }
        if existing:
            for k, v in payload.items():
                setattr(existing, k, v)
            result_row = existing
        else:
            result_row = RegistrationResult(run_id=run.id, **payload)
            db.add(result_row)

        run.lineage = {
            **(run.lineage or {}),
            "preprocessing": params.get("preprocessing"),
            "matcher_engine": used,
            "matcher_version": result_row.engine_version,
            "device": result_row.device,
            "geometry": params.get("ransac"),
            "output_object_keys": object_keys,
            "quality": reliability,
            "limitations": DISCLAIMER,
            "finished_at": _now().isoformat(),
        }
        _update_run(db, run, status=RunStatus.completed, progress=1.0, message="Registration complete")
        return {"status": "completed", "run_id": str(run.id), "object_keys": object_keys}


def _simple_match_preview(ref: np.ndarray, src: np.ndarray, match: dict[str, Any]) -> np.ndarray:
    h = max(ref.shape[0], src.shape[0])
    w = ref.shape[1] + src.shape[1]
    canvas = np.zeros((h, w, 3), dtype=np.uint8)
    canvas[: ref.shape[0], : ref.shape[1]] = ref
    canvas[: src.shape[0], ref.shape[1] : ref.shape[1] + src.shape[1]] = src
    mk0 = match.get("mkpts0") or []
    mk1 = match.get("mkpts1") or []
    for (x0, y0), (x1, y1) in zip(mk0[:400], mk1[:400]):
        p0 = (int(x0), int(y0))
        p1 = (int(x1) + ref.shape[1], int(y1))
        cv2.line(canvas, p0, p1, (80, 220, 120), 1, cv2.LINE_AA)
        cv2.circle(canvas, p0, 2, (80, 220, 120), -1)
        cv2.circle(canvas, p1, 2, (80, 220, 120), -1)
    return canvas
