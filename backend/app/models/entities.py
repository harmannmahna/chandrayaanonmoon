"""ORM models for LunaMatch platform."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(200), default="Demo Analyst")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    projects: Mapped[list["Project"]] = relationship(back_populates="owner")


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    owner: Mapped[Optional[User]] = relationship(back_populates="projects")
    datasets: Mapped[list["Dataset"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    runs: Mapped[list["AnalysisRun"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Dataset(Base, TimestampMixin):
    __tablename__ = "datasets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(64), default="optical")
    content_type: Mapped[str] = mapped_column(String(128))
    byte_size: Mapped[int] = mapped_column(Integer, default=0)
    object_key: Mapped[str] = mapped_column(String(512))
    checksum_sha256: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    data_status: Mapped[str] = mapped_column(String(64), default="real uploaded image")
    # illustrative | synthetic | real uploaded image
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    footprint: Mapped[Optional[Any]] = mapped_column(Geometry(geometry_type="POLYGON", srid=4326), nullable=True)

    project: Mapped[Project] = relationship(back_populates="datasets")


class ModelConfig(Base, TimestampMixin):
    __tablename__ = "model_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    engine: Mapped[str] = mapped_column(String(64), unique=True)
    version: Mapped[str] = mapped_column(String(64), default="unknown")
    device: Mapped[str] = mapped_column(String(32), default="cpu")
    available: Mapped[bool] = mapped_column(Boolean, default=False)
    detail: Mapped[str] = mapped_column(Text, default="")
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class AnalysisRun(Base, TimestampMixin):
    __tablename__ = "analysis_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), index=True)
    kind: Mapped[str] = mapped_column(String(64), default="registration")
    status: Mapped[str] = mapped_column(String(32), default="queued", index=True)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    message: Mapped[str] = mapped_column(Text, default="")
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    engine: Mapped[str] = mapped_column(String(64), default="akaze")
    params: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    lineage: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped[Project] = relationship(back_populates="runs")
    registration: Mapped[Optional["RegistrationResult"]] = relationship(
        back_populates="run", uselist=False, cascade="all, delete-orphan"
    )
    ice: Mapped[Optional["IceAnalysisResult"]] = relationship(
        back_populates="run", uselist=False, cascade="all, delete-orphan"
    )
    exports: Mapped[list["Export"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class RegistrationResult(Base, TimestampMixin):
    __tablename__ = "registration_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("analysis_runs.id"), unique=True)
    engine: Mapped[str] = mapped_column(String(64))
    engine_version: Mapped[str] = mapped_column(String(64), default="opencv-akaze")
    device: Mapped[str] = mapped_column(String(32), default="cpu")
    fallback_used: Mapped[bool] = mapped_column(Boolean, default=False)
    runtime_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    reliability: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    object_keys: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    limitations: Mapped[str] = mapped_column(Text, default="")
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    run: Mapped[AnalysisRun] = relationship(back_populates="registration")


class IceAnalysisResult(Base, TimestampMixin):
    __tablename__ = "ice_analysis_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("analysis_runs.id"), unique=True)
    thresholds: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    cluster_metrics: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    volume_scenarios: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    object_keys: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    disclaimer: Mapped[str] = mapped_column(Text, default="")
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    run: Mapped[AnalysisRun] = relationship(back_populates="ice")
    landing_candidates: Mapped[list["LandingCandidate"]] = relationship(
        back_populates="ice_result", cascade="all, delete-orphan"
    )
    rover_routes: Mapped[list["RoverRoute"]] = relationship(
        back_populates="ice_result", cascade="all, delete-orphan"
    )


class LandingCandidate(Base, TimestampMixin):
    __tablename__ = "landing_candidates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    ice_result_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ice_analysis_results.id"))
    name: Mapped[str] = mapped_column(String(128))
    score: Mapped[float] = mapped_column(Float, default=0.0)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    location: Mapped[Optional[Any]] = mapped_column(Geometry(geometry_type="POINT", srid=4326), nullable=True)
    disclaimer: Mapped[str] = mapped_column(Text, default="Prototype suitability — not landing certification.")

    ice_result: Mapped[IceAnalysisResult] = relationship(back_populates="landing_candidates")


class RoverRoute(Base, TimestampMixin):
    __tablename__ = "rover_routes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    ice_result_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ice_analysis_results.id"))
    name: Mapped[str] = mapped_column(String(128), default="route")
    mode: Mapped[str] = mapped_column(String(64), default="solar_aware")
    geojson: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    geom: Mapped[Optional[Any]] = mapped_column(Geometry(geometry_type="LINESTRING", srid=4326), nullable=True)
    disclaimer: Mapped[str] = mapped_column(Text, default="Grid planning support — not certified navigation.")

    ice_result: Mapped[IceAnalysisResult] = relationship(back_populates="rover_routes")


class Export(Base, TimestampMixin):
    __tablename__ = "exports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("analysis_runs.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="queued")
    object_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    byte_size: Mapped[int] = mapped_column(Integer, default=0)
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    run: Mapped[AnalysisRun] = relationship(back_populates="exports")


class AuditEvent(Base, TimestampMixin):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    actor: Mapped[str] = mapped_column(String(200), default="system")
    action: Mapped[str] = mapped_column(String(128))
    entity_type: Mapped[str] = mapped_column(String(64), default="")
    entity_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    detail: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
