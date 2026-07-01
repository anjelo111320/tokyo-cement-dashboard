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

from typing import Optional
from backend.repositories.csv.material_ledger_csv_repo import (
    MaterialLedgerCsvRepository,
    PlantMasterCsvRepository,
)
from backend.core.material_ledger_config import (
    CATEGORY_CONFIG,
    OBJ_TYPE_CONFIG,
    PROC_CAT_LABELS,
    QUANTITY_UNIT,
    CLOSING_CATEGORY,
    OPENING_CATEGORY,
    INFLOW_CATEGORIES,
    OUTFLOW_CATEGORIES,
)
from backend.schemas.material_ledger import (
    MovementRowSchema,
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
)
from backend.core.material_ledger_config import MATERIAL_THRESHOLDS as _thresholds_store


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

        rows: list[PlantInventoryRow] = []
        alert_count = 0
        for pid in sorted(all_pids):
            pm = plant_masters.get(pid)
            oh = round(on_hand.get(pid, 0.0), 3)
            ito = round(in_transit_out.get(pid, 0.0), 3)
            iti = round(in_transit_in.get(pid, 0.0), 3)

            # Determine status from threshold (use lowest threshold across materials)
            threshold = self._lowest_threshold_for_plant(pid, movements)
            if threshold > 0:
                if oh == 0:
                    status = "out"
                    alert_count += 1
                elif oh < threshold:
                    status = "low"
                    alert_count += 1
                else:
                    status = "ok"
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
            ))

        # Sort: alerts first, then by on-hand desc
        rows.sort(key=lambda r: (r.status == "ok", -r.on_hand_mt))

        return InventorySummarySchema(
            rows=rows,
            total_on_hand_mt=round(sum(on_hand.values()), 3),
            total_in_transit_out=round(sum(in_transit_out.values()), 3),
            total_in_transit_in=round(sum(in_transit_in.values()), 3),
            alert_count=alert_count,
            unit=QUANTITY_UNIT,
        )

    def _lowest_threshold_for_plant(
        self,
        plant_id: str,
        movements: list,
    ) -> float:
        """Returns the relevant threshold for the materials seen at this plant."""
        thresholds = [
            _thresholds_store.get(str(m.material_id), 0.0)
            for m in movements
            if m.plant_id == plant_id and m.obj_type == "CA" and m.category == "EB"
        ]
        return max(thresholds) if thresholds else 0.0

    def get_inventory_alerts(
        self,
        material_ids: Optional[list[str]] = None,
    ) -> InventoryAlertsSchema:
        """Returns all plants where on-hand stock is below the configured threshold."""
        movements = self._ledger.get_movements(obj_type="CA", category="EB")
        plant_masters = {p.plant_id: p for p in self._plants.get_all_plants()}

        if material_ids:
            material_set = set(str(mid) for mid in material_ids)
            movements = [m for m in movements if str(m.material_id) in material_set]

        alerts: list[InventoryAlertRow] = []
        seen: set[tuple[str, str]] = set()

        for m in movements:
            threshold = _thresholds_store.get(str(m.material_id), 0.0)
            if threshold <= 0:
                continue
            if m.quantity >= threshold:
                continue
            key = (m.plant_id, str(m.material_id))
            if key in seen:
                continue
            seen.add(key)

            pct = round((m.quantity / threshold) * 100, 1) if threshold > 0 else 0.0
            status = "out" if m.quantity <= 0 else "low"
            pm = plant_masters.get(m.plant_id)

            alerts.append(InventoryAlertRow(
                plant_id=m.plant_id,
                plant_name=pm.name if pm else f"Plant {m.plant_id}",
                city=pm.city if pm else None,
                material_id=str(m.material_id),
                material_desc=m.material_description,
                on_hand_mt=round(m.quantity, 3),
                threshold_mt=threshold,
                pct=min(100.0, pct),
                status=status,
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
        eb_movements = self._ledger.get_movements(obj_type="CA", category="EB")
        closing_stock: dict[tuple[str, str], float] = {}
        for m in eb_movements:
            key = (m.plant_id, m.material_id)
            closing_stock[key] = closing_stock.get(key, 0.0) + m.quantity

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

            rows.append(StockTransferRow(
                source_plant_id=m.plant_id,
                source_plant_name=src.name if src else f"Plant {m.plant_id}",
                dest_plant_id=dest_id,
                dest_plant_name=dst.name if dst else f"Plant {dest_id}",
                material_id=m.material_id,
                material_description=m.material_description,
                quantity=round(m.quantity, 3),
                dest_closing_stock=dest_close,
                price_lkr=round(m.price, 2) if m.price is not None else None,
                unit=QUANTITY_UNIT,
            ))

        return StockTransferSchema(transfers=rows, unit=QUANTITY_UNIT)

    # ── Movement Table ────────────────────────────────────────────────────────

    def get_movements(
        self,
        plant_id: Optional[str] = None,
        material_id: Optional[str] = None,
        obj_type: Optional[str] = None,
        category: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[MovementRowSchema], int]:
        """
        Returns a paginated list of raw movement rows for the detail table.
        All category labels and obj_type labels come from config.
        """
        movements = self._ledger.get_movements(
            plant_id=plant_id,
            material_id=material_id,
            obj_type=obj_type,
            category=category,
        )
        total = len(movements)
        start = (page - 1) * page_size
        page_items = movements[start:start + page_size]

        return [
            MovementRowSchema(
                plant_id=m.plant_id,
                material_id=m.material_id,
                material_description=m.material_description,
                obj_type=m.obj_type,
                obj_type_label=OBJ_TYPE_CONFIG.get(m.obj_type, m.obj_type),
                category=m.category,
                category_label=CATEGORY_CONFIG.get(m.category, {}).get("label", m.category),
                category_color=CATEGORY_CONFIG.get(m.category, {}).get("color", "#9CA3AF"),
                movement_description=m.movement_description,
                proc_cat_name=m.proc_cat_name,
                proc_cat_label=PROC_CAT_LABELS.get(m.proc_cat_name or "", m.proc_cat_name or "—"),
                quantity=m.quantity,
                price=m.price,
                unit=QUANTITY_UNIT,
                extra_fields=m.extra_fields,
            )
            for m in page_items
        ], total

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

        return [
            MaterialSchema(
                material_id=str(r.get("material_id", "")),
                material_description=str(r.get("material_description", "")),
                closing_stock_mt=round(closing_by_material.get(str(r.get("material_id", "")), 0.0), 3),
            )
            for r in raw
        ]

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
