"""
api/router.py — Master API Router
====================================
Registers all active route groups under /api/v1.

Active data sources:
  material_ledger.csv  → /api/v1/material-ledger/*
  plant_names.csv      → /api/v1/material-ledger/plants

To add a new feature: create api/v1/my_feature.py and add it below.
"""

from fastapi import APIRouter
from backend.api.v1 import health, settings, material_ledger

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health.router)            # /health, /status
api_router.include_router(settings.router)          # /settings/csv-config, /ingestion/trigger
api_router.include_router(material_ledger.router)   # /material-ledger/*
