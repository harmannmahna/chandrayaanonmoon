# LunaMatch

Honest lunar image registration + polar mission-planning prototype for Smart India Hackathon
Problem Statement **26166** — sun-angle and scale-robust correspondence on Chandrayaan-2–style
optical imagery, with an educational ice/traverse planner.

## Stack

- **Frontend:** React + Vite + TypeScript, Tailwind CSS v4, Framer Motion,
  react-three-fiber + drei
- **Backend:** FastAPI (legacy demo + `/api/v1` platform), OpenCV (CLAHE + RANSAC),
  MatcherEngine router (`akaze` | `superpoint_lightglue` | `loftr`)
- **Platform (optional Docker):** PostgreSQL/PostGIS, Redis, Celery, MinIO
- Mission UX: reliability agent, experiment history, LunaGuide (offline), Ctrl/Cmd+K palette,
  Local demo mode vs Platform mode

## Features

1. Cinematic landing page with orbitable 3D Moon
2. Image Registration wizard: CLAHE → correspondence matching → RANSAC → plain-language conclusion
3. LUNA/ICE prototype mission planner (illustrative CPR/DOP layers + landing/route/volume)
   — walkthrough: [`docs/ICE_DETECTION.md`](docs/ICE_DETECTION.md)
4. Solar System explorer + Illumination Lab (educational sun-angle visuals)
5. Mission Briefing narrative
6. Dark/light mode + ambient soundtrack toggle
7. AI model selector + Match Reliability Agent + experiment JSON export (Register)
8. Command palette (`Ctrl/Cmd+K`)
9. Platform APIs: projects, MinIO uploads, Celery registration jobs, ice persistence, ZIP exports
   — details: [`docs/PLATFORM.md`](docs/PLATFORM.md)

## Run (recommended legacy / single origin)

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
(cd ../frontend && npm install && npm run build)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open **http://127.0.0.1:8000/register**. Legacy disk jobs work without Docker.
Platform routes need Postgres/Redis/MinIO (see Compose below).

## Docker Compose (full platform)

```bash
cp .env.example .env
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend (nginx) | http://localhost:8080 |
| API / SPA | http://localhost:8000 |
| OpenAPI docs | http://localhost:8000/docs |
| MinIO console | http://localhost:9001 (minioadmin / minioadmin) |
| Flower (optional) | `docker compose --profile flower up flower` → :5555 |

Migrations: `cd backend && alembic upgrade head` (Compose runs this on API start).

## Optional AI engines

```bash
cd backend && source .venv/bin/activate
pip install -r requirements-ai.txt
```

Without these deps, AI engines report **Unavailable** (or labeled AKAZE fallback).

## Honesty notes

- SIH prototype — **not official ISRO software**.
- Default matcher is **AKAZE + Lowe-ratio**, not trained LoFTR unless real weights run.
- RMSE is **pixel reprojection/inlier error**, not geodetic lunar accuracy.
- Ice CPR/DOP / planner outputs are illustrative unless explicitly labeled otherwise.
- No confirmed ice; no operational landing certification.
- Reliability score ≠ independent geodetic accuracy.
