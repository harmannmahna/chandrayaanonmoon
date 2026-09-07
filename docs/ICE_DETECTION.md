# Ice Detection Model — End-to-End Guide

This document explains how LunaMatch’s **Option B · Subsurface Ice Detection** works, from the browser API call through optical base selection, synthetic radar proxies (CPR / DOP), thresholding, overlays, and what is (and is not) a real ML model.

> **Honesty note:** This is a **demo / SIH-facing screening pipeline**, not an official ISRO DFSAR product. CPR and DOP maps are **synthetic proxies shaped by the optical scene**. There is **no trained neural network** for ice classification in this repo.

---

## 1. What the feature is trying to show

After (or without) image registration, the ice screen answers:

> “On this lunar patch, which shadowed bowls look **ice-like** under the classic dual gate **CPR > 1 AND DOP < 0.13**?”

Registration matters because real mission analysis needs **optical morphology** (e.g. OHRC) and **radar polarimetry** (e.g. DFSAR CPR/DOP) on a **shared pixel grid**. LunaMatch demonstrates that idea: reuse the user’s registered scene as the optical base, then overlay CPR/DOP-style criteria.

---

## 2. Frontend → API hit

### UI entry

| Piece | Location |
| --- | --- |
| Page | `frontend/src/pages/IceDetectionPage.tsx` |
| Route | `/ice` |
| Client helper | `runIce()` in `frontend/src/api/client.ts` |
| Job linkage | `useAppStore().lastRegistrationJobId` (set when registration upload/demo succeeds) |

### Request

```http
POST /api/process/ice
Content-Type: multipart/form-data

job_id=<optional registration job id>
```

- If the user already ran **Register** (upload or demo), the page sends that `job_id`.
- If no job exists, `job_id` is omitted and the backend falls back to **synthetic demo terrain**.

The Vite / single-origin stack prefixes API calls with `/api`. FastAPI strips that prefix and routes to:

```python
@app.post("/process/ice")
async def process_ice(job_id: str | None = Form(None)) -> dict[str, Any]:
    return run_ice_detection(RESULT_DIR, job_id)
```

Implementation: `backend/main.py` → `backend/pipeline/ice.py` · `run_ice_detection()`.

### Response (shape)

```json
{
  "criteria": "CPR > 1 AND DOP < 0.13",
  "overlay_url": "/results/<id>/ice_overlay.png",
  "optical_url": "/results/<id>/optical.png",
  "candidate_pixels": 12345,
  "estimated_ice_volume_m3": 9876.5,
  "regions": [
    {
      "name": "Shadowed bowl A — CPR+DOP ice-like",
      "confidence": "high",
      "bbox": [x0, y0, x1, y1],
      "mean_cpr": 1.32,
      "mean_dop": 0.08
    }
  ],
  "terrain_note": "...",
  "relevance": "...",
  "landing_path_status": "in progress — ...",
  "source_image": "registration_job:<uuid>" | "synthetic_demo",
  "used_registration_job": true
}
```

The UI shows the optical frame, color overlay, metrics, and region list. Static result images are served under `/results/...`.

---

## 3. Pipeline overview

```text
Browser (IceDetectionPage)
    │  POST /api/process/ice  (optional job_id)
    ▼
FastAPI  process_ice
    ▼
run_ice_detection(result_dir, job_id)
    │
    ├─ 1) Resolve optical base image
    │      (registered CLAHE / overlay / upload, else synthetic craters)
    │
    ├─ 2) Build PSR-like dark bowls from optical shadows
    │      (blur → percentile dark mask → morphology → connected components)
    │
    ├─ 3) Synthesize CPR & DOP maps
    │      (Gaussian noise + elevated CPR / lowered DOP inside bowls)
    │
    ├─ 4) Apply dual gate
    │      both      = CPR > 1  AND  DOP < 0.13   → ice-like (lime)
    │      cpr_only  = CPR > 1  AND  DOP ≥ 0.13   → clutter (cyan/orange)
    │
    ├─ 5) Paint overlay + write PNGs
    │
    └─ 6) Summarize regions, volume estimate, copy for judges
```

