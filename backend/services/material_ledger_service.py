"""
services/material_ledger_service.py — Material Ledger Business Logic
======================================================================
All aggregation for the Material Ledger page lives here.
Business rules (what is an inflow, what is an outflow, what is "ending stock")
are read from material_ledger_config.py — NOT hard-coded here.

If a new category code appears in the SAP export:
  1. Add it to CATEGORY_CONFIG in material_ledger_config.py.
  2. This service automatically includes it in all aggregations.
  3. No code change needed here.

Depends on:
  repositories/csv/material_ledger_csv_repo.py → MaterialLedgerCsvRepository,
                                                  PlantMasterCsvRepository
  core/material_ledger_config.py                → all config constants
  schemas/material_ledger.py                    → all response types

Used by:
  api/v1/material_ledger.py → all endpoints
"""

import re
from typing import Optional
from backend.repositories.csv.material_ledger_csv_repo import (
    MaterialLedgerCsvRepository,
    PlantMasterCsvRepository,
)
from backend.core.material_ledger_config import (
    CATEGORY_CONFIG,
    QUANTITY_UNIT,
    CLOSING_CATEGORY,
    OPENING_CATEGORY,
    INFLOW_CATEGORIES,
    OUTFLOW_CATEGORIES,
)
from backend.schemas.material_ledger import (
    MaterialSchema,
    PlantSchema,
    LedgerKpiSchema,
    StockTransferRow,
    StockTransferSchema,
    PlantInventoryRow,
    InventorySummarySchema,
    InventoryAlertRow,
    InventoryAlertsSchema,
    MaterialThresholdSchema,
    PlantReportRow,
    MaterialReportCard,
    InventoryReportSchema,
    LocationSummarySchema,
    LocationSummaryRow,
    BrandGroupStockSchema,
    BrandGroupMetaSchema,
)
from backend.core.material_ledger_config import MATERIAL_THRESHOLDS as _thresholds_store


def _classify_brand(desc: str) -> Optional[str]:
    """Best-effort default brand group for a newly-discovered material (CSV
    auto-sync). The persisted, admin-editable Material.brand_group field is
    the actual source of truth once a material exists — see admin.py and
    get_location_summary(). Order matters: most specific first."""
    d = desc.lower()
    if "mahamera" in d:                                                               return "mahamera"
    if "marine" in d and ("v-l" in d or "s-l" in d or "marine plus_" in d):          return "marine_composite"
    if "mahaweli marine" in d or "marine cement" in d or "mm+ " in d:                return "mmc_plus"
    if "sanstha" in d:                                                                return "sanstha"
    # Holcim Ready Flow (old branding) merges into Rapid Flow
    if "rapid flow" in d or "ready flow" in d or "readyflow" in d:                   return "rapid_flow"
    if "extra" in d:                                                                  return "extra"
    if "supiri" in d:                                                                 return "supiri"
    if "ambuja" in d:                                                                 return "ambuja"
    if "fiberbond" in d:                                                              return "fiberbond"
    # Damage, scrap, clinker — excluded
    return None


def _material_is_bag(desc: str) -> bool:
    return "bulk" not in desc.lower()


def _material_is_bulk(desc: str) -> bool:
    return "bulk" in desc.lower()


def _normalize_material_desc(desc: str) -> str:
    """
    Normalize inconsistent dash separators in SAP material descriptions.

    SAP exports use at least three dash styles for the brand/plant separator:
      "Brand - Variant"   (space-dash-space)  — standard
      "Brand- Variant"    (dash-space)         — missing leading space
      "Brand -Variant"    (space-dash)         — missing trailing space
      "Brand-Variant"     (no spaces)          — fully missing spaces

    We normalise all three non-standard styles to " - ".
    Single-letter-dash-single-letter sequences (e.g. "V-L", "S-L") are kept
    intact because they are product-type codes, not separators.
    """
    # "Brand- Variant": dash immediately before whitespace, no leading space
    desc = re.sub(r'(?<=[A-Za-z0-9\)])-\s+', ' - ', desc)
    # "Brand -Variant": whitespace immediately before dash, no trailing space
    desc = re.sub(r'\s+-(?=[A-Za-z0-9])', ' - ', desc)
    # "Brand-Variant": no spaces, but only when the right side is a multi-char
    # word starting with uppercase OR starts with a digit (plant codes, e.g. PCW,
    # Puttalam, Ruhunu, 50kg) — avoids breaking "V-L" / "S-L" (single-letter right side)
    desc = re.sub(r'(?<=[A-Za-z0-9\)])-(?=[A-Z]{2,}|[A-Z][a-z]|[0-9])', ' - ', desc)
    # Collapse any double spaces introduced above
    return re.sub(r'  +', ' ', desc).strip()


