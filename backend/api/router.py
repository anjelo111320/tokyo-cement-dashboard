from fastapi import APIRouter
from backend.api.v1 import health, settings, material_ledger, auth, admin

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health.router)            # /health, /status
api_router.include_router(settings.router)          # /settings/csv-config, /ingestion/trigger
api_router.include_router(material_ledger.router)   # /material-ledger/*
api_router.include_router(auth.router)              # /auth/login, /auth/logout, /auth/me, /auth/refresh
api_router.include_router(admin.router)             # /admin/*
