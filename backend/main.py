"""LunaMatch API — CLAHE → LoFTR-style matching → RANSAC → ice detection."""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from pipeline.clahe import run_clahe
from pipeline.ice import run_ice_detection
from pipeline.jobs import init_jobs
from pipeline.matcher import run_loftr_style
from pipeline.ransac import run_ransac

ROOT = Path(__file__).resolve().parent
UPLOAD_DIR = ROOT / "uploads"
RESULT_DIR = ROOT / "results"
SAMPLE_DIR = ROOT / "samples"
FRONTEND_DIST = ROOT.parent / "frontend" / "dist"

for d in (UPLOAD_DIR, RESULT_DIR, SAMPLE_DIR):
    d.mkdir(parents=True, exist_ok=True)

JOBS = init_jobs(UPLOAD_DIR, RESULT_DIR)

app = FastAPI(title="LunaMatch API", version="1.0.0")


class StripApiPrefixMiddleware(BaseHTTPMiddleware):
    """Allow both `/health` and `/api/health` (Vite proxy + single-origin UI)."""

    async def dispatch(self, request: Request, call_next):
        path = request.scope.get("path", "")
        if path == "/api":
            request.scope["path"] = "/"
        elif path.startswith("/api/"):
            request.scope["path"] = path[4:]
        return await call_next(request)


# Wildcard origins + credentials=True makes browsers fail with "Failed to fetch".
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(StripApiPrefixMiddleware)
app.mount("/results", StaticFiles(directory=str(RESULT_DIR)), name="results")
app.mount("/samples", StaticFiles(directory=str(SAMPLE_DIR)), name="samples")


def _decode(data: bytes) -> np.ndarray:
    img = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Could not decode image")
    return img


def _save(path: Path, img: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), img)


