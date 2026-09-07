"""Export ZIP builder for analysis runs."""

from __future__ import annotations

import io
import json
import uuid
import zipfile
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.constants import DISCLAIMER, RunStatus
from app.models import AnalysisRun, Export, RegistrationResult
from app.services.storage import ObjectStorage


def execute_export(db: Session, storage: ObjectStorage, export_id: uuid.UUID) -> dict[str, Any]:
    exp = db.get(Export, export_id)
    if not exp:
        raise ValueError("Unknown export")
    run = db.get(AnalysisRun, exp.run_id)
    if not run:
        raise ValueError("Unknown run")

    exp.status = "exporting"
    db.commit()

    reg = db.query(RegistrationResult).filter_by(run_id=run.id).one_or_none()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        readme = "\n".join(
            [
                "LunaMatch export package",
                "========================",
                DISCLAIMER,
                "",
                f"Run ID: {run.id}",
                f"Engine: {run.engine}",
                f"Status: {run.status}",
                f"Generated: {datetime.now(timezone.utc).isoformat()}",
                "",
                "RMSE in metrics JSON is pixel reprojection/inlier error, not geodetic lunar accuracy.",
                "Ice-related content (if any) remains illustrative/prototype unless explicitly labeled otherwise.",
            ]
        )
        zf.writestr("README.txt", readme)
        zf.writestr(
            "metrics.json",
            json.dumps(
                {
                    "run": {
                        "id": str(run.id),
                        "status": run.status,
                        "engine": run.engine,
                        "params": run.params,
                        "lineage": run.lineage,
                    },
                    "registration": None
                    if not reg
                    else {
                        "engine": reg.engine,
                        "engine_version": reg.engine_version,
                        "device": reg.device,
                        "fallback_used": reg.fallback_used,
                        "runtime_ms": reg.runtime_ms,
                        "metrics": reg.metrics,
                        "reliability": reg.reliability,
                        "limitations": reg.limitations,
                    },
                    "disclaimer": DISCLAIMER,
                },
                indent=2,
            ),
        )
        zf.writestr("assumptions.json", json.dumps({"disclaimer": DISCLAIMER}, indent=2))
        if reg and reg.object_keys:
            for label, key in reg.object_keys.items():
                try:
                    data = storage.get_bytes(key)
                    zf.writestr(f"imagery/{label}.png", data)
                except Exception:  # noqa: BLE001
                    continue

    data = buf.getvalue()
    object_key = f"projects/{run.project_id}/exports/{exp.id}.zip"
    storage.put_bytes(object_key, data, "application/zip")
    exp.object_key = object_key
    exp.byte_size = len(data)
    exp.status = "completed"
    exp.meta = {**(exp.meta or {}), "files": ["README.txt", "metrics.json", "assumptions.json", "imagery/"]}
    db.commit()
    return {"status": "completed", "object_key": object_key, "byte_size": len(data)}
