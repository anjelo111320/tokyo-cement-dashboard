"""
models/material_ledger.py — Material Ledger Domain Model
=========================================================
Represents one row from the SAP material ledger CSV export.

Design principle — flexible extra_fields dict:
  The model stores the 10 known columns as typed attributes.
  Any additional columns that appear in the CSV (new fields added by SAP)
  are captured in `extra_fields` so they are not silently lost.
  The API passes them through and the frontend can display them.

Used by:
  repositories/csv/material_ledger_csv_repo.py → creates instances
  services/material_ledger_service.py          → reads fields for aggregation
"""

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class MaterialMovement:
    """
    One inventory movement row from the material ledger CSV.

    Fields match COLUMN_MAP keys in core/material_ledger_config.py.
    If the CSV adds new columns, they appear in extra_fields — no model change needed.
    """
    plant_id:             str
    material_id:          str
    material_description: str
    obj_type:             str        # CA / BV / VM
    category:             str        # AB / ZU / KB / VN / EB
    movement_description: str        # "Beginning Inventory", "Receipts", etc.
    quantity:             float
    valuation_class:      Optional[str] = None
    proc_cat_name:        Optional[str] = None
    price:                Optional[float] = None
    # Any extra columns from the CSV are captured here automatically.
    extra_fields:         dict[str, Any] = field(default_factory=dict)


@dataclass
class PlantMaster:
    """
    One row from the plant names CSV — the master data for a plant/depot.
    Core fields are typed. All other SAP fields land in extra_fields.
    """
    plant_id:        str
    name:            str
    city:            Optional[str] = None
    address:         Optional[str] = None
    country:         Optional[str] = None
    postal_code:     Optional[str] = None
    customer_number: Optional[str] = None
    latitude:        Optional[float] = None
    longitude:       Optional[float] = None
    extra_fields:    dict[str, Any] = field(default_factory=dict)
