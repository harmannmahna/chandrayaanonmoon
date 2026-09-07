"""Platform entrypoint — extends the legacy FastAPI app with /api/v1 (→ /v1 after prefix strip)."""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure `backend/` is on sys.path so `pipeline` and legacy `main` import cleanly.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from main import app  # noqa: E402  — legacy LunaMatch API + SPA
from app.api.v1.router import api_router  # noqa: E402

# After StripApiPrefixMiddleware, browser `/api/v1/...` becomes `/v1/...`.
app.include_router(api_router, prefix="/v1")
