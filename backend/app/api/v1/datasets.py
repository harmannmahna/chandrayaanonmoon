"""Dataset upload via MinIO presigned URLs."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.models import AuditEvent, Dataset, Project
from app.schemas.platform import (
    DatasetOut,
    UploadConfirmRequest,
    UploadInitRequest,
    UploadInitResponse,
)
from app.services.storage import ObjectStorage, get_storage, object_key_for

router = APIRouter(prefix="/datasets", tags=["datasets"])


def _validate_upload(content_type: str, byte_size: int) -> None:
    settings = get_settings()
    if byte_size <= 0 or byte_size > settings.max_upload_bytes:
        raise HTTPException(400, f"File size must be 1..{settings.max_upload_bytes} bytes")
    allowed = settings.allowed_content_types
    if content_type not in allowed and not content_type.startswith("image/"):
        raise HTTPException(400, f"Unsupported content type: {content_type}")


@router.post("/uploads/init", response_model=UploadInitResponse)
def init_upload(
    body: UploadInitRequest,
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_storage),
) -> UploadInitResponse:
    project = db.get(Project, body.project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_upload(body.content_type, body.byte_size)
    dataset_id = uuid.uuid4()
    key = object_key_for(str(body.project_id), "datasets", f"{dataset_id}_{Path(body.filename).name}")
    dataset = Dataset(
        id=dataset_id,
        project_id=body.project_id,
        name=body.filename,
        kind=body.kind,
        content_type=body.content_type,
        byte_size=body.byte_size,
        object_key=key,
        data_status=body.data_status,
        meta={**body.meta, "upload_confirmed": False},
    )
    db.add(dataset)
    db.commit()
    url = storage.presigned_put(key, body.content_type)
    return UploadInitResponse(
        dataset_id=dataset_id,
        object_key=key,
        upload_url=url,
        expires_in=get_settings().presign_expiry_seconds,
        headers={"Content-Type": body.content_type},
    )


@router.post("/uploads/confirm", response_model=DatasetOut)
def confirm_upload(
    body: UploadConfirmRequest,
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_storage),
) -> DatasetOut:
    dataset = db.get(Dataset, body.dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if not storage.exists(dataset.object_key):
        raise HTTPException(400, "Object not found in storage — upload may have failed or expired")
    dataset.checksum_sha256 = body.checksum_sha256
    dataset.meta = {**(dataset.meta or {}), "upload_confirmed": True}
    db.add(AuditEvent(actor="api", action="dataset.confirm", entity_type="dataset", entity_id=str(dataset.id)))
    db.commit()
    db.refresh(dataset)
    return DatasetOut(
        id=dataset.id,
        project_id=dataset.project_id,
        name=dataset.name,
        kind=dataset.kind,
        content_type=dataset.content_type,
        byte_size=dataset.byte_size,
        object_key=dataset.object_key,
        data_status=dataset.data_status,
        meta=dataset.meta,
        created_at=dataset.created_at,
        download_url=storage.presigned_get(dataset.object_key),
    )


@router.get("/project/{project_id}", response_model=list[DatasetOut])
def list_datasets(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_storage),
) -> list[DatasetOut]:
    rows = db.query(Dataset).filter_by(project_id=project_id).order_by(Dataset.created_at.desc()).all()
    out: list[DatasetOut] = []
    for d in rows:
        out.append(
            DatasetOut(
                id=d.id,
                project_id=d.project_id,
                name=d.name,
                kind=d.kind,
                content_type=d.content_type,
                byte_size=d.byte_size,
                object_key=d.object_key,
                data_status=d.data_status,
                meta=d.meta,
                created_at=d.created_at,
                download_url=storage.presigned_get(d.object_key) if (d.meta or {}).get("upload_confirmed") else None,
            )
        )
    return out


@router.get("/{dataset_id}", response_model=DatasetOut)
def get_dataset(
    dataset_id: uuid.UUID,
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_storage),
) -> DatasetOut:
    d = db.get(Dataset, dataset_id)
    if not d:
        raise HTTPException(404, "Dataset not found")
    return DatasetOut(
        id=d.id,
        project_id=d.project_id,
        name=d.name,
        kind=d.kind,
        content_type=d.content_type,
        byte_size=d.byte_size,
        object_key=d.object_key,
        data_status=d.data_status,
        meta=d.meta,
        created_at=d.created_at,
        download_url=storage.presigned_get(d.object_key),
    )
