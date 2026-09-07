"""Registration analysis runs."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.constants import DISCLAIMER, RunStatus
from app.core.db import get_db
from app.models import AnalysisRun, AuditEvent, Dataset, Project, RegistrationResult
from app.schemas.platform import AnalysisRunOut, RegistrationResultOut, RegistrationRunCreate
from app.services.matchers import _normalize_engine
from app.services.storage import ObjectStorage, get_storage

router = APIRouter(prefix="/registration", tags=["registration"])


def _dispatch_registration(run_id: uuid.UUID) -> str | None:
    from app.core.config import get_settings
    from app.workers.tasks import run_registration_task

    settings = get_settings()
    async_result = run_registration_task.delay(str(run_id))
    if settings.celery_task_always_eager:
        return "eager"
    return async_result.id


@router.post("/runs", response_model=AnalysisRunOut, status_code=201)
def create_registration_run(body: RegistrationRunCreate, db: Session = Depends(get_db)) -> AnalysisRun:
    project = db.get(Project, body.project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    ref = db.get(Dataset, body.reference_dataset_id)
    src = db.get(Dataset, body.source_dataset_id)
    if not ref or not src:
        raise HTTPException(404, "Dataset not found")
    if ref.project_id != body.project_id or src.project_id != body.project_id:
        raise HTTPException(400, "Datasets must belong to the project")
    if not (ref.meta or {}).get("upload_confirmed") or not (src.meta or {}).get("upload_confirmed"):
        raise HTTPException(400, "Datasets must be upload-confirmed before analysis")

    engine = _normalize_engine(body.engine)
    run = AnalysisRun(
        project_id=body.project_id,
        kind="registration",
        status=RunStatus.queued,
        progress=0.0,
        message="Queued",
        engine=engine,
        params={
            "reference_dataset_id": str(ref.id),
            "source_dataset_id": str(src.id),
            "reference_object_key": ref.object_key,
            "source_object_key": src.object_key,
            "engine": engine,
            "allow_fallback": body.allow_fallback,
            "preprocessing": body.preprocessing,
            "ransac": body.ransac,
            "meta": body.meta,
        },
        lineage={
            "input_dataset_ids": [str(ref.id), str(src.id)],
            "input_data_status": [ref.data_status, src.data_status],
            "preprocessing": body.preprocessing,
            "matcher_engine": engine,
            "geometry": body.ransac,
            "limitations": DISCLAIMER,
        },
    )
    db.add(run)
    db.flush()
    task_id = _dispatch_registration(run.id)
    run.celery_task_id = task_id
    db.add(AuditEvent(actor="api", action="registration.enqueue", entity_type="analysis_run", entity_id=str(run.id)))
    db.commit()
    db.refresh(run)
    return run


@router.get("/runs/{run_id}", response_model=AnalysisRunOut)
def get_run(run_id: uuid.UUID, db: Session = Depends(get_db)) -> AnalysisRun:
    run = db.get(AnalysisRun, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    return run


@router.get("/runs/{run_id}/results", response_model=RegistrationResultOut)
def get_run_results(
    run_id: uuid.UUID,
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_storage),
) -> RegistrationResultOut:
    run = db.get(AnalysisRun, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    reg = db.query(RegistrationResult).filter_by(run_id=run_id).one_or_none()
    if not reg:
        raise HTTPException(404, "Results not ready")
    downloads = {}
    for label, key in (reg.object_keys or {}).items():
        try:
            downloads[label] = storage.presigned_get(key)
        except Exception:  # noqa: BLE001
            continue
    return RegistrationResultOut(
        id=reg.id,
        run_id=reg.run_id,
        engine=reg.engine,
        engine_version=reg.engine_version,
        device=reg.device,
        fallback_used=reg.fallback_used,
        runtime_ms=reg.runtime_ms,
        metrics=reg.metrics,
        reliability=reg.reliability,
        object_keys=reg.object_keys,
        limitations=reg.limitations,
        download_urls=downloads,
    )


@router.post("/runs/{run_id}/cancel", response_model=AnalysisRunOut)
def cancel_run(run_id: uuid.UUID, db: Session = Depends(get_db)) -> AnalysisRun:
    run = db.get(AnalysisRun, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    if run.status in {RunStatus.completed, RunStatus.failed, RunStatus.cancelled}:
        return run
    run.status = RunStatus.cancelled
    run.message = "Cancelled"
    run.progress = 1.0
    db.commit()
    db.refresh(run)
    return run


@router.get("/projects/{project_id}/runs", response_model=list[AnalysisRunOut])
def list_project_runs(project_id: uuid.UUID, db: Session = Depends(get_db)) -> list[AnalysisRun]:
    return (
        db.query(AnalysisRun)
        .filter_by(project_id=project_id, kind="registration")
        .order_by(AnalysisRun.created_at.desc())
        .limit(100)
        .all()
    )