---

## 4. Step-by-step: `run_ice_detection`

Source of truth: `backend/pipeline/ice.py`.

### 4.1 Optical base selection

`_load_job_optical(result_dir, job_id)` walks candidates **in order** and returns the first readable image:

1. `results/<job_id>/clahe/enhanced_0.png` — CLAHE-enhanced **reference**
2. `results/<job_id>/clahe/original_0.png`
3. `results/<job_id>/ransac/overlay.png`
4. `results/<job_id>/ransac/warped.png`
5. `uploads/<job_id>/img_0.png`

If none exist (or no `job_id`), a **procedural crater field** is drawn (`synthetic_demo`) so the page still demos.

`source_image` in the response records either `registration_job:<id>` or `synthetic_demo`.

### 4.2 Shadow / PSR-proxy bowls (classical CV — not a neural net)

Algorithms / OpenCV ops used:

| Step | What | Why |
| --- | --- | --- |
| Grayscale | `cv2.cvtColor(..., BGR2GRAY)` | Work on intensity |
| Large blur | `GaussianBlur(..., 31×31)` | Smooth terrain for bowl-scale darkness |
| Dark mask | pixels below **28th percentile** of blur | Proxy for permanently shadowed / deep bowls |
| Morphology | `MORPH_OPEN` then `MORPH_CLOSE` | Drop speckles, close gaps |
| Components | `connectedComponentsWithStats` | Rank dark blobs by area |
| Keep top 1–2 blobs | area > ~0.4% of image | “Bowl A / Bowl B” |

If the photo has almost no dark structure, two **fallback ellipses** are placed as stand-in bowls.

These bowls are **geometry proxies for PSRs**, derived only from the optical photo — not from real illumination / DEM ray-tracing.

### 4.3 Synthetic CPR & DOP “maps”

There is **no DFSAR archive** and **no trained radar model** in-browser. Maps are generated with NumPy RNG seeded from `job_id` (stable per job):

- Background:
  - `CPR ~ Normal(0.55, 0.12)`
  - `DOP ~ Normal(0.35, 0.08)`
- Inside bowl A (ice-like target):
  - `CPR ~ Normal(1.35, 0.15)`  (often **> 1**)
  - `DOP ~ Normal(0.08, 0.02)`  (often **< 0.13**)
- Inside bowl B (clutter contrast):
  - `CPR ~ Normal(1.15, 0.10)`  (often **> 1**)
  - `DOP ~ Normal(0.18, 0.03)`  (often **≥ 0.13** → fails DOP gate)

Values are clipped: CPR ∈ [0, 3], DOP ∈ [0, 1].

So the “model” here is a **rule-based polarimetric screening demo** driven by **hand-crafted distributions**, not learned weights.

### 4.4 Decision rule (the actual ice criterion)

```text
ice-like (both)     :=  CPR > 1.0  AND  DOP < 0.13
CPR-only (clutter)  :=  CPR > 1.0  AND  DOP ≥ 0.13
neither             :=  everything else
```

This mirrors the PS narrative: **high circular polarization ratio alone is not enough** (rocks / roughness can raise CPR); the **DOP gate** rejects many clutter cases.

### 4.5 Overlay coloring

Painted on a copy of the optical image:

| Class | Appearance | Meaning |
| --- | --- | --- |
| neither | dimmed optical | Not a candidate |
| CPR-only | cyan / orange tint | High CPR but fails DOP → likely rocky clutter |
| both (ice-like) | lime / yellow-green | Passes **both** gates |

Files written:

- `results/<id>/ice_overlay.png`
- `results/<id>/optical.png`

### 4.6 Metrics & region cards

