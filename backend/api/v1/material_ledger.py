"""
api/v1/material_ledger.py — Material Ledger Endpoints
=======================================================
Thin route handlers — all business logic is in MaterialLedgerService.

Endpoints:
  GET /api/v1/material-ledger/kpis               → KPI cards
  GET /api/v1/material-ledger/movements          → paginated raw movement table
  GET /api/v1/material-ledger/inventory-summary  → per-plant on-hand + transit
  GET /api/v1/material-ledger/inventory-alerts   → low-stock alerts
  GET /api/v1/material-ledger/stock-transfers    → inter-plant transfer rows
  GET /api/v1/material-ledger/materials          → distinct materials (filter dropdown)
  GET /api/v1/material-ledger/plants             → all plants with GPS coords
  GET /api/v1/material-ledger/location-summary   → brand × location grid
"""

import math
from typing import Optional
from fastapi import APIRouter, Query

from backend.schemas.common import ApiResponse, PaginatedResponse, Pagination, ApiMeta
from backend.schemas.material_ledger import (
    LedgerKpiSchema, MovementRowSchema, MaterialSchema, PlantSchema,
    StockTransferSchema, InventorySummarySchema, InventoryAlertsSchema,
    InventoryReportSchema, LocationSummarySchema,
)
from backend.services.material_ledger_service import MaterialLedgerService

router = APIRouter(prefix="/material-ledger", tags=["material-ledger"])
_svc = MaterialLedgerService()


@router.get("/kpis", response_model=ApiResponse[LedgerKpiSchema])
async def get_kpis(
    plant_id: Optional[str] = Query(None, description="SAP plant code, e.g. 2114"),
    material_id: Optional[str] = Query(None, description="SAP material number"),
):
    """Opening stock, closing stock, total receipts, total consumption."""
    return ApiResponse(data=_svc.get_kpis(plant_id=plant_id, material_id=material_id))


@router.get("/movements", response_model=PaginatedResponse[MovementRowSchema])
async def get_movements(
    plant_id: Optional[str] = Query(None),
    material_id: Optional[str] = Query(None),
    obj_type: Optional[str] = Query(None, description="CA / BV / VM"),
    category: Optional[str] = Query(None, description="AB / ZU / KB / VN / EB"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
):
    """Full paginated movement table. extra_fields column passes through new CSV columns."""
    items, total = _svc.get_movements(
        plant_id=plant_id, material_id=material_id,
        obj_type=obj_type, category=category,
        page=page, page_size=page_size,
    )
    return PaginatedResponse(
        data=items,
        pagination=Pagination(
            page=page, page_size=page_size,
            total_items=total, total_pages=math.ceil(total / page_size),
        ),
        meta=ApiMeta(),
    )


@router.get("/inventory-summary", response_model=ApiResponse[InventorySummarySchema])
async def get_inventory_summary(
    material_ids:    Optional[str] = Query(None, description="Comma-separated material IDs"),
    plant_id:        list[str]     = Query(default=[], description="Plant IDs to filter (repeatable)"),
    zero_stock_mode: str           = Query("accurate", description="accurate | active_only"),
):
    """Per-plant inventory: on-hand, in-transit out/in, and alert status."""
    mid_list = [m.strip() for m in material_ids.split(",")] if material_ids else None
    return ApiResponse(data=_svc.get_inventory_summary(
        material_ids=mid_list,
        plant_ids=plant_id or None,
        zero_stock_mode=zero_stock_mode,
    ))


@router.get("/inventory-alerts", response_model=ApiResponse[InventoryAlertsSchema])
async def get_inventory_alerts(
    material_ids: Optional[str] = Query(None, description="Comma-separated material IDs"),
):
    """Plants where on-hand stock is below the configured minimum threshold."""
    mid_list = [m.strip() for m in material_ids.split(",")] if material_ids else None
    return ApiResponse(data=_svc.get_inventory_alerts(material_ids=mid_list))


@router.get("/stock-transfers", response_model=ApiResponse[StockTransferSchema])
async def get_stock_transfers(
    plant_id: Optional[str] = Query(None),
    material_id: Optional[str] = Query(None),
):
    """Inter-plant stock transfer notes parsed from VM+VN movement rows."""
    return ApiResponse(data=_svc.get_stock_transfers(plant_id=plant_id, material_id=material_id))


@router.get("/inventory-report", response_model=ApiResponse[InventoryReportSchema])
async def get_inventory_report(
    material_ids: Optional[str] = Query(None, description="Comma-separated material IDs"),
    plant_id:     list[str]     = Query(default=[], description="Plant IDs to filter (repeatable)"),
):
    """Per-material, per-plant inventory report matching the CSV report structure."""
    mid_list = [m.strip() for m in material_ids.split(",")] if material_ids else None
    return ApiResponse(data=_svc.get_inventory_report(
        material_ids=mid_list,
        plant_ids=plant_id or None,
    ))


@router.get("/location-summary", response_model=ApiResponse[LocationSummarySchema])
async def get_location_summary(
    include_bags: bool = Query(True,  description="Include 50 kg bag materials"),
    include_bulk: bool = Query(False, description="Include bulk materials"),
):
    """Brand × location grid: floor stock, period dispatch, and (if CSV has date column) inventory days."""
    return ApiResponse(data=_svc.get_location_summary(
        include_bags=include_bags,
        include_bulk=include_bulk,
    ))


@router.get("/materials", response_model=ApiResponse[list[MaterialSchema]])
async def get_materials(
    plant_id: list[str] = Query(default=[], description="Plant IDs to filter (repeatable)"),
):
    """Distinct materials for the filter dropdown, scoped to selected plants."""
    return ApiResponse(data=_svc.get_materials(plant_ids=plant_id or None))


@router.get("/plants", response_model=ApiResponse[list[PlantSchema]])
async def get_plants():
    """All plants from the plant master with GPS coordinates for the map."""
    return ApiResponse(data=_svc.get_plants())
