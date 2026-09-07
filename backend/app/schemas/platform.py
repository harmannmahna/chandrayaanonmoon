"""Pydantic schemas for /api/v1."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    meta: dict[str, Any] = Field(default_factory=dict)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    meta: Optional[dict[str, Any]] = None


class ProjectOut(ORMModel):
    id: uuid.UUID
    name: str
    description: str
    meta: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class UploadInitRequest(BaseModel):
    project_id: uuid.UUID
    filename: str
    content_type: str
    byte_size: int
    kind: str = "optical"
    data_status: str = "real uploaded image"
    meta: dict[str, Any] = Field(default_factory=dict)


class UploadInitResponse(BaseModel):
    dataset_id: uuid.UUID
    object_key: str
    upload_url: str
    expires_in: int
    headers: dict[str, str] = Field(default_factory=dict)


class UploadConfirmRequest(BaseModel):
    dataset_id: uuid.UUID
    checksum_sha256: Optional[str] = None


class DatasetOut(ORMModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    kind: str
    content_type: str
    byte_size: int
    object_key: str
    data_status: str
    meta: dict[str, Any]
    created_at: datetime
    download_url: Optional[str] = None


class RegistrationRunCreate(BaseModel):
    project_id: uuid.UUID
    reference_dataset_id: uuid.UUID
    source_dataset_id: uuid.UUID
    engine: str = "akaze"
    allow_fallback: bool = True
    preprocessing: dict[str, Any] = Field(default_factory=lambda: {"clahe": True})
    ransac: dict[str, Any] = Field(default_factory=lambda: {"reproj_threshold_px": 3.0})
    meta: dict[str, Any] = Field(default_factory=dict)


class AnalysisRunOut(ORMModel):
    id: uuid.UUID
    project_id: uuid.UUID
    kind: str
    status: str
    progress: float
    message: str
    engine: str
    params: dict[str, Any]
    lineage: dict[str, Any]
    error: Optional[str]
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime]
    finished_at: Optional[datetime]


class RegistrationResultOut(ORMModel):
    id: uuid.UUID
    run_id: uuid.UUID
    engine: str
    engine_version: str
    device: str
    fallback_used: bool
    runtime_ms: Optional[float]
    metrics: dict[str, Any]
    reliability: dict[str, Any]
    object_keys: dict[str, Any]
    limitations: str
    download_urls: dict[str, str] = Field(default_factory=dict)


class IcePersistRequest(BaseModel):
    project_id: uuid.UUID
    thresholds: dict[str, Any] = Field(default_factory=dict)
    cluster_metrics: dict[str, Any] = Field(default_factory=dict)
    volume_scenarios: dict[str, Any] = Field(default_factory=dict)
    landing_candidates: list[dict[str, Any]] = Field(default_factory=list)
    rover_routes: list[dict[str, Any]] = Field(default_factory=list)
    object_keys: dict[str, Any] = Field(default_factory=dict)
    meta: dict[str, Any] = Field(default_factory=dict)


class ExportCreate(BaseModel):
    run_id: uuid.UUID
    include: list[str] = Field(default_factory=lambda: ["imagery", "metrics", "geojson", "readme"])


class ExportOut(ORMModel):
    id: uuid.UUID
    run_id: uuid.UUID
    status: str
    object_key: Optional[str]
    byte_size: int
    meta: dict[str, Any]
    error: Optional[str]
    download_url: Optional[str] = None
    created_at: datetime


class HealthOut(BaseModel):
    status: str
    service: str
    app_env: str
    database: str
    redis: str
    minio: str
    matchers: list[dict[str, Any]]