- **`candidate_pixels`**: count of pixels in the `both` mask.
- **`estimated_ice_volume_m3`**: crude demo formula  
  `area_px × (2 m/px)² × 5 m thickness × 0.08 fill factor` — **illustrative only**, not a science volume product.
- **`regions`**: up to two named bowls with qualitative `"high"` / `"low"` confidence, bbox, and mean CPR/DOP inside the relevant mask.
- **`landing_path_status`**: placeholder string (waypoint UI not shipped).

---

## 5. Models & algorithms — what’s real vs demo

| Component | Type | Package / method | Trained weights? |
| --- | --- | --- | --- |
| Optical load | I/O | OpenCV `imread` | No |
| Shadow bowls | Classical CV | Gaussian blur, percentile threshold, morphology, connected components | No |
| CPR / DOP fields | Synthetic RNG | NumPy `Generator.normal` | No |
| Ice decision | Hard thresholds | `CPR > 1` ∧ `DOP < 0.13` | No |
| Overlay | Image blend | NumPy / OpenCV | No |
| Volume estimate | Heuristic scalar | Fixed m/px & thickness assumptions | No |

**Not used for ice in this repo:** LoFTR, AKAZE, RANSAC, CLAHE (those belong to **registration**). Ice **reuses registration outputs as imagery**, but does not re-run the matcher.

If you later plug in real DFSAR CPR/DOP GeoTIFFs, replace step 4.3 with file loads (same thresholds and overlay path can stay).

---

## 6. How registration feeds ice

Typical happy path:

1. User runs **Image Registration Wizard** (`/register`).
2. Backend creates a `job_id`, runs CLAHE → LoFTR-style match → RANSAC.
3. Frontend store saves `lastRegistrationJobId`.
4. User opens **Ice Detection** (`/ice`) and clicks **Run ice screening**.
5. `POST /process/ice` with that `job_id` → optical base = that scene’s CLAHE/reference.
6. Overlay answers: “ice-like highlights on **the same area you registered**.”

Without registration, ice still runs on demo terrain so judges can see the CPR/DOP story.

---

## 7. Related API surface (registration context)

Ice itself is one endpoint, but the optical base usually comes from earlier hits:

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/upload` or `/demo/load` | Create job + images |
| `POST` | `/process/clahe` | Enhance reference/source |
| `POST` | `/process/loftr` | Keypoint matches (green/red) |
| `POST` | `/process/ransac` | Homography + overlays |
| `POST` | `/process/ice` | **This document** |
| `GET` | `/results/...` | PNG overlays |

Health: `GET /health`.

---

## 8. Files to read

| File | Role |
| --- | --- |
| `backend/pipeline/ice.py` | Full ice screening implementation |
| `backend/main.py` | `POST /process/ice` route |
| `frontend/src/pages/IceDetectionPage.tsx` | UI + copy |
| `frontend/src/api/client.ts` | `runIce()` / `IceResponse` types |
| `frontend/src/store/appStore.ts` | `lastRegistrationJobId` bridge |

---

## 9. Limitations (say this to judges)

1. **CPR/DOP are synthetic** — shaped by shadows in the optical image, not real Chandrayaan-2 DFSAR granules.
2. **No ML ice classifier** — thresholds + classical CV only.
3. **Volume estimate is a placeholder** — not validated against ice thickness models.
4. **Landing path** is stubbed.
5. **Not official ISRO science software** — SIH demo for PS 26166 pedagogy (registration enables multi-modal screening).

---

## 10. Extending toward a “real” model

Suggested upgrade path without rewriting the UI contract:

1. Ingest calibrated **CPR** and **DOP** rasters co-registered to the optical frame (after LunaMatch RANSAC / external georef).
2. Keep the same dual gate (or learn a small classifier on labeled PSR pixels).
3. Optionally add DEM-based true PSR masks instead of intensity percentile bowls.
4. Return the same JSON fields (`overlay_url`, `regions`, `criteria`, …) so `IceDetectionPage` stays unchanged.
