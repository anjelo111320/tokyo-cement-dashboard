"""
core/material_ledger_config.py — Material Ledger Field & Category Configuration
=================================================================================
THIS IS THE ONLY FILE YOU NEED TO EDIT when the SAP CSV export changes.

How to handle common changes:
  • Column renamed in the CSV?
      Update COLUMN_MAP — change the value (CSV column name), not the key.

  • New column added to the CSV?
      Add a new key:value pair to COLUMN_MAP. The repository will include
      it automatically in every response as an "extra_fields" dict.

  • New movement category code added (e.g. "XY")?
      Add it to CATEGORY_CONFIG with label, order, sign (+1/-1), and color.
      The service and frontend will pick it up with no other changes.

  • New plant added?
      Nothing to change — plants come from plant_names.csv automatically.

  • New material added?
      Nothing to change — materials come from material_ledger.csv automatically.

  • Quantity column changes unit (e.g. bags → pallets)?
      Update QUANTITY_UNIT to the new display label.

Architecture note:
  Nothing outside this file should ever hard-code a CSV column name,
  a category code string, or a color for a category.
  Always import from this module.
"""

# ── Column mapping ─────────────────────────────────────────────────────────────
# LEFT  = internal field name used in models and services (never changes).
# RIGHT = actual column header in the CSV (change this when the export changes).
#
# To add a new column from the CSV: add a new key:value pair here.
# The repository will include it in the raw record automatically.

COLUMN_MAP: dict[str, str] = {
    "plant_id":             "Plant",
    "valuation_class":      "Valuation Class",
    "material_id":          "Material",
    "material_description": "Material Description",
    "obj_type":             "Obj Type",
    "category":             "Category",
    "movement_description": "All Items",
    "proc_cat_name":        "Proc Cat Name",
    "quantity":             "Quantity",
    "price":                "Price",
}

# ── Plant name column mapping ──────────────────────────────────────────────────
# These are the columns read from plant_names.csv.
# Add new columns here to expose more plant master data to the API.

PLANT_COLUMN_MAP: dict[str, str] = {
    "plant_id":        "Plant",
    "name":            "Name 1",
    "city":            "City",
    "address":         "Street and House No.",
    "country":         "Country/Region Key",
    "postal_code":     "Postal Code",
    "customer_number": "Customer Number of Plant",
    "lat_lng_raw":     "latitude / longitude",
}

# ── Movement category configuration ────────────────────────────────────────────
# Each category code from the CSV is described here.
# Adding a new row: add the SAP category code as the key with these fields:
#   label  — human-readable name shown in the dashboard
#   order  — display order in the flow card (1 = first)
#   sign   — +1 = adds to stock, -1 = reduces stock (used in waterfall chart)
#   color  — hex color for charts and badges
#   role   — "opening"|"inflow"|"summary"|"outflow"|"closing" (drives chart shape)

CATEGORY_CONFIG: dict[str, dict] = {
    "AB": {
        "label": "Beginning Inventory",
        "order": 1,
        "sign":  +1,
        "color": "#3D8BAD",   # teal — opening position
        "role":  "opening",
    },
    "ZU": {
        "label": "Receipts",
        "order": 2,
        "sign":  +1,
        "color": "#22C55E",   # green — stock coming in
        "role":  "inflow",
    },
    "KB": {
        "label": "Cumulative Inventory",
        "order": 3,
        "sign":  +1,
        "color": "#8B5CF6",   # purple — running total (AB + ZU)
        "role":  "summary",
    },
    "VN": {
        "label": "Consumption",
        "order": 4,
        "sign":  -1,
        "color": "#E05540",   # coral — stock going out
        "role":  "outflow",
    },
    "EB": {
        "label": "Ending Inventory",
        "order": 5,
        "sign":  +1,
        "color": "#1B3550",   # navy — closing position
        "role":  "closing",
    },
}

# ── Object type configuration ──────────────────────────────────────────────────
# CA = financial/accounting posting (stock account movement)
# BV = physical goods movement (actual physical stock)
# VM = material valuation
# Add new types here without touching any other file.

OBJ_TYPE_CONFIG: dict[str, str] = {
    "CA": "Stock Account",
    "BV": "Goods Movement",
    "VM": "Material Valuation",
}

# ── Procurement category labels ────────────────────────────────────────────────
# Sub-types of the VN (Consumption) category.
# Add new procurement categories here.

PROC_CAT_LABELS: dict[str, str] = {
    "Stock Transfer": "Inter-Plant Transfer",
    "Consumption":    "Internal Consumption",
    "Sales Order":    "Customer Sales",
    "Production":     "Production Output",
}

# ── Display settings ──────────────────────────────────────────────────────────
# Change the unit label if the CSV switches from metric tonnes to another unit.
QUANTITY_UNIT: str = "MT"          # Metric Tonnes
QUANTITY_UNIT_LABEL: str = "MT"    # shown next to numbers in UI
CURRENCY_SYMBOL: str = "LKR"       # Sri Lanka Rupee

# Categories that represent inflows (used for totalling "total received")
INFLOW_CATEGORIES: list[str] = ["ZU"]

# Categories that represent outflows (used for totalling "total consumed")
OUTFLOW_CATEGORIES: list[str] = ["VN"]

# The "physical stock" category (used for ending balance KPI)
CLOSING_CATEGORY: str = "EB"
OPENING_CATEGORY: str = "AB"

# ── Low-stock alert thresholds ─────────────────────────────────────────────────
# Maps material_id (string) → minimum on-hand stock in MT.
# Plants whose closing stock (EB) falls below this value will appear in alerts.
# A threshold of 0 means no alert for that material.
# Update via POST /api/v1/settings/thresholds at runtime — no restart needed.
MATERIAL_THRESHOLDS: dict[str, float] = {
    # "80300000008": 5.0,
}
