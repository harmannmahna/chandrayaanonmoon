"""Platform health + matcher catalog."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.schemas.platform import HealthOut
from app.services.matchers import list_matcher_engines
from app.services.storage import ObjectStorage, get_storage

router = APIRouter(tags=["platform"])


@router.get("/health", response_model=HealthOut)
def platform_health(db: Session = Depends(get_db), storage: ObjectStorage = Depends(get_storage)) -> HealthOut:
    settings = get_settings()
    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        db_status = f"error: {exc}"

    redis_status = "unknown"
    try:
        import redis

        r = redis.Redis.from_url(settings.redis_url)
        r.ping()
        redis_status = "ok"
    except Exception as exc:  # noqa: BLE001
        redis_status = f"error: {exc}"

    return HealthOut(
        status="ok" if db_status == "ok" else "degraded",
        service="lunamatch-platform",
        app_env=settings.app_env,
        database=db_status,
        redis=redis_status,
        minio=storage.healthcheck(),
        matchers=list_matcher_engines(),
    )


@router.get("/matchers")
def platform_matchers() -> dict:
    return {"engines": list_matcher_engines(), "note": "AKAZE is the classical baseline. AI engines require optional torch/kornia."}
