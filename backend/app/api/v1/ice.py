"""LUNA/ICE persistence APIs."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2.elements import WKTElement
from sqlalchemy.orm import Session

from app.core.constants import DISCLAIMER, RunStatus
from app.core.db import get_db
from app.models import AnalysisRun, IceAnalysisResult, LandingCandidate, Project, RoverRoute
from app.schemas.platform import AnalysisRunOut, IcePersistRequest

router = APIRouter(prefix="/ice", tags=["ice"])


@router.post("/runs", response_model=AnalysisRunOut, status_code=201)
def persist_ice_analysis(body: IcePersistRequest, db: Session = Depends(get_db)) -> AnalysisRun:
    project = db.get(Project, body.project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    run = AnalysisRun(
        project_id=body.project_id,
        kind="ice",
        status=RunStatus.completed,
        progress=1.0,
        message="Ice analysis persisted (prototype / illustrative)",
        engine="n/a",
        params={"thresholds": body.thresholds, "meta": body.meta},
        lineage={
            "kind": "ice",
            "thresholds": body.thresholds,
            "limitations": DISCLAIMER,
            "note": "Potential ice signatures only — not confirmed ice.",
        },
    )
    db.add(run)
    db.flush()

    ice = IceAnalysisResult(
        run_id=run.id,
        thresholds=body.thresholds,
        cluster_metrics=body.cluster_metrics,
        volume_scenarios=body.volume_scenarios,
        object_keys=body.object_keys,
        disclaimer=DISCLAIMER + " Potential ice signatures only — not confirmed ice.",
        meta=body.meta,
    )
    db.add(ice)
    db.flush()

    for lc in body.landing_candidates:
        geom = None
        lon, lat = lc.get("lon"), lc.get("lat")
        if lon is not None and lat is not None:
            geom = WKTElement(f"POINT({lon} {lat})", srid=4326)
        db.add(
            LandingCandidate(
                ice_result_id=ice.id,
                name=str(lc.get("name") or "LZ"),
                score=float(lc.get("score") or 0),
                metrics=lc.get("metrics") or {},
                location=geom,
            )
        )

    for rt in body.rover_routes:
        db.add(
            RoverRoute(
                ice_result_id=ice.id,
                name=str(rt.get("name") or "route"),
                mode=str(rt.get("mode") or "solar_aware"),
                geojson=rt.get("geojson") or {},
                metrics=rt.get("metrics") or {},
            )
        )

    db.commit()
    db.refresh(run)
    return run


@router.get("/runs/{run_id}")
def get_ice_run(run_id: uuid.UUID, db: Session = Depends(get_db)) -> dict:
    run = db.get(AnalysisRun, run_id)
    if not run or run.kind != "ice":
        raise HTTPException(404, "Ice run not found")
    ice = db.query(IceAnalysisResult).filter_by(run_id=run_id).one_or_none()
    if not ice:
        raise HTTPException(404, "Ice result missing")
    return {
        "run": AnalysisRunOut.model_validate(run),
        "result": {
            "id": str(ice.id),
            "thresholds": ice.thresholds,
            "cluster_metrics": ice.cluster_metrics,
            "volume_scenarios": ice.volume_scenarios,
            "object_keys": ice.object_keys,
            "disclaimer": ice.disclaimer,
            "landing_candidates": [
                {"id": str(c.id), "name": c.name, "score": c.score, "metrics": c.metrics, "disclaimer": c.disclaimer}
                for c in ice.landing_candidates
            ],
            "rover_routes": [
                {
                    "id": str(r.id),
                    "name": r.name,
                    "mode": r.mode,
                    "geojson": r.geojson,
                    "metrics": r.metrics,
                    "disclaimer": r.disclaimer,
                }
                for r in ice.rover_routes
            ],
        },
    }
