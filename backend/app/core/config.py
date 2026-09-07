"""Application settings (env-driven)."""

from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    app_name: str = "LunaMatch Platform"
    cors_origins: str = "*"

    database_url: str = "postgresql+psycopg://lunamatch:lunamatch@localhost:5432/lunamatch"
    redis_url: str = "redis://localhost:6379/0"

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "lunamatch"
    minio_secure: bool = False
    minio_public_endpoint: str | None = None  # browser-facing host:port if different

    model_device: str = "cpu"
    max_upload_bytes: int = 50 * 1024 * 1024  # 50 MB
    allowed_upload_types: str = "image/png,image/jpeg,image/webp,image/tiff,application/geo+json,application/json"
    presign_expiry_seconds: int = 900

    celery_task_always_eager: bool = False  # True for tests / local without worker

    @property
    def cors_origin_list(self) -> List[str]:
        raw = self.cors_origins.strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def allowed_content_types(self) -> set[str]:
        return {t.strip() for t in self.allowed_upload_types.split(",") if t.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
