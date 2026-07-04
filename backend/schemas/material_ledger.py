"""
schemas/material_ledger.py — Material Ledger Pydantic Response Schemas
========================================================================
Every field that the frontend receives is defined here.
extra_fields is typed as dict[str, Any] so new CSV columns pass through
to the frontend without any backend code change.
"""

from typing import Any, Optional
from pydantic import BaseModel


class LedgerKpiSchema(BaseModel):
    opening_stock_mt:      float
    closing_stock_mt:      float
    total_receipts_mt:     float
    total_consumption_mt:  float
    opening_price_lkr:     Optional[float] = None
    closing_price_lkr:     Optional[float] = None
    receipts_price_lkr:    Optional[float] = None
    consumption_price_lkr: Optional[float] = None
    active_plants:         int
    materials_tracked:     int
    unit:                  str



class StockTransferRow(BaseModel):
    """One inter-plant stock transfer parsed from VM VN rows."""
    source_plant_id:      str
    source_plant_name:    str
    dest_plant_id:        str
    dest_plant_name:      str
    material_id:          str
    material_description: str
    quantity:             float
    dest_closing_stock:   float   # ending stock of this material at the destination plant
    price_lkr:            Optional[float] = None
    unit:                 str


class StockTransferSchema(BaseModel):
    transfers: list[StockTransferRow]
    unit:      str


class MaterialSchema(BaseModel):
    material_id:          str
    material_description: str
    brand_group:          Optional[str] = None  # admin-assigned, from Material.brand_group
    closing_stock_mt:     float = 0.0
    ever_stocked:         bool  = False  # True if plant has ever had AB or ZU > 0 for this material


class BrandGroupOptionSchema(BaseModel):
    """Public-facing brand group option — no has_data flag (that's Location
    Summary-specific). Used by filter dropdowns and the Settings thresholds page."""
    id:         str
    label:      str
    sort_order: int


class PlantSchema(BaseModel):
    plant_id:        str
    name:            str
    city:            Optional[str] = None
    address:         Optional[str] = None
    country:         Optional[str] = None
    postal_code:     Optional[str] = None
    customer_number: Optional[str] = None
    plant_type:      str = "depot"  # admin-assigned, from Plant.plant_type
    latitude:        Optional[float] = None
    longitude:       Optional[float] = None
    has_ledger_data: bool = False


# ── Inventory dashboard schemas ───────────────────────────────────────────────

class PlantInventoryRow(BaseModel):
    """Per-plant inventory breakdown for the dashboard table."""
    plant_id:          str
    plant_name:        str
    city:              Optional[str] = None
    on_hand_mt:        float   # CA + EB rows
    in_transit_out_mt: float   # BV + VN + Stock Transfer (factory dispatched)
    in_transit_in_mt:  float   # BV + ZU + Stock Transfer (depot received)
    status:            str     # "ok" | "low" | "out" | "no_threshold"


class InventorySummarySchema(BaseModel):
    rows:                  list[PlantInventoryRow]
    total_on_hand_mt:      float
    total_in_transit_out:  float
    total_in_transit_in:   float
    alert_count:           int
    unit:                  str


class InventoryAlertRow(BaseModel):
    """One low-stock alert entry shown in the alert panel."""
    plant_id:      str
    plant_name:    str
    city:          Optional[str] = None
    material_id:   str
    material_desc: str
    on_hand_mt:    float
    threshold_mt:  float
    pct:           float    # on_hand / threshold × 100, capped at 100
    status:        str      # "low" | "out"
    ever_stocked:  bool = True  # False if this plant never had non-zero stock for this material


class InventoryAlertsSchema(BaseModel):
    alerts: list[InventoryAlertRow]
    unit:   str


class MaterialThresholdSchema(BaseModel):
    material_id:   str
    material_desc: str
    min_stock_mt:  float


# ── Inventory Report schemas ──────────────────────────────────────────────────

class PlantReportRow(BaseModel):
    """One plant row inside a material report card."""
    plant_id:                  str
    plant_name:                str
    city:                      Optional[str] = None
    on_hand_mt:                float   # Inventory with in-transit (CA+EB)
    transit_out_mt:            float   # Transit OUT: BV+VN+Stock Transfer at factories
    transit_in_mt:             float   # Transit IN:  BV+ZU+Stock Transfer at depots
    net_transit_mt:            float   # transit_out - transit_in (negative = net inflow)
    inventory_without_transit: float   # on_hand + transit_in - transit_out


class MaterialReportCard(BaseModel):
    """One material card containing all plant rows."""
    material_id:                       str
    material_description:              str
    plants:                            list[PlantReportRow]
    total_on_hand:                     float
    total_transit_out:                 float
    total_transit_in:                  float
    total_inventory_without_transit:   float


class InventoryReportSchema(BaseModel):
    materials: list[MaterialReportCard]
    unit:      str


# ── Location Summary schemas ──────────────────────────────────────────────────

class BrandGroupStockSchema(BaseModel):
    stock:      float   # closing stock MT (EB rows)
    dispatch:   float   # period dispatch MT (BV/VN Sales Order rows)
    transit_in: float   # incoming in-transit MT (BV/ZU Stock Transfer rows)


class LocationSummaryRow(BaseModel):
    location_id:    str
    location_label: str
    brands:         dict[str, BrandGroupStockSchema]  # keyed by brand_id
    total_stock:    float
    total_dispatch: float
    inventory_days: Optional[float] = None  # None when no date data in CSV


class BrandGroupMetaSchema(BaseModel):
    id:       str
    label:    str
    has_data: bool  # True if any location has non-zero stock or dispatch


class LocationSummarySchema(BaseModel):
    locations:     list[LocationSummaryRow]
    totals:        LocationSummaryRow
    brand_groups:  list[BrandGroupMetaSchema]
    has_date_data: bool
    unit:          str   # "MT" — frontend applies display conversion
