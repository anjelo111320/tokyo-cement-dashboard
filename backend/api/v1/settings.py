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
from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, require_admin
from backend.db.database import get_db
from backend.db.models.user import User
from backend.repositories.db import threshold_repo
from backend.schemas.common import ApiResponse
from backend.schemas.settings import (
    CsvConfigSchema,
    CsvFileConfig,
    CsvConfigUpdateRequest,
    IngestionJobResponse,
)
from backend.schemas.material_ledger import MaterialThresholdSchema
from backend.core.config import settings as app_settings
from backend.repositories.csv.csv_base import csv_cache, CSV_FILES
from backend.services.material_ledger_service import MaterialLedgerService

_svc = MaterialLedgerService()

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


@router.get("/thresholds", response_model=ApiResponse[list[MaterialThresholdSchema]])
async def get_thresholds(_: User = Depends(get_current_user)):
    """Returns all configured low-stock alert thresholds.
    Served from the in-memory cache, hydrated from the DB at startup.
    """
    return ApiResponse(data=_svc.get_material_thresholds())


@router.post("/thresholds", response_model=ApiResponse[list[MaterialThresholdSchema]])
async def set_threshold(
    material_id:  str   = Body(..., embed=True),
    min_stock_mt: float = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Sets or removes a low-stock threshold for a material.
    Pass min_stock_mt=0 to remove the alert for that material.
    Write-through: updates the in-memory cache (used by the sync CSV service)
    AND persists to the DB so values survive restarts/spin-downs.
    """
    _svc.set_material_threshold(material_id=material_id, min_stock_mt=min_stock_mt)
    if min_stock_mt <= 0:
        await threshold_repo.delete(db, material_id)
    else:
        await threshold_repo.upsert(db, material_id, min_stock_mt, updated_by=user.id)
    return ApiResponse(data=_svc.get_material_thresholds())
