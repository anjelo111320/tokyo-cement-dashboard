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
    InventoryFlowSchema,
    CategoryFlowRow,
    SupplyChainSchema,
    SupplyChainNode,
    ConsumptionBreakdownSchema,
    ConsumptionCategory,
    MovementRowSchema,
    MaterialSchema,
    PlantSchema,
    LedgerKpiSchema,
    StockTransferRow,
    StockTransferSchema,
    PlantComparisonRow,
    PlantComparisonSchema,
)


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

    # ── Inventory Flow ────────────────────────────────────────────────────────

    def get_inventory_flow(
        self,
        plant_id: Optional[str] = None,
        material_id: Optional[str] = None,
    ) -> InventoryFlowSchema:
        """
        Returns the AB → ZU → KB → VN → EB flow for the waterfall chart.
        Categories are driven entirely by CATEGORY_CONFIG — adding a new
        category to the config means it appears here automatically.
        """
        movements = self._ledger.get_movements(
            plant_id=plant_id,
            material_id=material_id,
            obj_type="CA",   # Use accounting entries for the stock flow
        )

        # Group quantities and prices by category code.
        by_category: dict[str, float] = {}
        by_price: dict[str, float] = {}
        for m in movements:
            by_category[m.category] = by_category.get(m.category, 0.0) + m.quantity
            if m.price is not None:
                by_price[m.category] = by_price.get(m.category, 0.0) + m.price

        # Build the flow rows using config order — unknown categories are appended.
        known_cats = {
            code: cfg for code, cfg in sorted(
                CATEGORY_CONFIG.items(), key=lambda x: x[1]["order"]
            )
        }
        rows: list[CategoryFlowRow] = []
        for code, cfg in known_cats.items():
            qty = by_category.get(code, 0.0)
            price = by_price.get(code)
            rows.append(CategoryFlowRow(
                category_code=code,
                label=cfg["label"],
                quantity=round(qty, 3),
                total_price_lkr=round(price, 2) if price is not None else None,
                sign=cfg["sign"],
                color=cfg["color"],
                role=cfg["role"],
                unit=QUANTITY_UNIT,
            ))

        # Include any category in the data that is NOT in CATEGORY_CONFIG
        # (forward-compatible: if SAP adds a new code, it still appears).
        known_codes = set(CATEGORY_CONFIG.keys())
        for code, qty in by_category.items():
            if code not in known_codes:
                price = by_price.get(code)
                rows.append(CategoryFlowRow(
                    category_code=code,
                    label=code,  # Use the raw code as label until config is updated
                    quantity=round(qty, 3),
                    total_price_lkr=round(price, 2) if price is not None else None,
                    sign=+1,
                    color="#9CA3AF",
                    role="unknown",
                    unit=QUANTITY_UNIT,
                ))

        return InventoryFlowSchema(rows=rows, unit=QUANTITY_UNIT)

    # ── Consumption Breakdown ─────────────────────────────────────────────────

    def get_consumption_breakdown(
        self,
        plant_id: Optional[str] = None,
        material_id: Optional[str] = None,
    ) -> ConsumptionBreakdownSchema:
        """
        Breaks down VN (Consumption) by Proc Cat Name:
          Sales Order, Internal Consumption, Stock Transfer…

        Uses PROC_CAT_LABELS for display names — add new labels there,
        not here, for new procurement categories.
        """
        movements = self._ledger.get_movements(
            plant_id=plant_id,
            material_id=material_id,
            obj_type="BV",    # BV = actual physical movements
            category="VN",
        )

        by_proc: dict[str, float] = {}
        for m in movements:
            key = m.proc_cat_name or "Other"
            by_proc[key] = by_proc.get(key, 0.0) + m.quantity

        total_qty = sum(by_proc.values())
        categories = [
            ConsumptionCategory(
                proc_cat=raw,
                label=PROC_CAT_LABELS.get(raw, raw),
                quantity=round(qty, 3),
                pct=round(qty / total_qty * 100 if total_qty > 0 else 0, 1),
                unit=QUANTITY_UNIT,
            )
            for raw, qty in sorted(by_proc.items(), key=lambda x: -x[1])
        ]
        return ConsumptionBreakdownSchema(
            total_consumption_mt=round(total_qty, 3),
            categories=categories,
            unit=QUANTITY_UNIT,
        )

    # ── Supply Chain ──────────────────────────────────────────────────────────

    def get_supply_chain(
        self,
        material_id: Optional[str] = None,
    ) -> SupplyChainSchema:
        """
        Builds the factory → depot supply chain flow.
        Factory nodes = plants where ZU contains "Rest(Production)" (production output).
        Depot nodes = plants that receive stock via Stock Transfer.
        """
        # CA-only to avoid double-counting (BV and VM carry the same qty as CA).
        all_movements = self._ledger.get_movements(material_id=material_id, obj_type="CA")
        plant_masters = {p.plant_id: p for p in self._plants.get_all_plants()}

        # Identify factory plants: plants that have production-type receipts.
        factory_plant_ids: set[str] = set()
        for m in all_movements:
            if m.category == "ZU" and m.proc_cat_name == "Production":
                factory_plant_ids.add(m.plant_id)

        # Production total per factory (CA ZU rows only).
        factory_production: dict[str, float] = {}
        for m in all_movements:
            if m.plant_id in factory_plant_ids and m.category == "ZU":
                factory_production[m.plant_id] = (
                    factory_production.get(m.plant_id, 0.0) + m.quantity
                )

        # Transfer totals from factories to each depot.
        # In the data, factory VN "Transfer plant:XXXX" → depot ZU "Transfer plant:XXXX"
        depot_receipts: dict[str, float] = {}
        for m in all_movements:
            if m.plant_id not in factory_plant_ids and m.category == "ZU":
                depot_receipts[m.plant_id] = (
                    depot_receipts.get(m.plant_id, 0.0) + m.quantity
                )

        # Depot ending inventory.
        depot_ending: dict[str, float] = {}
        for m in all_movements:
            if m.plant_id not in factory_plant_ids and m.category == "EB":
                depot_ending[m.plant_id] = (
                    depot_ending.get(m.plant_id, 0.0) + m.quantity
                )

        # Build nodes.
        factory_nodes = [
            SupplyChainNode(
                plant_id=pid,
                name=plant_masters[pid].name if pid in plant_masters else f"Plant {pid}",
                node_type="factory",
                production_mt=round(factory_production.get(pid, 0.0), 2),
                receipts_mt=None,
                ending_stock_mt=None,
                city=plant_masters[pid].city if pid in plant_masters else None,
            )
            for pid in sorted(factory_plant_ids)
        ]

        depot_nodes = [
            SupplyChainNode(
                plant_id=pid,
                name=plant_masters[pid].name if pid in plant_masters else f"Plant {pid}",
                node_type="depot",
                production_mt=None,
                receipts_mt=round(depot_receipts.get(pid, 0.0), 2),
                ending_stock_mt=round(depot_ending.get(pid, 0.0), 2),
                city=plant_masters[pid].city if pid in plant_masters else None,
            )
            for pid in sorted(depot_receipts.keys())
        ]

        total_produced = sum(factory_production.values())
        total_transferred = sum(depot_receipts.values())

        return SupplyChainSchema(
            factories=factory_nodes,
            depots=depot_nodes,
            total_produced_mt=round(total_produced, 2),
            total_transferred_mt=round(total_transferred, 2),
            unit=QUANTITY_UNIT,
        )

    # ── Plant Comparison ──────────────────────────────────────────────────────

    def get_plant_comparison(
        self,
        material_id: Optional[str] = None,
    ) -> PlantComparisonSchema:
        """
        Returns one row per active plant with AB / ZU / VN / EB totals.
        CA obj_type only — avoids BV/VM double-counting.
        Active = any non-zero quantity in the filtered result.
        Sorted by closing stock descending so the busiest plant is at the top.
        """
        movements = self._ledger.get_movements(
            material_id=material_id,
            obj_type="CA",
        )
        plant_masters = {p.plant_id: p for p in self._plants.get_all_plants()}

        CATS = ("AB", "ZU", "VN", "EB")
        buckets: dict[str, dict[str, float]] = {}
        for m in movements:
            if m.plant_id not in buckets:
                buckets[m.plant_id] = {c: 0.0 for c in CATS}
            if m.category in CATS:
                buckets[m.plant_id][m.category] += m.quantity

        rows: list[PlantComparisonRow] = []
        for pid, cats in buckets.items():
            if all(v == 0.0 for v in cats.values()):
                continue                         # skip zero-activity plants
            pm = plant_masters.get(pid)
            rows.append(PlantComparisonRow(
                plant_id=pid,
                plant_name=pm.name if pm else f"Plant {pid}",
                city=pm.city if pm else None,
                opening_mt=round(cats["AB"], 3),
                receipts_mt=round(cats["ZU"], 3),
                consumption_mt=round(cats["VN"], 3),
                closing_mt=round(cats["EB"], 3),
            ))

        rows.sort(key=lambda r: r.closing_mt, reverse=True)
        return PlantComparisonSchema(plants=rows, unit=QUANTITY_UNIT)

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

        The source plant is the plant_id of the row itself.
        Plant names are resolved from the plant master CSV.
        """
        movements = self._ledger.get_movements(
            plant_id=plant_id,
            material_id=material_id,
            obj_type="VM",
            category="VN",
        )
        plant_masters = {p.plant_id: p for p in self._plants.get_all_plants()}

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

            rows.append(StockTransferRow(
                source_plant_id=m.plant_id,
                source_plant_name=src.name if src else f"Plant {m.plant_id}",
                dest_plant_id=dest_id,
                dest_plant_name=dst.name if dst else f"Plant {dest_id}",
                quantity=round(m.quantity, 3),
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

    def get_materials(self) -> list[MaterialSchema]:
        """Distinct materials available for the filter dropdown."""
        raw = self._ledger.get_unique_materials()
        return [
            MaterialSchema(
                material_id=str(r.get("material_id", "")),
                material_description=str(r.get("material_description", "")),
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
