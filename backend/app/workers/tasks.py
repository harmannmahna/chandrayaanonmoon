"""Celery tasks."""

from __future__ import annotations

import uuid

from app.core.db import SessionLocal
from app.core.constants import RunStatus
from app.models import AnalysisRun, Export
from app.services.exports import execute_export
from app.services.registration import execute_registration_run
from app.services.storage import ObjectStorage
from app.workers.celery_app import celery_app


@celery_app.task(bind=True, name="registration.run", max_retries=2, default_retry_delay=10)
def run_registration_task(self, run_id: str) -> dict:
    db = SessionLocal()
    storage = ObjectStorage()
    try:
        run = db.get(AnalysisRun, uuid.UUID(run_id))
        if not run:
            return {"status": "missing"}
        if run.status == RunStatus.cancelled:
            return {"status": "cancelled"}
        run.celery_task_id = self.request.id
        db.commit()
        return execute_registration_run(db, storage, uuid.UUID(run_id))
    except Exception as exc:  # noqa: BLE001
        run = db.get(AnalysisRun, uuid.UUID(run_id))
        if run and run.status != RunStatus.cancelled:
            run.status = RunStatus.failed
            run.error = str(exc)
            run.message = f"Failed: {exc}"
            run.progress = 1.0
            db.commit()
        try:
            raise self.retry(exc=exc)
        except Exception:
            return {"status": "failed", "error": str(exc)}
    finally:
        db.close()


@celery_app.task(bind=True, name="export.run", max_retries=2, default_retry_delay=10)
def run_export_task(self, export_id: str) -> dict:
    db = SessionLocal()
    storage = ObjectStorage()
    try:
        return execute_export(db, storage, uuid.UUID(export_id))
    except Exception as exc:  # noqa: BLE001
        exp = db.get(Export, uuid.UUID(export_id))
        if exp:
            exp.status = "failed"
            exp.error = str(exc)
            db.commit()
        try:
            raise self.retry(exc=exc)
        except Exception:
            return {"status": "failed", "error": str(exc)}
    finally:
        db.close()
