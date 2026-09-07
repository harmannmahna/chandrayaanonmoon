from fastapi import APIRouter

from app.api.v1 import datasets, exports, health, ice, projects, registration

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(projects.router)
api_router.include_router(datasets.router)
api_router.include_router(registration.router)
api_router.include_router(ice.router)
api_router.include_router(exports.router)
