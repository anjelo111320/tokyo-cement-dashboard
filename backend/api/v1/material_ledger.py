"""
api/v1/material_ledger.py — Material Ledger Endpoints
=======================================================
Thin route handlers — all business logic is in MaterialLedgerService.

Endpoints:
  GET /api/v1/material-ledger/kpis             → KPI cards
  GET /api/v1/material-ledger/inventory-flow   → AB→ZU→KB→VN→EB waterfall
  GET /api/v1/material-ledger/consumption      → consumption breakdown by proc cat
  GET /api/v1/material-ledger/supply-chain     → factory→depot flow
  GET /api/v1/material-ledger/movements        → paginated raw movement table
  GET /api/v1/material-ledger/materials        → distinct materials (filter dropdown)
  GET /api/v1/material-ledger/plants           → all plants with GPS coords
"""

import math
from typing import Optional
from fastapi import APIRouter, Query

from backend.schemas.common import ApiResponse, PaginatedResponse, Pagination, ApiMeta
from backend.schemas.material_ledger import (
    LedgerKpiSchema, InventoryFlowSchema, ConsumptionBreakdownSchema,
    SupplyChainSchema, MovementRowSchema, MaterialSchema, PlantSchema,
    StockTransferSchema, PlantComparisonSchema,
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


@router.get("/inventory-flow", response_model=ApiResponse[InventoryFlowSchema])
async def get_inventory_flow(
    plant_id: Optional[str] = Query(None),
    material_id: Optional[str] = Query(None),
):
    """
    Waterfall chart data: Beginning → Receipts → Cumulative → Consumption → Ending.
    Categories are driven by material_ledger_config.py — safe to add new codes.
    """
    return ApiResponse(data=_svc.get_inventory_flow(plant_id=plant_id, material_id=material_id))


@router.get("/consumption", response_model=ApiResponse[ConsumptionBreakdownSchema])
async def get_consumption_breakdown(
    plant_id: Optional[str] = Query(None),
    material_id: Optional[str] = Query(None),
):
    """Sales Orders vs Internal Consumption vs Stock Transfer breakdown."""
    return ApiResponse(data=_svc.get_consumption_breakdown(plant_id=plant_id, material_id=material_id))


@router.get("/supply-chain", response_model=ApiResponse[SupplyChainSchema])
async def get_supply_chain(
    material_id: Optional[str] = Query(None),
):
    """Factory → Depot supply chain flow with production and transfer volumes."""
    return ApiResponse(data=_svc.get_supply_chain(material_id=material_id))


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


@router.get("/plant-comparison", response_model=ApiResponse[PlantComparisonSchema])
async def get_plant_comparison(
    material_id: Optional[str] = Query(None),
):
    """Per-plant comparison: opening / receipts / consumption / closing (CA rows only)."""
    return ApiResponse(data=_svc.get_plant_comparison(material_id=material_id))


@router.get("/stock-transfers", response_model=ApiResponse[StockTransferSchema])
async def get_stock_transfers(
    plant_id: Optional[str] = Query(None),
    material_id: Optional[str] = Query(None),
):
    """Inter-plant stock transfer notes parsed from VM+VN movement rows."""
    return ApiResponse(data=_svc.get_stock_transfers(plant_id=plant_id, material_id=material_id))


@router.get("/materials", response_model=ApiResponse[list[MaterialSchema]])
async def get_materials():
    """Distinct materials for the filter dropdown."""
    return ApiResponse(data=_svc.get_materials())


@router.get("/plants", response_model=ApiResponse[list[PlantSchema]])
async def get_plants():
    """All plants from the plant master with GPS coordinates for the map."""
    return ApiResponse(data=_svc.get_plants())