def _draw_matches(ref: np.ndarray, src: np.ndarray, match: dict[str, Any]) -> np.ndarray:
    """Side-by-side preview: green lines = matched pairs, red dots = unmatched keypoints."""
    mk0 = np.asarray(match.get("mkpts0") or [], dtype=np.float32)
    mk1 = np.asarray(match.get("mkpts1") or [], dtype=np.float32)
    conf = np.asarray(match.get("mconf") or [1.0] * len(mk0), dtype=np.float32)
    u0 = np.asarray(match.get("unmatched0") or [], dtype=np.float32)
    u1 = np.asarray(match.get("unmatched1") or [], dtype=np.float32)

    green = (40, 220, 80)   # BGR — matched
    red = (40, 40, 255)     # BGR — unmatched

    h = max(ref.shape[0], src.shape[0])
    canvas = np.zeros((h, ref.shape[1] + src.shape[1], 3), dtype=np.uint8)
    canvas[: ref.shape[0], : ref.shape[1]] = ref
    canvas[: src.shape[0], ref.shape[1] :] = src

    # Unmatched keypoints first (underneath)
    for i in range(min(len(u0), 400)):
        p = (int(u0[i][0]), int(u0[i][1]))
        cv2.circle(canvas, p, 3, red, -1, cv2.LINE_AA)
    for i in range(min(len(u1), 400)):
        p = (int(u1[i][0] + ref.shape[1]), int(u1[i][1]))
        cv2.circle(canvas, p, 3, red, -1, cv2.LINE_AA)

    # Matched correspondences in green
    for i in range(min(len(mk0), 160)):
        p0 = (int(mk0[i][0]), int(mk0[i][1]))
        p1 = (int(mk1[i][0] + ref.shape[1]), int(mk1[i][1]))
        # Slight alpha via thickness: higher conf → slightly thicker
        c = float(conf[i]) if i < len(conf) else 0.5
        thickness = 2 if c >= 0.35 else 1
        cv2.line(canvas, p0, p1, green, thickness, cv2.LINE_AA)
        cv2.circle(canvas, p0, 3, green, -1, cv2.LINE_AA)
        cv2.circle(canvas, p1, 3, green, -1, cv2.LINE_AA)

    # Legend
    cv2.rectangle(canvas, (8, 8), (210, 58), (0, 0, 0), -1)
    cv2.circle(canvas, (24, 24), 5, green, -1)
    cv2.putText(canvas, "Matched", (36, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (230, 230, 230), 1, cv2.LINE_AA)
    cv2.circle(canvas, (24, 44), 5, red, -1)
    cv2.putText(canvas, "Unmatched", (36, 48), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (230, 230, 230), 1, cv2.LINE_AA)
    return canvas


def _draw_unmatched_on_moon(ref: np.ndarray, match: dict[str, Any]) -> np.ndarray:
    """Separate panel: unmatched keypoints overlaid on the reference moon image only."""
    canvas = ref.copy()
    if canvas.ndim == 2:
        canvas = cv2.cvtColor(canvas, cv2.COLOR_GRAY2BGR)
    u0 = np.asarray(match.get("unmatched0") or [], dtype=np.float32)
    red = (40, 40, 255)
    for i in range(min(len(u0), 600)):
        p = (int(u0[i][0]), int(u0[i][1]))
        cv2.circle(canvas, p, 4, red, -1, cv2.LINE_AA)
        cv2.circle(canvas, p, 6, (20, 20, 180), 1, cv2.LINE_AA)
    cv2.rectangle(canvas, (8, 8), (260, 40), (0, 0, 0), -1)
    cv2.putText(
        canvas,
        f"Unmatched on moon: {len(u0)}",
        (16, 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (230, 230, 230),
        1,
        cv2.LINE_AA,
    )
    return canvas


def _synth_lunar(seed: int, shade: float = 1.0, bias: float = 0.0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:512, 0:512]
    illum = 0.55 + 0.35 * np.sin(xx / 90.0) * np.cos(yy / 110.0) + 0.12 * np.sin((xx + yy) / 140.0)
    base = (42 + 38 * illum).astype(np.float32)
    for _ in range(55):
        cx = int(rng.integers(30, 480))
        cy = int(rng.integers(30, 480))
        radius = int(rng.integers(6, 60))
        floor = float(rng.integers(18, 90))
        rim = float(rng.integers(140, 230))
        cv2.circle(base, (cx, cy), radius, floor, -1)
        cv2.circle(base, (cx, cy), radius, rim, max(1, radius // 14))
        mask = (xx - cx) ** 2 + (yy - cy) ** 2 <= radius**2
        dist = np.sqrt(((xx - cx) ** 2 + (yy - cy) ** 2).astype(np.float32))
        bowl = np.clip(1.0 - dist / max(radius, 1), 0, 1)
        base[mask] = base[mask] * (0.65 + 0.35 * bowl[mask]) + floor * 0.15
    noise = rng.normal(0, 5.5, base.shape).astype(np.float32)
    return np.clip(base * shade + bias + noise, 0, 255).astype(np.uint8)


def _ensure_samples(force: bool = False) -> list[Path]:
    paths = [
        SAMPLE_DIR / "demo_reference.png",
        SAMPLE_DIR / "demo_source.png",
        SAMPLE_DIR / "demo_source_b.png",
    ]
    if not force and all(p.exists() for p in paths):
        return paths
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
    base = _synth_lunar(42)
    H = np.array([[1.08, -0.04, 28.0], [0.035, 0.97, -12.0], [0.0, 0.0, 1.0]], dtype=np.float64)
    warped = cv2.warpPerspective(_synth_lunar(42, shade=0.72, bias=12.0), H, (512, 512), borderMode=cv2.BORDER_REFLECT)
    H2 = np.array([[0.95, 0.05, -18.0], [-0.02, 1.05, 22.0], [0.0, 0.0, 1.0]], dtype=np.float64)
    warped2 = cv2.warpPerspective(_synth_lunar(42, shade=1.15, bias=-8.0), H2, (512, 512), borderMode=cv2.BORDER_REFLECT)
    cv2.imwrite(str(paths[0]), cv2.cvtColor(base, cv2.COLOR_GRAY2BGR))
    cv2.imwrite(str(paths[1]), cv2.cvtColor(warped, cv2.COLOR_GRAY2BGR))
    cv2.imwrite(str(paths[2]), cv2.cvtColor(warped2, cv2.COLOR_GRAY2BGR))
    return paths


_ensure_samples()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "lunamatch", "python": "3.11"}


@app.post("/upload")
async def upload(files: list[UploadFile] = File(...), reference_index: int = Form(0)) -> dict[str, Any]:
    if not files:
        raise HTTPException(400, "No files uploaded")
    job_id = uuid.uuid4().hex[:12]
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    paths: list[str] = []
    for i, upload in enumerate(files):
        img = _decode(await upload.read())
        out = job_dir / f"img_{i}.png"
        _save(out, img)
        paths.append(str(out))
    if reference_index < 0 or reference_index >= len(paths):
        raise HTTPException(400, "Invalid reference_index")
    JOBS.create(
        job_id,
        {
            "stage": "uploaded",
            "progress": 0.05,
            "message": "Images uploaded",
            "paths": paths,
            "reference_index": reference_index,
            "results": {},
        },
    )
    return {"job_id": job_id, "count": len(paths), "reference_index": reference_index}


@app.post("/demo/load")
async def load_demo() -> dict[str, Any]:
    samples = _ensure_samples()
    job_id = uuid.uuid4().hex[:12]
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    paths: list[str] = []
    for i, sample in enumerate(samples[:3]):
        out = job_dir / f"img_{i}.png"
        _save(out, cv2.imread(str(sample)))
        paths.append(str(out))
    JOBS.create(
        job_id,
        {
            "stage": "uploaded",
            "progress": 0.05,
            "message": "Demo images loaded",
            "paths": paths,
            "reference_index": 0,
            "results": {},
            "demo": True,
        },
    )
    return {
        "job_id": job_id,
        "count": len(paths),
        "reference_index": 0,
        "preview_urls": [f"/samples/{p.name}" for p in samples[:3]],
    }


@app.post("/process/clahe")
async def process_clahe(job_id: str = Form(...)) -> dict[str, Any]:
    job = JOBS.get(job_id)
    if not job or not job.get("paths"):
        raise HTTPException(
            404,
            "Unknown job — the server may have restarted. Please upload images or load the demo pair again.",
        )
    JOBS.update(job_id, stage="clahe", progress=0.15, message="Running CLAHE…")
    paths: list[str] = job["paths"]
    out_dir = RESULT_DIR / job_id / "clahe"
    enhanced_urls: list[str] = []
    original_urls: list[str] = []
    notes: list[dict[str, Any]] = []
    enhanced_paths: list[str] = []
    for i, path in enumerate(paths):
        original = cv2.imread(path)
        if original is None:
            raise HTTPException(400, f"Could not read uploaded image {i}")
        enhanced, meta = run_clahe(original)
        orig_out = out_dir / f"original_{i}.png"
        enh_out = out_dir / f"enhanced_{i}.png"
        _save(orig_out, original)
        _save(enh_out, enhanced)
        original_urls.append(f"/results/{job_id}/clahe/original_{i}.png")
        enhanced_urls.append(f"/results/{job_id}/clahe/enhanced_{i}.png")
        enhanced_paths.append(str(enh_out))
        notes.append(meta)
        JOBS.update(job_id, progress=0.15 + 0.15 * (i + 1) / len(paths))
    results = job.get("results", {})
    results["clahe"] = {"images": enhanced_urls, "originals": original_urls, "notes": notes}
    JOBS.update(
        job_id,
        stage="clahe_done",
        progress=0.35,
        message="CLAHE complete",
        results=results,
        enhanced_paths=enhanced_paths,
    )
    return {"job_id": job_id, **results["clahe"]}


@app.post("/process/loftr")
async def process_loftr(job_id: str = Form(...), source_index: int = Form(1)) -> dict[str, Any]:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(
            404,
            "Unknown job — the server may have restarted. Please upload images or load the demo pair again.",
        )
    JOBS.update(job_id, stage="loftr", progress=0.4, message="Finding matching points…")
    ref_i = int(job["reference_index"])
    enhanced = job.get("enhanced_paths") or job["paths"]
    if source_index < 0 or source_index >= len(enhanced):
        raise HTTPException(400, "Invalid source_index")
    ref = cv2.imread(enhanced[ref_i])
    src = cv2.imread(enhanced[source_index])
    if ref is None or src is None:
        raise HTTPException(400, "Could not read CLAHE images")
    match = run_loftr_style(ref, src)
    preview = _draw_matches(ref, src, match)
    unmatched_preview = _draw_unmatched_on_moon(ref, match)
    out_dir = RESULT_DIR / job_id / "loftr"
    _save(out_dir / "matches.png", preview)
    _save(out_dir / "unmatched.png", unmatched_preview)
    payload = {
        **match,
        "preview_url": f"/results/{job_id}/loftr/matches.png",
        "unmatched_preview_url": f"/results/{job_id}/loftr/unmatched.png",
        "reference_index": ref_i,
        "source_index": source_index,
    }
    results = job.get("results", {})
    results["loftr"] = payload
    JOBS.update(
        job_id,
        stage="loftr_done",
        progress=0.65,
        message="Matching complete",
        results=results,
        match_payload=payload,
        pair=(ref_i, source_index),
    )
    return {"job_id": job_id, **payload}


@app.post("/process/ransac")
async def process_ransac(job_id: str = Form(...)) -> dict[str, Any]:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(
            404,
            "Unknown job — the server may have restarted. Please upload images or load the demo pair again.",
        )
    match = job.get("match_payload")
    if not match:
        raise HTTPException(400, "Run matching first")
    JOBS.update(job_id, stage="ransac", progress=0.7, message="Aligning images…")
    ref_i, src_i = job["pair"]
    enhanced = job.get("enhanced_paths") or job["paths"]
    ref = cv2.imread(enhanced[ref_i])
    src = cv2.imread(enhanced[src_i])
    ransac = run_ransac(ref, src, match["mkpts0"], match["mkpts1"], match.get("mconf"))
    out_dir = RESULT_DIR / job_id / "ransac"
    _save(out_dir / "warped.png", ransac["warped"])
    _save(out_dir / "overlay.png", ransac["overlay"])
    _save(out_dir / "tint_overlay.png", ransac["tint_overlay"])
    payload = {
        "H": ransac["H"].tolist(),
        "inlier_ratio": ransac["inlier_ratio"],
        "inlier_count": ransac["inlier_count"],
        "rmse_px": ransac["rmse_px"],
        "spatial_coverage": ransac["spatial_coverage"],
        "rotation_deg": ransac["rotation_deg"],
        "scale": ransac["scale"],
        "translation_px": ransac["translation_px"],
        "warped_url": f"/results/{job_id}/ransac/warped.png",
        "overlay_url": f"/results/{job_id}/ransac/overlay.png",
        "tint_overlay_url": f"/results/{job_id}/ransac/tint_overlay.png",
        "conclusion": ransac["conclusion"],
    }
    results = job.get("results", {})
    results["ransac"] = payload
    JOBS.update(job_id, stage="ransac_done", progress=1.0, message="Registration complete", results=results)
    return {"job_id": job_id, **payload}


@app.post("/process/ice")
async def process_ice(job_id: str | None = Form(None)) -> dict[str, Any]:
    return run_ice_detection(RESULT_DIR, job_id)


@app.get("/status/{job_id}")
def status(job_id: str) -> dict[str, Any]:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(
            404,
            "Unknown job — the server may have restarted. Please upload images or load the demo pair again.",
        )
    return {
        "job_id": job_id,
        "stage": job.get("stage"),
        "progress": job.get("progress", 0),
        "message": job.get("message", ""),
        "results": job.get("results", {}),
    }


# Prefer opening the UI here: http://127.0.0.1:8000/register
# Same origin as the API → no Vite-proxy "Failed to fetch" on Start Processing.
if FRONTEND_DIST.is_dir():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")

    @app.get("/")
    async def spa_root() -> FileResponse:
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str) -> FileResponse:
        blocked = (
            "docs",
            "openapi.json",
            "redoc",
            "health",
            "upload",
            "demo",
            "process",
            "status",
            "results",
            "samples",
            "api",
        )
        if full_path.startswith(blocked):
            raise HTTPException(404, "Not found")
        candidate = FRONTEND_DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
