"""
api/v1/settings.py — Settings & Ingestion Endpoints
=====================================================
  GET  /api/v1/settings/csv-config    → Current CSV paths and refresh interval.
  POST /api/v1/settings/csv-config    → Update CSV path or refresh interval.
  POST /api/v1/ingestion/trigger      → Force an immediate CSV reload.

Used by:
  Frontend SettingsPage → displays config, allows manual trigger.
  Operations team       → can redirect the CSV path to a new folder without
                          restarting the server.

Layer position: API layer (thin — reads/writes from global `settings` and `csv_cache`).

Important: In Phase 1, the CSV config update only mutates the in-memory
Settings object. It does NOT persist to the .env file, so the change is
lost on server restart. Phase 2 will add database-backed settings.

Depends on:
  core/config.py                   → settings (mutable singleton)
  repositories/csv/csv_base.py     → csv_cache.load_all(), CSV_FILES
  schemas/settings.py              → CsvConfigSchema, CsvConfigUpdateRequest,
                                     CsvFileConfig, IngestionJobResponse
  schemas/common.py                → ApiResponse
"""

import uuid
from fastapi import APIRouter
from backend.schemas.common import ApiResponse
from backend.schemas.settings import (
    CsvConfigSchema,
    CsvFileConfig,
    CsvConfigUpdateRequest,
    IngestionJobResponse,
)
from backend.core.config import settings as app_settings
from backend.repositories.csv.csv_base import csv_cache, CSV_FILES

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/csv-config", response_model=ApiResponse[CsvConfigSchema])
async def get_csv_config():
    """
    Returns the current data source configuration:
      - csv_base_path: folder containing the 5 CSV files.
      - refresh_interval_seconds: how often the scheduler reloads them.
      - files: mapping of logical name → filename + enabled flag.
    """
    data = CsvConfigSchema(
        csv_base_path=app_settings.csv_base_path,
        refresh_interval_seconds=app_settings.csv_refresh_interval_seconds,
        # Build the files dict from the authoritative CSV_FILES mapping.
        files={k: CsvFileConfig(filename=v, enabled=True) for k, v in CSV_FILES.items()},
    )
    return ApiResponse(data=data)


@router.post("/csv-config", response_model=ApiResponse[CsvConfigSchema])
async def update_csv_config(body: CsvConfigUpdateRequest):
    """
    Updates the CSV configuration at runtime without restarting the server.
    Only the provided fields are changed — omit a field to leave it unchanged.

    Note: This mutation is in-memory only and is lost on restart.
    Future Phase 2: persist to database.
    """
    if body.csv_base_path:
        app_settings.csv_base_path = body.csv_base_path
    if body.refresh_interval_seconds:
        app_settings.csv_refresh_interval_seconds = body.refresh_interval_seconds

    data = CsvConfigSchema(
        csv_base_path=app_settings.csv_base_path,
        refresh_interval_seconds=app_settings.csv_refresh_interval_seconds,
        files={k: CsvFileConfig(filename=v, enabled=True) for k, v in CSV_FILES.items()},
    )
    return ApiResponse(data=data)


@router.post("/ingestion/trigger", response_model=ApiResponse[IngestionJobResponse])
async def trigger_ingestion():
    """
    Forces an immediate reload of all CSV files into the in-memory cache.
    Normally the scheduler does this automatically every 15 minutes.
    Use this after manually updating the CSV files outside the normal schedule.

    The reload is synchronous — the response is returned only after
    all files have been parsed and the cache has been updated.
    """
    csv_cache.load_all()
    data = IngestionJobResponse(
        job_id=str(uuid.uuid4()),
        status="completed",
        message="CSV files reloaded successfully",
    )
    return ApiResponse(data=data)