class MaterialLedgerService:

    def __init__(self) -> None:
        self._ledger = MaterialLedgerCsvRepository()
        self._plants = PlantMasterCsvRepository()

    # ── KPI Summary ───────────────────────────────────────────────────────────

    def get_kpis(
        self,
        plant_id: Optional[str] = None,
        material_id: Optional[str] = None,
    ) -> LedgerKpiSchema:
        """
        Top-level KPI cards for the Material Ledger home section.
        Returns one number per key category using config-defined category codes.
        """
        # CA-only: accounting summary rows. Using all obj_types causes
        # triple-counting (CA + BV + VM each carry the same quantity).
        movements = self._ledger.get_movements(
            plant_id=plant_id, material_id=material_id, obj_type="CA"
        )

        def total_qty(cat: str) -> float:
            return sum(m.quantity for m in movements if m.category == cat)

        def total_price(cat: str) -> Optional[float]:
            vals = [m.price for m in movements if m.category == cat and m.price is not None]
            return round(sum(vals), 2) if vals else None

        opening = total_qty(OPENING_CATEGORY)
        closing = total_qty(CLOSING_CATEGORY)
        total_inflow = sum(total_qty(c) for c in INFLOW_CATEGORIES)
        total_outflow = sum(total_qty(c) for c in OUTFLOW_CATEGORIES)

        # Sum prices for each KPI category
        opening_price = total_price(OPENING_CATEGORY)
        closing_price = total_price(CLOSING_CATEGORY)
        receipts_price_vals = [total_price(c) for c in INFLOW_CATEGORIES if total_price(c) is not None]
        receipts_price = round(sum(receipts_price_vals), 2) if receipts_price_vals else None  # type: ignore[arg-type]
        consumption_price_vals = [total_price(c) for c in OUTFLOW_CATEGORIES if total_price(c) is not None]
        consumption_price = round(sum(consumption_price_vals), 2) if consumption_price_vals else None  # type: ignore[arg-type]

        # Plants with any non-zero movement
        active_plants = len({m.plant_id for m in movements if m.quantity != 0})

        # Unique materials in result
        unique_materials = len({m.material_id for m in movements})

        return LedgerKpiSchema(
            opening_stock_mt=round(opening, 2),
            closing_stock_mt=round(closing, 2),
            total_receipts_mt=round(total_inflow, 2),
            total_consumption_mt=round(total_outflow, 2),
            opening_price_lkr=opening_price,
            closing_price_lkr=closing_price,
            receipts_price_lkr=receipts_price,
            consumption_price_lkr=consumption_price,
            active_plants=active_plants,
            materials_tracked=unique_materials,
            unit=QUANTITY_UNIT,
        )

    # ── Inventory Dashboard ───────────────────────────────────────────────────

    def get_inventory_summary(
        self,
        material_ids: Optional[list[str]] = None,
        plant_ids: Optional[list[str]] = None,
        zero_stock_mode: str = "accurate",
    ) -> InventorySummarySchema:
        """
        Per-plant inventory breakdown for the new dashboard.

        On hand    = CA + EB rows (physical closing stock)
        In-Transit OUT = BV + VN + Stock Transfer at factory plants (net positive)
        In-Transit IN  = BV + ZU + Stock Transfer at depot plants (gross positive)
        """
        all_movements = self._ledger.get_movements(plant_ids=plant_ids if plant_ids else None)
        plant_masters = {p.plant_id: p for p in self._plants.get_all_plants()}

        # Identify factory plants (those that have Production-type ZU receipts)
        factory_ids: set[str] = set()
        for m in all_movements:
            if m.category == "ZU" and m.proc_cat_name == "Production":
                factory_ids.add(m.plant_id)

        # Filter by selected materials if provided
        if material_ids:
            material_set = set(str(mid) for mid in material_ids)
            movements = [m for m in all_movements if str(m.material_id) in material_set]
        else:
            movements = all_movements

        # Buckets per plant
        on_hand:         dict[str, float] = {}
        in_transit_out:  dict[str, float] = {}
        in_transit_in:   dict[str, float] = {}

        for m in movements:
            pid = m.plant_id

            # On hand: CA + EB
            if m.obj_type == "CA" and m.category == "EB":
                on_hand[pid] = on_hand.get(pid, 0.0) + m.quantity

            # In-transit OUT: BV + VN + Stock Transfer at factory
            if (m.obj_type == "BV" and m.category == "VN"
                    and m.proc_cat_name == "Stock Transfer"
                    and pid in factory_ids
                    and m.quantity > 0):
                in_transit_out[pid] = in_transit_out.get(pid, 0.0) + m.quantity

            # In-transit IN: BV + ZU + Stock Transfer at depots
            if (m.obj_type == "BV" and m.category == "ZU"
                    and m.proc_cat_name == "Stock Transfer"
                    and pid not in factory_ids
                    and m.quantity > 0):
                in_transit_in[pid] = in_transit_in.get(pid, 0.0) + m.quantity

        # Gather all plant IDs that appear in any bucket
        all_pids = set(on_hand) | set(in_transit_out) | set(in_transit_in)

        # Sum closing stock per (plant, material) so we compare each material
        # individually against its own threshold — not the plant total vs one value.
        per_mat_stock: dict[tuple[str, str], float] = {}
        for m in movements:
            if m.obj_type == "CA" and m.category == "EB":
                key = (m.plant_id, str(m.material_id))
                per_mat_stock[key] = per_mat_stock.get(key, 0.0) + m.quantity

        # Option B (accurate): build the set of plant-material pairs that have
        # ever received opening stock (AB) or a receipt (ZU) — meaning the plant
        # actually carries that material.  A zero EB without any prior AB/ZU means
        # the plant simply doesn't stock that product, so we skip it.
        # Option A (active_only): skip this check entirely; instead only flag
        # pairs where 0 < stock < threshold (never flag stock == 0 as "out").
        ever_stocked: set[tuple[str, str]] = set()
        if zero_stock_mode == "accurate":
            for m in movements:
                if m.obj_type == "CA" and m.category in ("AB", "ZU") and m.quantity > 0:
                    ever_stocked.add((m.plant_id, str(m.material_id)))

        alert_plant_ids: set[str] = set()
        out_plant_ids:   set[str] = set()
        low_count:       dict[str, int] = {}
        out_count:       dict[str, int] = {}
        for (plant_id, material_id), stock in per_mat_stock.items():
            threshold = _thresholds_store.get(material_id, 0.0)
            if threshold <= 0:
                continue

            if zero_stock_mode == "accurate":
                if (plant_id, material_id) not in ever_stocked:
                    continue  # plant never stocked this material — not a real alert
                if stock < threshold:
                    alert_plant_ids.add(plant_id)
                    if stock <= 0:
                        out_plant_ids.add(plant_id)
                        out_count[plant_id] = out_count.get(plant_id, 0) + 1
                    else:
                        low_count[plant_id] = low_count.get(plant_id, 0) + 1
            else:  # active_only: only flag genuinely low, never flag zero
                if 0 < stock < threshold:
                    alert_plant_ids.add(plant_id)
                    low_count[plant_id] = low_count.get(plant_id, 0) + 1

        rows: list[PlantInventoryRow] = []
        for pid in sorted(all_pids):
            pm = plant_masters.get(pid)
            oh  = round(on_hand.get(pid, 0.0), 3)
            ito = round(in_transit_out.get(pid, 0.0), 3)
            iti = round(in_transit_in.get(pid, 0.0), 3)

            if pid in out_plant_ids:
                status = "out"
            elif pid in alert_plant_ids:
                status = "low"
            else:
                status = "ok"

            rows.append(PlantInventoryRow(
                plant_id=pid,
                plant_name=pm.name if pm else f"Plant {pid}",
                city=pm.city if pm else None,
                on_hand_mt=oh,
                in_transit_out_mt=ito,
                in_transit_in_mt=iti,
                status=status,
                low_count=low_count.get(pid, 0),
                out_count=out_count.get(pid, 0),
            ))

        # Sort: alerts first, then by on-hand desc
        rows.sort(key=lambda r: (r.status == "ok", -r.on_hand_mt))

        return InventorySummarySchema(
            rows=rows,
            total_on_hand_mt=round(sum(on_hand.values()), 3),
            total_in_transit_out=round(sum(in_transit_out.values()), 3),
            total_in_transit_in=round(sum(in_transit_in.values()), 3),
            alert_count=len(alert_plant_ids),
            unit=QUANTITY_UNIT,
        )


    def get_inventory_alerts(
        self,
        material_ids: Optional[list[str]] = None,
    ) -> InventoryAlertsSchema:
        """Returns all plant-material pairs where summed closing stock is below threshold."""
        movements = self._ledger.get_movements(obj_type="CA", category="EB")
        plant_masters = {p.plant_id: p for p in self._plants.get_all_plants()}

        if material_ids:
            material_set = set(str(mid) for mid in material_ids)
            movements = [m for m in movements if str(m.material_id) in material_set]

        # Aggregate: sum all EB rows per (plant_id, material_id) before comparing.
        # The CSV may have multiple EB rows for the same plant+material; using only
        # the first row (as the old seen-set approach did) gives wrong closing stock.
        totals: dict[tuple[str, str], float] = {}
        meta: dict[tuple[str, str], object] = {}
        for m in movements:
            key = (m.plant_id, str(m.material_id))
            totals[key] = totals.get(key, 0.0) + m.quantity
            if key not in meta:
                meta[key] = m  # keep first row for description / plant lookup

        # Build ever_stocked from AB (opening balance) and ZU (receipts) rows —
        # same logic as get_inventory_summary.  EB=0 means "ran out", not "never
        # stocked"; checking AB/ZU correctly distinguishes the two cases.
        ever_stocked: set[tuple[str, str]] = set()
        for m in self._ledger.get_movements(obj_type="CA"):
            if m.category in ("AB", "ZU") and m.quantity > 0:
                ever_stocked.add((m.plant_id, str(m.material_id)))

        alerts: list[InventoryAlertRow] = []
        for (plant_id, material_id), total_qty in totals.items():
            threshold = _thresholds_store.get(material_id, 0.0)
            if threshold <= 0:
                continue
            if total_qty >= threshold:
                continue

            m = meta[(plant_id, material_id)]
            pct = round((total_qty / threshold) * 100, 1)
            status = "out" if total_qty <= 0 else "low"
            pm = plant_masters.get(plant_id)
            key = (plant_id, material_id)

            alerts.append(InventoryAlertRow(
                plant_id=plant_id,
                plant_name=pm.name if pm else f"Plant {plant_id}",
                city=pm.city if pm else None,
                material_id=material_id,
                material_desc=m.material_description,
                on_hand_mt=round(total_qty, 3),
                threshold_mt=threshold,
                pct=min(100.0, pct),
                status=status,
                ever_stocked=key in ever_stocked,
            ))

        alerts.sort(key=lambda a: a.pct)
        return InventoryAlertsSchema(alerts=alerts, unit=QUANTITY_UNIT)

    def get_material_thresholds(self) -> list[MaterialThresholdSchema]:
        """Returns all configured thresholds with material descriptions."""
        materials = {str(m["material_id"]): str(m.get("material_description", ""))
                     for m in self._ledger.get_unique_materials()}
        return [
            MaterialThresholdSchema(
                material_id=mid,
                material_desc=materials.get(mid, mid),
                min_stock_mt=val,
            )
            for mid, val in _thresholds_store.items()
        ]

    def set_material_threshold(self, material_id: str, min_stock_mt: float) -> None:
        """Updates the in-memory threshold for a material (no restart needed)."""
        if min_stock_mt <= 0:
            _thresholds_store.pop(material_id, None)
        else:
            _thresholds_store[material_id] = min_stock_mt

    # ── Stock Transfers ───────────────────────────────────────────────────────

    def get_stock_transfers(
        self,
        plant_id: Optional[str] = None,
        material_id: Optional[str] = None,
    ) -> StockTransferSchema:
        """
        Returns inter-plant stock transfer records parsed from VM+VN rows.

        Each VM row with category=VN and proc_cat_name="Stock Transfer" encodes:
          movement_description = "{material_id} {dest_plant_id}"
        so the destination plant is the last whitespace-separated token.

        Also includes material info and the destination plant's closing stock
        for that material so the frontend can show stock status.
        """
        movements = self._ledger.get_movements(
            plant_id=plant_id,
            material_id=material_id,
            obj_type="VM",
            category="VN",
        )
        plant_masters = {p.plant_id: p for p in self._plants.get_all_plants()}

        # Build closing stock lookup: (plant_id, material_id) → closing qty
        # Also build material description lookup from EB rows, since VM/VN rows
        # in the SAP CSV often have an empty material_description column.
        eb_movements = self._ledger.get_movements(obj_type="CA", category="EB")
        closing_stock: dict[tuple[str, str], float] = {}
        material_desc_lookup: dict[str, str] = {}
        for m in eb_movements:
            key = (m.plant_id, m.material_id)
            closing_stock[key] = closing_stock.get(key, 0.0) + m.quantity
            if m.material_id not in material_desc_lookup and m.material_description:
                material_desc_lookup[m.material_id] = m.material_description

        rows: list[StockTransferRow] = []
        for m in movements:
            if m.proc_cat_name != "Stock Transfer":
                continue
            parts = m.movement_description.strip().split()
            if not parts:
                continue
            dest_id = parts[-1]

            src = plant_masters.get(m.plant_id)
            dst = plant_masters.get(dest_id)
            dest_close = round(closing_stock.get((dest_id, m.material_id), 0.0), 3)

            mdesc = m.material_description or material_desc_lookup.get(m.material_id, m.material_id)
            rows.append(StockTransferRow(
                source_plant_id=m.plant_id,
                source_plant_name=src.name if src else f"Plant {m.plant_id}",
                dest_plant_id=dest_id,
                dest_plant_name=dst.name if dst else f"Plant {dest_id}",
                material_id=m.material_id,
                material_description=mdesc,
                quantity=round(m.quantity, 3),
                dest_closing_stock=dest_close,
                price_lkr=round(m.price, 2) if m.price is not None else None,
                unit=QUANTITY_UNIT,
            ))

        return StockTransferSchema(transfers=rows, unit=QUANTITY_UNIT)

    # ── Reference data ────────────────────────────────────────────────────────

    def get_materials(self, plant_ids: Optional[list[str]] = None) -> list[MaterialSchema]:
        """Distinct materials for the filter dropdown.
        If plant_ids is provided, only materials at those plants are returned,
        and closing_stock_mt is the sum of EB rows at those plants.
        """
        raw = self._ledger.get_unique_materials(plant_ids=plant_ids or None)

        # Compute per-material closing stock (CA + EB rows at the plant scope)
        eb_movements = self._ledger.get_movements(
            obj_type="CA",
            category="EB",
            plant_ids=plant_ids if plant_ids else None,
        )
        closing_by_material: dict[str, float] = {}
        for m in eb_movements:
            closing_by_material[m.material_id] = (
                closing_by_material.get(m.material_id, 0.0) + m.quantity
            )

        # Option B flag: material is "ever stocked" at these plants if it has
        # ever had an opening balance (AB) or receipt (ZU) with qty > 0.
        # Zero-EB materials without this history are not real stockouts.
        history_movements = self._ledger.get_movements(
            obj_type="CA",
            plant_ids=plant_ids if plant_ids else None,
        )
        ever_stocked_ids: set[str] = {
            m.material_id
            for m in history_movements
            if m.category in ("AB", "ZU") and m.quantity > 0
        }

        return [
            MaterialSchema(
                material_id=str(r.get("material_id", "")),
                material_description=_normalize_material_desc(str(r.get("material_description", ""))),
                closing_stock_mt=round(closing_by_material.get(str(r.get("material_id", "")), 0.0), 3),
                ever_stocked=str(r.get("material_id", "")) in ever_stocked_ids,
            )
            for r in raw
        ]

    def get_inventory_report(
        self,
        material_ids: Optional[list[str]] = None,
        plant_ids:    Optional[list[str]] = None,
    ) -> InventoryReportSchema:
        """
        Per-material, per-plant breakdown matching the CSV report structure.

        Columns per plant row:
          on_hand_mt                — Inventory with in-transit (CA+EB closing stock)
          transit_out_mt            — Transit OUT (BV+VN+Stock Transfer at factory plants)
          transit_in_mt             — Transit IN  (BV+ZU+Stock Transfer at depot plants)
          net_transit_mt            — transit_out − transit_in (negative = net inflow)
          inventory_without_transit — on_hand + transit_in − transit_out
        """
        all_movements = self._ledger.get_movements(
            plant_ids=plant_ids if plant_ids else None,
        )
        all_plants    = self._plants.get_all_plants()
        plant_masters = {p.plant_id: p for p in all_plants}

        # Identify factory plants (have Production-type ZU receipts)
        factory_ids: set[str] = set()
        for m in all_movements:
            if m.category == "ZU" and m.proc_cat_name == "Production":
                factory_ids.add(m.plant_id)

        # Filter movements to requested materials
        if material_ids:
            material_set = set(str(mid) for mid in material_ids)
            movements = [m for m in all_movements if str(m.material_id) in material_set]
        else:
            movements = all_movements

        # Collect all unique materials in scope, preserving first-seen description
        materials_meta: dict[str, str] = {}
        for m in movements:
            mid = str(m.material_id)
            if mid not in materials_meta:
                materials_meta[mid] = m.material_description

        # Per (material_id, plant_id) buckets
        on_hand:     dict[tuple[str, str], float] = {}
        transit_out: dict[tuple[str, str], float] = {}
        transit_in:  dict[tuple[str, str], float] = {}

        for m in movements:
            mid = str(m.material_id)
            pid = m.plant_id
            key = (mid, pid)

            if m.obj_type == "CA" and m.category == "EB":
                on_hand[key] = on_hand.get(key, 0.0) + m.quantity

            if (m.obj_type == "BV" and m.category == "VN"
                    and m.proc_cat_name == "Stock Transfer"
                    and pid in factory_ids and m.quantity > 0):
                transit_out[key] = transit_out.get(key, 0.0) + m.quantity

            if (m.obj_type == "BV" and m.category == "ZU"
                    and m.proc_cat_name == "Stock Transfer"
                    and pid not in factory_ids and m.quantity > 0):
                transit_in[key] = transit_in.get(key, 0.0) + m.quantity

        # All plant IDs in order — use plant master list so every plant appears
        plant_order = [p.plant_id for p in all_plants]

        report_cards: list[MaterialReportCard] = []
        for mid, mdesc in sorted(materials_meta.items()):
            plant_rows: list[PlantReportRow] = []
            for pid in plant_order:
                key  = (mid, pid)
                oh   = round(on_hand.get(key, 0.0), 3)
                tout = round(transit_out.get(key, 0.0), 3)
                tin  = round(transit_in.get(key, 0.0), 3)
                net  = round(tout - tin, 3)
                wo   = round(oh + tin - tout, 3)
                pm   = plant_masters.get(pid)
                plant_rows.append(PlantReportRow(
                    plant_id=pid,
                    plant_name=pm.name if pm else f"Plant {pid}",
                    city=pm.city if pm else None,
                    on_hand_mt=oh,
                    transit_out_mt=tout,
                    transit_in_mt=tin,
                    net_transit_mt=net,
                    inventory_without_transit=wo,
                ))

            report_cards.append(MaterialReportCard(
                material_id=mid,
                material_description=mdesc,
                plants=plant_rows,
                total_on_hand=round(sum(r.on_hand_mt for r in plant_rows), 3),
                total_transit_out=round(sum(r.transit_out_mt for r in plant_rows), 3),
                total_transit_in=round(sum(r.transit_in_mt for r in plant_rows), 3),
                total_inventory_without_transit=round(
                    sum(r.inventory_without_transit for r in plant_rows), 3
                ),
            ))

        return InventoryReportSchema(materials=report_cards, unit=QUANTITY_UNIT)

    def get_location_summary(
        self,
        brand_groups: list[dict],
        material_brand_map: dict[str, Optional[str]],
        include_bags: bool = True,
        include_bulk: bool = False,
        plant_ids: Optional[list[str]] = None,
        active_only: bool = False,
    ) -> LocationSummarySchema:
        """
        Brand × Plant aggregation grid — one row per individual plant (no more
        merged multi-plant "location" grouping; see git history pre-2026-07 for
        that version, which hid 7 plants that weren't in the old mapping).

        brand_groups: DB-backed list of {"id", "label"} — the admin-managed
        source of truth (see api/v1/admin.py brand-groups endpoints), replacing
        the old hardcoded _BRAND_GROUPS list so admin-added groups appear here.
        material_brand_map: material_id -> brand_group id, read from the DB
        Material.brand_group field (admin-editable) instead of re-deriving it
        from the description via _classify_brand() on every request — this way
        an admin's manual brand_group edit in the Materials tab is reflected
        here immediately.
        plant_ids: restrict to this subset of plants; None/empty means all.
        active_only: exclude materials with zero stock, dispatch, and transit
        across the (plant- and material-type-filtered) dataset entirely, rather
        than just zeroing out their cells.

        Stock    = CA/EB closing balance rows
        Dispatch = BV/VN Sales Order rows (period total)
        Transit  = BV/ZU Stock Transfer rows (incoming)
        Inventory Days = stock / avg_daily_dispatch — only when CSV has date column.
        """
        from backend.repositories.csv.csv_base import csv_cache

        plant_filter = plant_ids if plant_ids else None

        # ── Date detection ──────────────────────────────────────────────────────
        raw_df = csv_cache.get("material_ledger")
        date_col_candidates = ["Posting Date", "Document Date", "Date", "posting_date", "date"]
        date_col = next((c for c in date_col_candidates if raw_df is not None and c in raw_df.columns), None)
        has_date_data = date_col is not None

        plant_masters = {p.plant_id: p for p in self._plants.get_all_plants()}

        def _should_include(desc: str) -> bool:
            if include_bags and include_bulk:
                return True
            if include_bags:
                return _material_is_bag(desc)
            if include_bulk:
                return _material_is_bulk(desc)
            return False

        def _relevant(m) -> bool:
            return bool(material_brand_map.get(m.material_id)) and _should_include(m.material_description)

        eb_movements = [
            m for m in self._ledger.get_movements(obj_type="CA", category="EB", plant_ids=plant_filter)
            if _relevant(m)
        ]
        vn_movements = [
            m for m in self._ledger.get_movements(obj_type="BV", category="VN", plant_ids=plant_filter)
            if m.proc_cat_name == "Sales Order" and _relevant(m)
        ]
        zu_movements = [
            m for m in self._ledger.get_movements(obj_type="BV", category="ZU", plant_ids=plant_filter)
            if m.proc_cat_name == "Stock Transfer" and _relevant(m)
        ]

        # ── Active-material filter — computed on the plant/material-type-filtered
        # universe above, then applied to exclude those materials entirely ──────
        if active_only:
            active_material_ids: set[str] = set()
            for m in eb_movements + vn_movements + zu_movements:
                if m.quantity != 0:
                    active_material_ids.add(m.material_id)
            eb_movements = [m for m in eb_movements if m.material_id in active_material_ids]
            vn_movements = [m for m in vn_movements if m.material_id in active_material_ids]
            zu_movements = [m for m in zu_movements if m.material_id in active_material_ids]

        stock_acc:    dict[tuple, float] = {}
        dispatch_acc: dict[tuple, float] = {}
        transit_acc:  dict[tuple, float] = {}

        def _add(acc: dict, pid: str, brand_id: str, qty: float) -> None:
            k = (pid, brand_id)
            acc[k] = acc.get(k, 0.0) + qty

        plant_ids_seen: set[str] = set()
        for m in eb_movements:
            _add(stock_acc, m.plant_id, material_brand_map[m.material_id], m.quantity)
            plant_ids_seen.add(m.plant_id)
        for m in vn_movements:
            _add(dispatch_acc, m.plant_id, material_brand_map[m.material_id], m.quantity)
            plant_ids_seen.add(m.plant_id)
        for m in zu_movements:
            _add(transit_acc, m.plant_id, material_brand_map[m.material_id], m.quantity)
            plant_ids_seen.add(m.plant_id)

        # ── Date-based inventory days ────────────────────────────────────────────
        # Placeholder: when has_date_data is True we can compute per-day dispatch
        # averages and derive inventory_days = stock / avg_daily_dispatch.
        # Currently has_date_data is always False with the standard SAP CSV export.
        daily_dispatch_map: Optional[dict] = None
        if has_date_data and date_col:
            pass  # future: parse date_col, group dispatch by date, compute avg

        def _inv_days(pid: str) -> Optional[float]:
            if not has_date_data or daily_dispatch_map is None:
                return None
            total_daily = sum(
                daily_dispatch_map.get((pid, bid), 0.0)
                for bid in [b["id"] for b in brand_groups]
            )
            if total_daily <= 0:
                return None
            total_stock = sum(
                stock_acc.get((pid, bid), 0.0)
                for bid in [b["id"] for b in brand_groups]
            )
            return round(total_stock / total_daily, 1)

        # ── Assemble plant rows ──────────────────────────────────────────────────
        brand_ids = [b["id"] for b in brand_groups]
        rows: list[LocationSummaryRow] = []
        brands_with_data: set[str] = set()

        for pid in sorted(plant_ids_seen):
            pm = plant_masters.get(pid)
            brands: dict[str, BrandGroupStockSchema] = {}
            tot_stock = 0.0
            tot_disp  = 0.0

            for bid in brand_ids:
                s = round(stock_acc.get((pid, bid), 0.0), 3)
                d = round(dispatch_acc.get((pid, bid), 0.0), 3)
                t = round(transit_acc.get((pid, bid), 0.0), 3)
                brands[bid] = BrandGroupStockSchema(stock=s, dispatch=d, transit_in=t)
                if s != 0 or d != 0:
                    brands_with_data.add(bid)
                tot_stock += s
                tot_disp  += d

            # Skip plants with no stock and no dispatch in this CSV
            if tot_stock == 0 and tot_disp == 0:
                continue

            rows.append(LocationSummaryRow(
                plant_id=pid,
                plant_name=pm.name if pm else f"Plant {pid}",
                city=pm.city if pm else None,
                brands=brands,
                total_stock=round(tot_stock, 3),
                total_dispatch=round(tot_disp, 3),
                inventory_days=_inv_days(pid),
            ))

        # ── Totals row ───────────────────────────────────────────────────────────
        total_brands: dict[str, BrandGroupStockSchema] = {}
        for bid in brand_ids:
            total_brands[bid] = BrandGroupStockSchema(
                stock=round(sum(stock_acc.get((pid, bid), 0.0) for pid in plant_ids_seen), 3),
                dispatch=round(sum(dispatch_acc.get((pid, bid), 0.0) for pid in plant_ids_seen), 3),
                transit_in=round(sum(transit_acc.get((pid, bid), 0.0) for pid in plant_ids_seen), 3),
            )
        totals_row = LocationSummaryRow(
            plant_id="__total__",
            plant_name="Total",
            brands=total_brands,
            total_stock=round(sum(r.total_stock for r in rows), 3),
            total_dispatch=round(sum(r.total_dispatch for r in rows), 3),
            inventory_days=None,
        )

        brand_group_meta = [
            BrandGroupMetaSchema(id=b["id"], label=b["label"], has_data=b["id"] in brands_with_data)
            for b in brand_groups
        ]

        return LocationSummarySchema(
            locations=rows,
            totals=totals_row,
            brand_groups=brand_group_meta,
            has_date_data=has_date_data,
            unit=QUANTITY_UNIT,
        )

    def get_plants(self) -> list[PlantSchema]:
        """All plants from the plant master, enriched with GPS for the map."""
        all_plants = self._plants.get_all_plants()
        ledger_plant_ids = set(self._ledger.get_unique_plants())

        return [
            PlantSchema(
                plant_id=p.plant_id,
                name=p.name,
                city=p.city,
                address=p.address,
                country=p.country,
                postal_code=p.postal_code,
                customer_number=p.customer_number,
                latitude=p.latitude,
                longitude=p.longitude,
                has_ledger_data=p.plant_id in ledger_plant_ids,
            )
            for p in all_plants
        ]
