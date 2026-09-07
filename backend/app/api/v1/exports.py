"""Async export endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import AnalysisRun, Export
from app.schemas.platform import ExportCreate, ExportOut
from app.services.storage import ObjectStorage, get_storage

router = APIRouter(prefix="/exports", tags=["exports"])


@router.post("", response_model=ExportOut, status_code=201)
def create_export(body: ExportCreate, db: Session = Depends(get_db)) -> ExportOut:
    run = db.get(AnalysisRun, body.run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    exp = Export(run_id=run.id, status="queued", meta={"include": body.include})
    db.add(exp)
    db.flush()
    from app.workers.tasks import run_export_task

    task = run_export_task.delay(str(exp.id))
    exp.meta = {**(exp.meta or {}), "celery_task_id": task.id}
    db.commit()
    db.refresh(exp)
    return ExportOut(
        id=exp.id,
        run_id=exp.run_id,
        status=exp.status,
        object_key=exp.object_key,
        byte_size=exp.byte_size,
        meta=exp.meta,
        error=exp.error,
        download_url=None,
        created_at=exp.created_at,
    )


@router.get("/{export_id}", response_model=ExportOut)
def get_export(
    export_id: uuid.UUID,
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_storage),
) -> ExportOut:
    exp = db.get(Export, export_id)
    if not exp:
        raise HTTPException(404, "Export not found")
    url = storage.presigned_get(exp.object_key) if exp.object_key and exp.status == "completed" else None
    return ExportOut(
        id=exp.id,
        run_id=exp.run_id,
        status=exp.status,
        object_key=exp.object_key,
        byte_size=exp.byte_size,
        meta=exp.meta,
        error=exp.error,
        download_url=url,
        created_at=exp.created_at,
    )
