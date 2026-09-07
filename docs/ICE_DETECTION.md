# Ice Mission Planner — End-to-End Guide

This document covers both:

1. **Legacy backend screening** (`POST /process/ice` · `backend/pipeline/ice.py`) — still available.
2. **LUNA/ICE staged planner** (browser Stage 3 on `/ice`) — upload → CLAHE enhance → illustrative radar/landing/route/volume simulator.

> **Honesty note:** Demo CPR/DOP layers are **illustrative / supplied**. Prefer “potential subsurface-ice signature”, “mission-planning simulator”, and “planning support, not mission certification.” Never “confirmed ice.”

---

## LUNA/ICE staged UI (primary)

| Stage | Route UI | What happens |
| --- | --- | --- |
| 1 · Upload | `/ice` | Optical images or demo pair (reuses `/upload` / `/demo/load`) |
| 2 · Enhance | `/ice` | CLAHE via `/process/clahe` + before/after slider |
| 3 · Mission planner | `/ice` | Browser **synthetic** crater simulator: CPR/DOP/PSR → clusters → landing → A* route → volume → ZIP export |
| Context | `/briefing` (panel 05) | CPR/DOP definitions, workflow, limits |

Core browser modules live under `frontend/src/lib/ice/`:

- `demoData.ts` — deterministic 160×160 doubly-shadowed crater (**synthetic**)
- `iceAnalysis.ts` — `IceCandidate = (CPR > thr) ∧ (DOP < thr) ∧ DoublyShadowedMask`
- `landingAnalysis.ts` — weighted prototype landing suitability
- `pathPlanning.ts` — 8-neighbour A* (science-first / solar-aware / battery-supported)
- `volumeEstimator.ts` — `V = A × depth × fraction`, `M = V × 917` (scenario explorer)
- `exports.ts` — PNG/JSON/GeoJSON/CSV + JSZip mission package

Self-check: `cd frontend && npm run ice:selfcheck`

---

## Legacy backend endpoint (unchanged)

```http
POST /api/process/ice
Content-Type: multipart/form-data

job_id=<optional registration job id>
```

Implementation: `backend/main.py` → `backend/pipeline/ice.py` · `run_ice_detection()`.

The staged LUNA/ICE Stage 3 analysis does **not** require this endpoint; optical Stages 1–2 still use the registration upload/CLAHE APIs.

---

## Decision rule (shared concept)

```text
IceCandidate = (CPR > 1.0) AND (DOP < 0.13) AND DoublyShadowedMask
```

Volume:

```text
V_ice = A_candidate × depth × iceFraction
M_ice = V_ice × 917 kg/m³
```

Depth is user-selected **0–5 m**. This is a **scenario-based ice-volume estimate**.

---

## Files to read

| File | Role |
| --- | --- |
| `frontend/src/pages/IceDetectionPage.tsx` | Staged LUNA/ICE mission-planning simulator |
| `frontend/src/pages/MissionBriefingPage.tsx` | Briefing panel 05 · ice/planner context |
| `frontend/src/lib/ice/*` | Browser analysis + exports |
| `backend/pipeline/ice.py` | Legacy FastAPI ice screening overlay |

---

## Limitations

1. CPR/DOP demo grids are synthetic / illustrative — not calibrated DFSAR.
2. No ML ice classifier; thresholds + classical CV / grid logic only.
3. Landing/route are prototype planning scores — not certified.
4. Volume does not measure depth or concentration.
5. Not official ISRO science software.
