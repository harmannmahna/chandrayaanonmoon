"""Platform API tests (requires Postgres + MinIO, or skips)."""

from __future__ import annotations

import io
import os
import sys
import time
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

# Force eager Celery for in-process worker execution during tests
os.environ.setdefault("CELERY_TASK_ALWAYS_EAGER", "true")
os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get("DATABASE_URL", "postgresql+psycopg://lunamatch:lunamatch@localhost:5432/lunamatch"),
)
os.environ.setdefault("REDIS_URL", os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
os.environ.setdefault("MINIO_ENDPOINT", os.environ.get("MINIO_ENDPOINT", "localhost:9000"))
os.environ.setdefault("MINIO_ACCESS_KEY", "minioadmin")
os.environ.setdefault("MINIO_SECRET_KEY", "minioadmin")
os.environ.setdefault("MINIO_BUCKET", "lunamatch")
os.environ.setdefault("MINIO_PUBLIC_ENDPOINT", "localhost:9000")

from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()


def _platform_ready() -> bool:
    try:
        from sqlalchemy import create_engine, text

        engine = create_engine(get_settings().database_url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        from app.services.storage import ObjectStorage

        return ObjectStorage().healthcheck() == "ok"
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _platform_ready(), reason="Postgres/MinIO not available")


@pytest.fixture(scope="module")
def client():
    from app.main import app

    with TestClient(app) as c:
        yield c


def test_legacy_health(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["service"] == "lunamatch"


def test_platform_health(client: TestClient):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["database"] == "ok"
    assert body["minio"] == "ok"
    assert any(e["engine"] == "akaze" for e in body["matchers"])


def test_project_create_list(client: TestClient):
    res = client.post("/api/v1/projects", json={"name": f"Test {uuid.uuid4().hex[:6]}", "description": "unit"})
    assert res.status_code == 201
    project = res.json()
    assert project["id"]
    listed = client.get("/api/v1/projects")
    assert listed.status_code == 200
    assert any(p["id"] == project["id"] for p in listed.json())


def _upload_png(client: TestClient, project_id: str, name: str, png_bytes: bytes) -> str:
    init = client.post(
        "/api/v1/datasets/uploads/init",
        json={
            "project_id": project_id,
            "filename": name,
            "content_type": "image/png",
            "byte_size": len(png_bytes),
            "kind": "optical",
            "data_status": "illustrative / sample demo imagery",
        },
    )
    assert init.status_code == 200, init.text
    body = init.json()
    put = client.put(body["upload_url"], content=png_bytes, headers={"Content-Type": "image/png"})
    # boto presigned may be absolute to minio — TestClient can't follow external hosts.
    # Fall back to storage SDK put if PUT via HTTP to localhost MinIO is needed.
    if put.status_code >= 400:
        from app.services.storage import ObjectStorage

        ObjectStorage().put_bytes(body["object_key"], png_bytes, "image/png")
    confirm = client.post("/api/v1/datasets/uploads/confirm", json={"dataset_id": body["dataset_id"]})
    assert confirm.status_code == 200, confirm.text
    return body["dataset_id"]


def test_dataset_metadata_and_registration_smoke(client: TestClient):
    import cv2
    import numpy as np

    project = client.post("/api/v1/projects", json={"name": f"Smoke {uuid.uuid4().hex[:6]}"}).json()
    # Synthetic textured pair
    rng = np.random.default_rng(0)
    a = (rng.random((256, 256)) * 255).astype(np.uint8)
    b = np.roll(a, 8, axis=1)
    ok1, buf1 = cv2.imencode(".png", a)
    ok2, buf2 = cv2.imencode(".png", b)
    assert ok1 and ok2
    ref_id = _upload_png(client, project["id"], "ref.png", buf1.tobytes())
    src_id = _upload_png(client, project["id"], "src.png", buf2.tobytes())

    run = client.post(
        "/api/v1/registration/runs",
        json={
            "project_id": project["id"],
            "reference_dataset_id": ref_id,
            "source_dataset_id": src_id,
            "engine": "akaze",
            "allow_fallback": True,
        },
    )
    assert run.status_code == 201, run.text
    run_id = run.json()["id"]

    # Eager celery should complete quickly
    deadline = time.time() + 60
    status = None
    while time.time() < deadline:
        status = client.get(f"/api/v1/registration/runs/{run_id}").json()
        if status["status"] in {"completed", "failed", "cancelled"}:
            break
        time.sleep(0.5)
    assert status is not None
    assert status["status"] == "completed", status

    results = client.get(f"/api/v1/registration/runs/{run_id}/results")
    assert results.status_code == 200
    body = results.json()
    assert body["engine"] == "akaze"
    assert "rmse_px" in body["metrics"]
    assert body["reliability"]["score"] is not None
    assert "geodetic" in body["limitations"].lower() or "prototype" in body["limitations"].lower()

    exp = client.post("/api/v1/exports", json={"run_id": run_id})
    assert exp.status_code == 201
    export_id = exp.json()["id"]
    deadline = time.time() + 30
    export_body = None
    while time.time() < deadline:
        export_body = client.get(f"/api/v1/exports/{export_id}").json()
        if export_body["status"] in {"completed", "failed"}:
            break
        time.sleep(0.3)
    assert export_body["status"] == "completed"
    assert export_body["download_url"]
