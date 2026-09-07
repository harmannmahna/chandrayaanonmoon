"""Shared enums / constants."""

from __future__ import annotations

from enum import StrEnum


class RunStatus(StrEnum):
    queued = "queued"
    preprocessing = "preprocessing"
    matching = "matching"
    ransac = "ransac"
    refinement = "refinement"
    exporting = "exporting"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class MatcherEngine(StrEnum):
    akaze = "akaze"
    superpoint_lightglue = "superpoint_lightglue"
    loftr = "loftr"


class DatasetKind(StrEnum):
    optical = "optical"
    radar = "radar"
    dem = "dem"
    mask = "mask"
    other = "other"


class AnalysisKind(StrEnum):
    registration = "registration"
    ice = "ice"
    export = "export"


DISCLAIMER = (
    "SIH prototype — not official ISRO software. Pixel RMSE ≠ geodetic accuracy. "
    "Ice layers/results are illustrative unless marked otherwise. No confirmed ice claims."
)
