# LunaMatch Platform (Postgres / Redis / MinIO / Celery)

This document describes the production-style backend layered on top of the existing
FastAPI demo pipeline. **Local demo mode remains the default** in the UI when
platform services are unavailable.

## Architecture

```
Frontend → FastAPI (legacy + /api/v1)
        → PostgreSQL/PostGIS (metadata)
        → MinIO (binary imagery / exports)
        → Redis → Celery workers (OpenCV / optional ML)
```

## Quick start (Docker Compose)

```bash
cp .env.example .env
# optional: npm --prefix frontend run build   # for SPA on :8000
docker compose up --build
```

- UI (nginx): http://localhost:8080
- API + SPA: http://localhost:8000
- OpenAPI: http://localhost:8000/docs
- MinIO console: http://localhost:9001 (minioadmin / minioadmin)
- Flower (optional): `docker compose --profile flower up flower` → http://localhost:5555

### Migrations

```bash
cd backend
export DATABASE_URL=postgresql+psycopg://lunamatch:lunamatch@localhost:5432/lunamatch
alembic upgrade head
```

Compose runs `alembic upgrade head` automatically before the API starts.

## Local (without Docker) — legacy demo

```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Legacy disk-backed jobs continue to work. Platform routes require Postgres/Redis/MinIO.

## Platform API (prefix `/api/v1` or `/v1`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/health` | DB / Redis / MinIO / matchers |
| GET/POST/PATCH/DELETE | `/api/v1/projects` | Projects CRUD |
| POST | `/api/v1/datasets/uploads/init` | Presigned PUT URL |
| POST | `/api/v1/datasets/uploads/confirm` | Confirm object exists |
| GET | `/api/v1/datasets/project/{id}` | List datasets |
| POST | `/api/v1/registration/runs` | Queue AKAZE/AI registration |
| GET | `/api/v1/registration/runs/{id}` | Status / lineage |
| GET | `/api/v1/registration/runs/{id}/results` | Metrics + signed URLs |
| POST | `/api/v1/registration/runs/{id}/cancel` | Cancel |
| POST | `/api/v1/ice/runs` | Persist ice planner results |
| POST | `/api/v1/exports` | Async ZIP export |
| GET | `/api/v1/exports/{id}` | Export status + download URL |

## Matcher engines

| Engine | Usable by default? |
|--------|--------------------|
| `akaze` | **Yes** — classical OpenCV baseline |
| `superpoint_lightglue` | Only if `requirements-ai.txt` (torch/kornia) installed |
| `loftr` | Only if torch/kornia + weights available |

Unavailable AI engines return explicit status or labeled AKAZE fallback — never fabricated AI matches.

## Smoke flow

```bash
# with compose up
curl -s http://127.0.0.1:8000/api/v1/health | jq
PROJ=$(curl -s -X POST http://127.0.0.1:8000/api/v1/projects -H 'Content-Type: application/json' -d '{"name":"Demo"}' | jq -r .id)
bash backend/scripts/seed_demo_datasets.sh "$PROJ"
# then POST /api/v1/registration/runs with returned dataset IDs
```

## Honesty / limitations

- SIH prototype — not official ISRO software.
- RMSE is pixel reprojection/inlier error, not geodetic accuracy.
- Ice CPR/DOP / planner outputs remain illustrative unless explicitly labeled otherwise.
- No confirmed ice; no operational landing certification.
- Do not describe AKAZE as LoFTR.
