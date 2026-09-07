from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class JobStore:
    """
    Disk-backed job registry.

    In-memory alone breaks on multi-worker hosts (e.g. Render): upload hits
    worker A, /process/clahe hits worker B → "Unknown job". Metadata is written
    under uploads/<job_id>/job.json so any worker sharing the disk can recover.
    """

    def __init__(self, upload_root: Path, result_root: Path | None = None) -> None:
        self._jobs: dict[str, dict[str, Any]] = {}
        self.upload_root = upload_root
        self.result_root = result_root or upload_root.parent / "results"
        self.upload_root.mkdir(parents=True, exist_ok=True)

    def _meta_path(self, job_id: str) -> Path:
        return self.upload_root / job_id / "job.json"

    def _resolve_upload_paths(self, job_id: str, paths: list[Any] | None) -> list[str]:
        job_dir = self.upload_root / job_id
        resolved: list[str] = []
        for p in paths or []:
            path = Path(str(p))
            if path.is_file():
                resolved.append(str(path.resolve()))
                continue
            for candidate in (job_dir / path.name, path):
                if candidate.is_file():
                    resolved.append(str(candidate.resolve()))
                    break
        if not resolved and job_dir.is_dir():
            resolved = [str(p.resolve()) for p in sorted(job_dir.glob("img_*.png"))]
        return resolved

    def _resolve_enhanced_paths(self, job_id: str, paths: list[Any] | None) -> list[str]:
        clahe_dir = self.result_root / job_id / "clahe"
        resolved: list[str] = []
        for p in paths or []:
            path = Path(str(p))
            if path.is_file():
                resolved.append(str(path.resolve()))
                continue
            candidate = clahe_dir / path.name
            if candidate.is_file():
                resolved.append(str(candidate.resolve()))
        if not resolved and clahe_dir.is_dir():
            resolved = [str(p.resolve()) for p in sorted(clahe_dir.glob("enhanced_*.png"))]
        return resolved

    def _hydrate(self, job_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        job = dict(payload)
        job["paths"] = self._resolve_upload_paths(job_id, job.get("paths"))
        if "enhanced_paths" in job or (self.result_root / job_id / "clahe").is_dir():
            job["enhanced_paths"] = self._resolve_enhanced_paths(job_id, job.get("enhanced_paths"))
        # Recover matcher output across workers from persisted results
        if not job.get("match_payload"):
            loftr = (job.get("results") or {}).get("loftr")
            if isinstance(loftr, dict) and loftr.get("mkpts0") is not None:
                job["match_payload"] = loftr
        self._jobs[job_id] = job
        return job

    def _persist(self, job_id: str, job: dict[str, Any]) -> None:
        meta = self._meta_path(job_id)
        meta.parent.mkdir(parents=True, exist_ok=True)
        # Persist full job including match points so RANSAC works on any worker.
        dump = dict(job)
        meta.write_text(json.dumps(dump, indent=2, default=str), encoding="utf-8")

    def create(self, job_id: str, payload: dict[str, Any]) -> None:
        job = self._hydrate(job_id, payload)
        self._persist(job_id, job)

    def get(self, job_id: str) -> dict[str, Any] | None:
        if not job_id:
            return None
        if job_id in self._jobs:
            return self._hydrate(job_id, self._jobs[job_id])

        meta = self._meta_path(job_id)
        if meta.is_file():
            try:
                data = json.loads(meta.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    return self._hydrate(job_id, data)
            except (OSError, json.JSONDecodeError):
                pass

        job_dir = self.upload_root / job_id
        if job_dir.is_dir():
            paths = [str(p.resolve()) for p in sorted(job_dir.glob("img_*.png"))]
            if paths:
                return self._hydrate(
                    job_id,
                    {
                        "stage": "recovered",
                        "progress": 0.05,
                        "message": "Job recovered from disk",
                        "paths": paths,
                        "reference_index": 0,
                        "results": {},
                    },
                )
        return None

    def update(self, job_id: str, **kwargs: Any) -> dict[str, Any]:
        job = self.get(job_id)
        if not job:
            raise KeyError(job_id)
        job.update(kwargs)
        self._jobs[job_id] = job
        self._persist(job_id, job)
        return job


JOBS: JobStore | None = None


def init_jobs(upload_root: Path, result_root: Path | None = None) -> JobStore:
    global JOBS
    JOBS = JobStore(upload_root, result_root)
    return JOBS
