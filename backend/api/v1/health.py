"""
api/v1/health.py — Health & System Status Endpoints

  GET /health          → simple liveness check
  GET /api/v1/status   → CSV file load status (used by Settings page)
"""

from datetime import datetime
from fastapi import APIRouter
from backend.schemas.common import ApiResponse
from backend.repositories.csv.csv_base import csv_cache
from backend.core.config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0", "timestamp": datetime.utcnow().isoformat() + "Z"}


@router.get("/status", response_model=ApiResponse[dict])
async def system_status():
    """Returns load status of all CSV files — used by the Settings/Status page."""
    return ApiResponse(data={
        "api_status": "healthy",
        "csv_files": csv_cache.all_statuses(),
        "next_refresh_in_seconds": settings.csv_refresh_interval_seconds,
    })
