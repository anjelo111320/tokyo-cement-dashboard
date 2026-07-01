"""
repositories/csv/material_ledger_csv_repo.py — Material Ledger & Plant CSV Repositories
==========================================================================================
Two repositories in one file because both serve the same feature.

Config-driven design:
  Column names are never hard-coded here. Every column reference goes through
  COLUMN_MAP and PLANT_COLUMN_MAP from material_ledger_config.py.
  If the CSV column "Quantity" is renamed to "Qty_MT" in a new SAP export,
  only the config file changes — this repository stays identical.

Extra-columns capture:
  Any column in the CSV that is NOT in the COLUMN_MAP is stored in
  extra_fields on the model, so it is never silently dropped.

Used by:
  services/material_ledger_service.py → both repo classes
"""

from typing import Optional
import pandas as pd

from backend.core.material_ledger_config import COLUMN_MAP, PLANT_COLUMN_MAP
from backend.models.material_ledger import MaterialMovement, PlantMaster
from backend.repositories.csv.csv_base import csv_cache
from backend.core.logging import get_logger

logger = get_logger(__name__)

# Reverse map: CSV column name → internal field name (used for extra_fields detection)
_KNOWN_CSV_COLS = set(COLUMN_MAP.values())
_KNOWN_PLANT_COLS = set(PLANT_COLUMN_MAP.values())


class MaterialLedgerCsvRepository:
    """
    Reads material_ledger.csv and maps rows to MaterialMovement domain models.
    All filtering happens on the pandas DataFrame before mapping (fast path).
    """

    def get_movements(
        self,
        plant_id: Optional[str] = None,
        material_id: Optional[str] = None,
        obj_type: Optional[str] = None,
        category: Optional[str] = None,
        plant_ids: Optional[list[str]] = None,
    ) -> list[MaterialMovement]:
        """
        Returns movement records filtered by any combination of:
          plant_id    — SAP plant code, e.g. "2114"
          material_id — SAP material number, e.g. "80300000008"
          obj_type    — "CA", "BV", or "VM"
          category    — "AB", "ZU", "KB", "VN", "EB"

        Uses COLUMN_MAP to locate column names — safe if the CSV is renamed.
        """
        df = csv_cache.get("material_ledger")

        # Rename CSV columns to internal names using the config map.
        # Only rename columns that actually exist in this CSV (guards against
        # mismatches between config and actual file).
        rename_map = {
            csv_col: internal_key
            for internal_key, csv_col in COLUMN_MAP.items()
            if csv_col in df.columns
        }
        df = df.rename(columns=rename_map)

        # Coerce quantity to numeric.
        # SAP exports reversal entries with a trailing minus: "60-" means -60.
        # Standard pd.to_numeric cannot parse this format, so we convert first.
        if "quantity" in df.columns:
            q = df["quantity"].astype(str).str.strip()
            q = q.str.replace(",", "", regex=False)
            # trailing minus: "60-" → "-60", "5.500-" → "-5.500"
            q = q.str.replace(r"^(\d+\.?\d*)-$", r"-\1", regex=True)
            df["quantity"] = pd.to_numeric(q, errors="coerce").fillna(0.0)

        # Coerce price to numeric — strip thousand-separator commas first.
        if "price" in df.columns:
            df["price"] = pd.to_numeric(
                df["price"].astype(str).str.replace(",", "", regex=False),
                errors="coerce",
            )

        # Coerce plant_id and material_id to string so filters are type-safe.
        # Pandas may read numeric IDs as floats ("2114.0") — strip the decimal part.
        if "plant_id" in df.columns:
            df["plant_id"] = (
                df["plant_id"].astype(str).str.strip().str.split(".").str[0]
            )
            # Drop blank/separator rows (e.g. "----" footer rows from SAP exports)
            df = df[df["plant_id"].str.match(r"^\d+$")]
        if "material_id" in df.columns:
            df["material_id"] = df["material_id"].astype(str).str.strip()

        # ── Vectorised filters (applied on the full DataFrame — fast) ──────────
        if plant_ids:
            df = df[df["plant_id"].isin([str(p) for p in plant_ids])]
        elif plant_id:
            df = df[df["plant_id"] == str(plant_id)]
        if material_id:
            df = df[df["material_id"] == str(material_id)]
        if obj_type:
            df = df[df.get("obj_type", pd.Series(dtype=str)) == obj_type]
        if category:
            df = df[df.get("category", pd.Series(dtype=str)) == category]

        # Identify which columns in the renamed DataFrame are NOT in COLUMN_MAP
        # (i.e. they are extra/new columns from the SAP export).
        known_internal = set(rename_map.values())
        extra_col_names = [c for c in df.columns if c not in known_internal]

        # ── Map each row to the domain model ───────────────────────────────────
        movements: list[MaterialMovement] = []
        for row in df.to_dict("records"):
            try:
                # Capture any extra columns that aren't in COLUMN_MAP.
                extra = {col: row.get(col) for col in extra_col_names}

                movements.append(MaterialMovement(
                    plant_id=str(row.get("plant_id", "")),
                    material_id=str(row.get("material_id", "")),
                    material_description=str(row.get("material_description", "")),
                    obj_type=str(row.get("obj_type", "")),
                    category=str(row.get("category", "")),
                    movement_description=str(row.get("movement_description", "")),
                    quantity=float(row.get("quantity", 0.0)),
                    valuation_class=str(row["valuation_class"])
                    if pd.notna(row.get("valuation_class")) else None,
                    proc_cat_name=str(row["proc_cat_name"])
                    if pd.notna(row.get("proc_cat_name")) else None,
                    price=float(row["price"])
                    if pd.notna(row.get("price")) else None,
                    extra_fields=extra,
                ))
            except Exception as exc:
                logger.warning("material_ledger_row_skipped", error=str(exc))
                continue

        return movements

    def get_unique_materials(self, plant_ids: Optional[list[str]] = None) -> list[dict]:
        """Returns a deduplicated list of material_id + description pairs.
        If plant_ids is provided, returns only materials that appear at those plants.
        """
        df = csv_cache.get("material_ledger")
        plant_col = COLUMN_MAP.get("plant_id", "Plant")
        mid_col = COLUMN_MAP.get("material_id", "Material")
        mdesc_col = COLUMN_MAP.get("material_description", "Material Description")
        if mid_col not in df.columns:
            return []

        if plant_ids and plant_col in df.columns:
            pid_series = df[plant_col].astype(str).str.strip().str.split(".").str[0]
            df = df[pid_series.isin([str(p) for p in plant_ids])]

        cols = [mid_col] + ([mdesc_col] if mdesc_col in df.columns else [])
        unique = df[cols].drop_duplicates()
        return unique.rename(columns={mid_col: "material_id", mdesc_col: "material_description"}).to_dict("records")

    def get_unique_plants(self) -> list[str]:
        """Returns all unique plant_id values in the ledger data.
        Strips decimal suffix so pandas float reads ("2114.0") match
        plant master IDs ("2114").
        """
        df = csv_cache.get("material_ledger")
        col = COLUMN_MAP.get("plant_id", "Plant")
        if col not in df.columns:
            return []
        return (
            df[col].dropna().astype(str).str.strip()
            .str.split(".").str[0]           # "2114.0" → "2114"
            .str.strip()
            .loc[lambda s: s.str.match(r"^\d+$")]  # drop blank/separator rows
            .unique().tolist()
        )


