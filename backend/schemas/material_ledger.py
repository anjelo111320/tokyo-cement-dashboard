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


class CategoryFlowRow(BaseModel):
    """One row in the inventory flow waterfall (AB / ZU / KB / VN / EB or any new code)."""
    category_code:   str
    label:           str
    quantity:        float
    total_price_lkr: Optional[float] = None
    sign:            int          # +1 = adds, -1 = reduces
    color:           str
    role:            str          # opening / inflow / summary / outflow / closing / unknown
    unit:            str


class InventoryFlowSchema(BaseModel):
    rows: list[CategoryFlowRow]
    unit: str


class SupplyChainNode(BaseModel):
    plant_id:        str
    name:            str
    node_type:       str        # "factory" or "depot"
    city:            Optional[str] = None
    production_mt:   Optional[float] = None   # only for factory nodes
    receipts_mt:     Optional[float] = None   # only for depot nodes
    ending_stock_mt: Optional[float] = None   # only for depot nodes


class SupplyChainSchema(BaseModel):
    factories:            list[SupplyChainNode]
    depots:               list[SupplyChainNode]
    total_produced_mt:    float
    total_transferred_mt: float
    unit:                 str


class ConsumptionCategory(BaseModel):
    proc_cat: str
    label:    str
    quantity: float
    pct:      float
    unit:     str


class ConsumptionBreakdownSchema(BaseModel):
    total_consumption_mt: float
    categories:           list[ConsumptionCategory]
    unit:                 str


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


class PlantComparisonRow(BaseModel):
    plant_id:        str
    plant_name:      str
    city:            Optional[str] = None
    opening_mt:      float
    receipts_mt:     float
    consumption_mt:  float
    closing_mt:      float


class PlantComparisonSchema(BaseModel):
    plants: list[PlantComparisonRow]
    unit:   str


class StockTransferRow(BaseModel):
    """One inter-plant stock transfer parsed from VM VN rows."""
    source_plant_id:   str
    source_plant_name: str
    dest_plant_id:     str
    dest_plant_name:   str
    quantity:          float
    price_lkr:         Optional[float] = None
    unit:              str


class StockTransferSchema(BaseModel):
    transfers: list[StockTransferRow]
    unit:      str


class MaterialSchema(BaseModel):
    material_id:          str
    material_description: str


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
