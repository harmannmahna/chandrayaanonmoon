from __future__ import annotations

from typing import Any


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, dict[str, Any]] = {}

    def create(self, job_id: str, payload: dict[str, Any]) -> None:
        self._jobs[job_id] = dict(payload)

    def get(self, job_id: str) -> dict[str, Any] | None:
        return self._jobs.get(job_id)

    def update(self, job_id: str, **kwargs: Any) -> dict[str, Any]:
        job = self._jobs.get(job_id)
        if not job:
            raise KeyError(job_id)
        job.update(kwargs)
        return job


JOBS = JobStore()