def _parse_lat_lng(raw: str) -> tuple[Optional[float], Optional[float]]:
    """
    Parses "6.9198° N, 79.8573° E" → (6.9198, 79.8573).
    Returns (None, None) if the string is missing or unparseable.
    Handles S (negative lat) and W (negative lng) hemispheres.
    """
    import re
    if not raw or not raw.strip():
        return None, None
    parts = [p.strip() for p in raw.split(",")]
    if len(parts) != 2:
        return None, None
    try:
        def to_decimal(s: str) -> float:
            num = float(re.sub(r"[°\s]", "", s.split("°")[0]))
            if "S" in s.upper():
                num = -num
            if "W" in s.upper():
                num = -num
            return num
        return to_decimal(parts[0]), to_decimal(parts[1])
    except Exception:
        return None, None


class PlantMasterCsvRepository:
    """
    Reads plant_names.csv and maps rows to PlantMaster domain models.
    GPS coordinates are read from the "latitude / longitude" column in the CSV
    (format: "6.9198° N, 79.8573° E") — no hardcoded coordinates needed.
    Only PLANT_COLUMN_MAP columns are typed fields — all others go to extra_fields.
    """

    def get_all_plants(self) -> list[PlantMaster]:
        """Returns all plants from the plant master CSV with GPS from the CSV column."""
        df = csv_cache.get("plant_names")

        rename_map = {
            csv_col: internal_key
            for internal_key, csv_col in PLANT_COLUMN_MAP.items()
            if csv_col in df.columns
        }
        df = df.rename(columns=rename_map)

        if "plant_id" in df.columns:
            df["plant_id"] = df["plant_id"].astype(str).str.strip()

        known_internal = set(rename_map.values())
        extra_col_names = [c for c in df.columns if c not in known_internal]

        plants: list[PlantMaster] = []
        for row in df.to_dict("records"):
            try:
                pid = str(row.get("plant_id", ""))
                lat, lng = _parse_lat_lng(str(row.get("lat_lng_raw", "") or ""))
                extra = {col: row.get(col) for col in extra_col_names}

                plants.append(PlantMaster(
                    plant_id=pid,
                    name=str(row.get("name", "")),
                    city=str(row["city"]) if pd.notna(row.get("city")) else None,
                    address=str(row["address"]) if pd.notna(row.get("address")) else None,
                    country=str(row["country"]) if pd.notna(row.get("country")) else None,
                    postal_code=str(row["postal_code"]) if pd.notna(row.get("postal_code")) else None,
                    customer_number=str(row["customer_number"]) if pd.notna(row.get("customer_number")) else None,
                    latitude=lat,
                    longitude=lng,
                    extra_fields=extra,
                ))
            except Exception as exc:
                logger.warning("plant_master_row_skipped", error=str(exc))
                continue

        return plants

    def get_plant(self, plant_id: str) -> Optional[PlantMaster]:
        """Returns one plant by ID, or None if not found."""
        plants = self.get_all_plants()
        return next((p for p in plants if p.plant_id == str(plant_id)), None)
