"""
api/v1/material_ledger.py — Material Ledger Endpoints
=======================================================
Thin route handlers — all business logic is in MaterialLedgerService.

Endpoints:
  GET /api/v1/material-ledger/kpis               → KPI cards
  GET /api/v1/material-ledger/inventory-summary  → per-plant on-hand + transit
  GET /api/v1/material-ledger/inventory-alerts   → low-stock alerts
  GET /api/v1/material-ledger/stock-transfers    → inter-plant transfer rows
  GET /api/v1/material-ledger/materials          → distinct materials (filter dropdown)
  GET /api/v1/material-ledger/plants             → all plants with GPS coords
  GET /api/v1/material-ledger/location-summary   → brand × location grid
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select as sa_select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.db.models.plant import Plant as PlantModel
from backend.db.models.material import Material as MaterialModel
from backend.db.models.brand_group import BrandGroup
from backend.schemas.common import ApiResponse
from backend.schemas.material_ledger import (
    LedgerKpiSchema, MaterialSchema, PlantSchema,
    StockTransferSchema, InventorySummarySchema, InventoryAlertsSchema,
    InventoryReportSchema, LocationSummarySchema,
)
from backend.services.material_ledger_service import MaterialLedgerService

router = APIRouter(prefix="/material-ledger", tags=["material-ledger"])
_svc = MaterialLedgerService()


async def _load_db_maps(db: AsyncSession) -> tuple[dict, dict]:
    """Fetch all plant and material DB records in two queries.
    Returns (plant_map keyed by plant_id, mat_map keyed by material_id).
    Used to derive inactive sets AND to apply DB name/city overrides over CSV data.
    """
    p_res = await db.execute(sa_select(PlantModel))
    m_res = await db.execute(sa_select(MaterialModel))
    return (
        {p.plant_id: p for p in p_res.scalars().all()},
        {m.material_id: m for m in m_res.scalars().all()},
    )


# ── DB-override helpers (sync, applied after CSV-based service calls) ──────────

def _plant_row_override(row: "PlantInventoryRow", plant_map: dict) -> "PlantInventoryRow":
    db_p = plant_map.get(row.plant_id)
    if not db_p:
        return row
    return row.model_copy(update={"plant_name": db_p.name, "city": db_p.city})


def _alert_row_override(row: "InventoryAlertRow", plant_map: dict, mat_map: dict) -> "InventoryAlertRow":
    updates: dict = {}
    db_p = plant_map.get(row.plant_id)
    if db_p:
        updates["plant_name"] = db_p.name
        updates["city"] = db_p.city
    db_m = mat_map.get(row.material_id)
    if db_m:
        updates["material_desc"] = db_m.description
    return row.model_copy(update=updates) if updates else row


def _material_override(m: "MaterialSchema", mat_map: dict) -> "MaterialSchema":
    db_m = mat_map.get(m.material_id)
    if not db_m:
        return m
    return m.model_copy(update={"material_description": db_m.description})


def _plant_schema_override(p: "PlantSchema", plant_map: dict) -> "PlantSchema":
    db_p = plant_map.get(p.plant_id)
    if not db_p:
        return p
    updates: dict = {"name": db_p.name, "city": db_p.city}
    if db_p.lat is not None:
        updates["latitude"] = float(db_p.lat)
    if db_p.lng is not None:
        updates["longitude"] = float(db_p.lng)
    return p.model_copy(update=updates)


@router.get("/kpis", response_model=ApiResponse[LedgerKpiSchema])
async def get_kpis(
    plant_id: Optional[str] = Query(None, description="SAP plant code, e.g. 2114"),
    material_id: Optional[str] = Query(None, description="SAP material number"),
):
    """Opening stock, closing stock, total receipts, total consumption."""
    return ApiResponse(data=_svc.get_kpis(plant_id=plant_id, material_id=material_id))


@router.get("/inventory-summary", response_model=ApiResponse[InventorySummarySchema])
async def get_inventory_summary(
    material_ids:    Optional[str] = Query(None, description="Comma-separated material IDs"),
    plant_id:        list[str]     = Query(default=[], description="Plant IDs to filter (repeatable)"),
    zero_stock_mode: str           = Query("accurate", description="accurate | active_only"),
    db: AsyncSession = Depends(get_db),
):
    """Per-plant inventory: on-hand, in-transit out/in, and alert status."""
    plant_map, mat_map = await _load_db_maps(db)
    inactive_pids = {pid for pid, p in plant_map.items() if not p.is_active}
    inactive_mids = {mid for mid, m in mat_map.items() if not m.is_active}

    eff_plant_ids = [p for p in plant_id if p not in inactive_pids] or None if plant_id else None
    mid_list = [m.strip() for m in material_ids.split(",") if m.strip() not in inactive_mids] or None if material_ids else None

    result = _svc.get_inventory_summary(
        material_ids=mid_list,
        plant_ids=eff_plant_ids,
        zero_stock_mode=zero_stock_mode,
    )

    # Filter inactive plants and apply DB name/city overrides
    rows = [_plant_row_override(r, plant_map) for r in result.rows if r.plant_id not in inactive_pids]
    result = InventorySummarySchema(
        rows=rows,
        total_on_hand_mt=sum(r.on_hand_mt for r in rows),
        total_in_transit_out=sum(r.in_transit_out_mt for r in rows),
        total_in_transit_in=sum(r.in_transit_in_mt for r in rows),
        alert_count=sum(1 for r in rows if r.status in ('low', 'out')),
        unit=result.unit,
    )

    return ApiResponse(data=result)


@router.get("/inventory-alerts", response_model=ApiResponse[InventoryAlertsSchema])
async def get_inventory_alerts(
    material_ids: Optional[str] = Query(None, description="Comma-separated material IDs"),
    db: AsyncSession = Depends(get_db),
):
    """Plants where on-hand stock is below the configured minimum threshold."""
    plant_map, mat_map = await _load_db_maps(db)
    inactive_pids = {pid for pid, p in plant_map.items() if not p.is_active}
    inactive_mids = {mid for mid, m in mat_map.items() if not m.is_active}

    mid_list = [m.strip() for m in material_ids.split(",") if m.strip() not in inactive_mids] or None if material_ids else None

    result = _svc.get_inventory_alerts(material_ids=mid_list)

    alerts = [
        _alert_row_override(a, plant_map, mat_map)
        for a in result.alerts
        if a.plant_id not in inactive_pids and a.material_id not in inactive_mids
    ]
    result = InventoryAlertsSchema(alerts=alerts, unit=result.unit)

    return ApiResponse(data=result)


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
    db: AsyncSession = Depends(get_db),
):
    """Per-material, per-plant inventory report matching the CSV report structure."""
    plant_map, mat_map = await _load_db_maps(db)
    inactive_pids = {pid for pid, p in plant_map.items() if not p.is_active}
    inactive_mids = {mid for mid, m in mat_map.items() if not m.is_active}

    eff_plant_ids = [p for p in plant_id if p not in inactive_pids] or None if plant_id else None
    mid_list = [m.strip() for m in material_ids.split(",") if m.strip() not in inactive_mids] or None if material_ids else None

    result = _svc.get_inventory_report(material_ids=mid_list, plant_ids=eff_plant_ids)

    # Apply DB name overrides and filter inactive from nested plant rows
    from backend.schemas.material_ledger import PlantReportRow, MaterialReportCard  # noqa: PLC0415
    updated_cards = []
    for card in result.materials:
        db_m = mat_map.get(card.material_id)
        updated_plants = [
            row.model_copy(update={
                "plant_name": plant_map[row.plant_id].name if row.plant_id in plant_map else row.plant_name,
                "city": plant_map[row.plant_id].city if row.plant_id in plant_map else row.city,
            })
            for row in card.plants
            if row.plant_id not in inactive_pids
        ]
        updated_cards.append(card.model_copy(update={
            "material_description": db_m.description if db_m else card.material_description,
            "plants": updated_plants,
        }))

    return ApiResponse(data=result.model_copy(update={"materials": updated_cards}))


@router.get("/location-summary", response_model=ApiResponse[LocationSummarySchema])
async def get_location_summary(
    include_bags: bool = Query(True,  description="Include 50 kg bag materials"),
    include_bulk: bool = Query(False, description="Include bulk materials"),
    db: AsyncSession = Depends(get_db),
):
    """Brand × location grid: floor stock, period dispatch, and (if CSV has date column) inventory days."""
    bg_result = await db.execute(sa_select(BrandGroup).order_by(BrandGroup.sort_order))
    brand_groups = [{"id": b.id, "label": b.label} for b in bg_result.scalars().all()]

    _, mat_map = await _load_db_maps(db)
    material_brand_map = {mid: m.brand_group for mid, m in mat_map.items()}

    return ApiResponse(data=_svc.get_location_summary(
        brand_groups=brand_groups,
        material_brand_map=material_brand_map,
        include_bags=include_bags,
        include_bulk=include_bulk,
    ))


@router.get("/materials", response_model=ApiResponse[list[MaterialSchema]])
async def get_materials(
    plant_id: list[str] = Query(default=[], description="Plant IDs to filter (repeatable)"),
    db: AsyncSession = Depends(get_db),
):
    """Distinct materials for the filter dropdown, scoped to selected plants."""
    plant_map, mat_map = await _load_db_maps(db)
    inactive_pids = {pid for pid, p in plant_map.items() if not p.is_active}
    inactive_mids = {mid for mid, m in mat_map.items() if not m.is_active}

    eff_plant_ids = [p for p in plant_id if p not in inactive_pids] or None if plant_id else None
    all_mats = _svc.get_materials(plant_ids=eff_plant_ids)

    # Filter inactive and apply DB description override
    all_mats = [
        _material_override(m, mat_map)
        for m in all_mats
        if m.material_id not in inactive_mids
    ]

    return ApiResponse(data=all_mats)


@router.get("/plants", response_model=ApiResponse[list[PlantSchema]])
async def get_plants(db: AsyncSession = Depends(get_db)):
    """All plants from the plant master with GPS coordinates for the map."""
    plant_map, _ = await _load_db_maps(db)
    inactive_pids = {pid for pid, p in plant_map.items() if not p.is_active}

    # Filter inactive and apply DB name/city/GPS override
    all_plants = [
        _plant_schema_override(p, plant_map)
        for p in _svc.get_plants()
        if p.plant_id not in inactive_pids
    ]

    return ApiResponse(data=all_plants)
