# LunaMatch

Gamified glassmorphic lunar image correspondence demo for Smart India Hackathon
Problem Statement **26166** — multi-modal, sun-angle and scale-invariant matching
on Chandrayaan-2 optical imagery.

## Stack

- **Frontend:** React + Vite + TypeScript, Tailwind CSS v4, Framer Motion,
  react-three-fiber + drei
- **Backend:** FastAPI, OpenCV (CLAHE + RANSAC), LoFTR-style dense matcher adapter
  (AKAZE+ratio grid scoring; swap for `kornia.feature.LoFTR` when GPU weights available)

## Features

1. Cinematic landing page with orbitable 3D Moon
2. Image Registration wizard: CLAHE → matching → RANSAC → plain-language conclusion
3. Ice Detection module (CPR > 1 & DOP < 0.13) framed as a registration-enabled ISRO need
4. Solar System explorer (Sun, Moon, 8 planets)
5. Mission Briefing narrative
6. Dark/light mode + ambient soundtrack toggle


## Run (recommended — fixes "Failed to fetch")

Use **one server** so the UI and API share the same origin:

```bash
# Backend (Python 3.11)
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# build UI once
(cd ../frontend && npm install && npm run build)
uvicorn main:app --host 0.0.0.0 --port 8000
```

Open **http://127.0.0.1:8000/register** (not only :5173).

Optional Vite hot-reload UI still proxies `/api` → `:8000`, but if your browser tunnel breaks POSTs, prefer the single-origin URL above.

## Quick start

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Open http://127.0.0.1:5173 — API calls proxy through `/api` to the backend.
If you open the UI via a LAN/tunnel URL, keep the backend on `0.0.0.0:8000` so the
browser fallback (`hostname:8000`) works when the Vite proxy is unavailable.

## Honesty notes

- Matcher is a **LoFTR-style adapter**, not trained LoFTR weights (documented in UI).
- Demo imagery may be synthetic crater fields when mission patches are unavailable.
- RMSE is inlier pixel reprojection error, not lunar geodetic accuracy.
- Ice CPR/DOP maps in the demo are synthetic but use the real threshold logic.
- Not an official ISRO product.
