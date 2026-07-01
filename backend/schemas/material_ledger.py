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


class MovementRowSchema(BaseModel):
    """One raw movement row — includes extra_fields for new CSV columns."""
    plant_id:             str
    material_id:          str
    material_description: str
    obj_type:             str
    obj_type_label:       str
    category:             str
    category_label:       str
    category_color:       str
    movement_description: str
    proc_cat_name:        Optional[str] = None
    proc_cat_label:       str
    quantity:             float
    price:                Optional[float] = None
    unit:                 str
    extra_fields:         dict[str, Any] = {}   # any new CSV columns pass through here


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
    closing_stock_mt:     float = 0.0


class PlantSchema(BaseModel):
    plant_id:        str
    name:            str
    city:            Optional[str] = None
    address:         Optional[str] = None
    country:         Optional[str] = None
    postal_code:     Optional[str] = None
    customer_number: Optional[str] = None
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


class InventoryAlertsSchema(BaseModel):
    alerts: list[InventoryAlertRow]
    unit:   str


class MaterialThresholdSchema(BaseModel):
    material_id:   str
    material_desc: str
    min_stock_mt:  float
