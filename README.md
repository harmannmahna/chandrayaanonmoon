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

## Quick start

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173 — API calls proxy through `/api` to the backend.

## Honesty notes

- Matcher is a **LoFTR-style adapter**, not trained LoFTR weights (documented in UI).
- Demo imagery may be synthetic crater fields when mission patches are unavailable.
- RMSE is inlier pixel reprojection error, not lunar geodetic accuracy.
- Ice CPR/DOP maps in the demo are synthetic but use the real threshold logic.
- Not an official ISRO product.
