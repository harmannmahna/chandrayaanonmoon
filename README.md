# LunaMatch

Honest lunar image registration + polar mission-planning prototype for Smart India Hackathon
Problem Statement **26166** — sun-angle and scale-robust correspondence on Chandrayaan-2–style
optical imagery, with an educational ice/traverse planner.

## Stack

- **Frontend:** React + Vite + TypeScript, Tailwind CSS v4, Framer Motion,
  react-three-fiber + drei
- **Backend:** FastAPI, OpenCV (CLAHE + RANSAC), MatcherEngine router:
  - `akaze` — classical AKAZE + Lowe ratio (always available baseline)
  - `superpoint-lightglue` — optional pretrained SuperPoint + LightGlue (torch/kornia)
  - `loftr` — optional pretrained LoFTR outdoor (torch/kornia)
- Mission UX: reliability agent, experiment history, LunaGuide (offline), Ctrl/Cmd+K palette

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

### Optional AI engines

```bash
cd backend
source .venv/bin/activate
pip install -r requirements-ai.txt
# restart uvicorn; check GET /matchers
```

Without these deps, AI Fast / AI Robust show **Unavailable**. Matching can fall back to
**AKAZE** and will be labeled **Fallback used** — results are never silently labeled as LoFTR.

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

### Backend unit checks

```bash
cd backend
source .venv/bin/activate
python -m pytest tests/test_mission_ai.py -q
```

## Honesty notes

- Default matcher is **AKAZE + Lowe-ratio**, not trained LoFTR. Optional LoFTR / SuperPoint+LightGlue
  only run when `requirements-ai.txt` is installed and weights load successfully.
- Demo imagery may be sample crater fields when mission patches are unavailable.
- RMSE is inlier pixel reprojection error, not lunar geodetic accuracy.
- Reliability score is an internal explainable quality metric — not independent geodetic accuracy.
- Ice CPR/DOP maps in the demo planner are illustrative; thresholds demonstrate screening logic.
- Illumination Lab visuals are educational / synthetic — not SPICE or official PSR products.
- Not an official ISRO product.
