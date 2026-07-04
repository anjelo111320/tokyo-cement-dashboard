"""
seed_reference.py — Populate the plants + materials tables from the CSV.

The admin panel reads plants/materials from the DATABASE, not the CSV. On a
fresh database (e.g. a new Render Postgres) those tables are empty, so the
admin panel shows nothing even though the dashboard (which reads the CSV) works.

This script runs on every container start (from start.sh) and INSERTS ONLY
MISSING rows — it never overwrites existing rows, so admin edits (renamed
plants, hidden materials, changed cities) are preserved across restarts.
New plants/materials that appear in the CSV are picked up automatically.

Idempotent + safe to run every boot.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import select

from backend.core.config import settings
from backend.db.database import init_engine, get_db
from backend.db.models.material import Material
from backend.repositories.csv.csv_base import csv_cache
from backend.repositories.csv.material_ledger_csv_repo import PlantMasterCsvRepository
from backend.repositories.db import plant_repo

# Plant type classification (mirrors seed_plants.py / frontend mapIcons.ts)
_FACTORY_IDS  = {"2140", "2141", "2145", "2146"}
_TERMINAL_IDS = {"2122", "2123", "2124", "2127"}
_HQ_IDS       = {"2100", "2126", "2129", "2131"}


def _plant_type(plant_id: str) -> str:
    if plant_id in _FACTORY_IDS:
        return "factory"
    if plant_id in _TERMINAL_IDS:
        return "terminal"
    if plant_id in _HQ_IDS:
        return "hq"
    return "depot"


async def _seed_plants(db, flag_as_new: bool) -> int:
    """flag_as_new: mark inserted rows is_new=True so the admin panel highlights
    them. False on a cold/bulk seed (empty table) — that's a baseline import,
    not an individual discovery worth flagging."""
    repo = PlantMasterCsvRepository()
    inserted = 0
    for p in repo.get_all_plants():
        if await plant_repo.get_by_id(db, p.plant_id):
            continue  # preserve existing (possibly admin-edited) row
        await plant_repo.upsert(
            db,
            plant_id=p.plant_id,
            name=p.name,
            city=p.city,
            address=p.address,
            country=p.country,
            postal_code=p.postal_code,
            customer_number=p.customer_number,
            lat=p.latitude,
            lng=p.longitude,
            plant_type=_plant_type(p.plant_id),
            is_new=flag_as_new,
        )
        inserted += 1
    return inserted


async def _seed_materials(db, flag_as_new: bool) -> int:
    from backend.core.material_ledger_config import COLUMN_MAP
    from backend.services.material_ledger_service import _classify_brand, _material_is_bulk

    df = csv_cache.get("material_ledger")
    if df is None or df.empty:
        return 0

    mat_col = COLUMN_MAP.get("material_id", "Material")
    desc_col = COLUMN_MAP.get("material_description", "Material Description")
    if mat_col not in df.columns or desc_col not in df.columns:
        return 0

    pairs = df[[mat_col, desc_col]].drop_duplicates().dropna()
    inserted = 0
    for _, row in pairs.iterrows():
        mat_id = str(row[mat_col]).strip()
        desc   = str(row[desc_col]).strip()
        existing = (await db.execute(
            select(Material).where(Material.material_id == mat_id)
        )).scalar_one_or_none()
        if existing:
            continue  # preserve existing (possibly admin-edited) row
        db.add(Material(
            material_id=mat_id,
            description=desc,
            brand_group=_classify_brand(desc),
            is_bag=not _material_is_bulk(desc),
            is_bulk=_material_is_bulk(desc),
            is_new=flag_as_new,
        ))
        inserted += 1
    await db.commit()
    return inserted


async def _run() -> None:
    if not settings.database_url:
        print("[seed_reference] DATABASE_URL not set — skipping seed.")
        return

    init_engine(settings.database_url)
    csv_cache.load_all()

    async for db in get_db():
        # Distinguish "cold start / just wiped" (table empty → this is a bulk
        # baseline import, don't flag any of it) from "already-established
        # system, CSV now has an ID we've never seen" (flag it — genuinely new).
        had_plants = bool(await plant_repo.get_all(db))
        had_materials = (await db.execute(select(Material.material_id).limit(1))).first() is not None

        plants = await _seed_plants(db, flag_as_new=had_plants)
        materials = await _seed_materials(db, flag_as_new=had_materials)
        print(f"[seed_reference] Inserted {plants} new plants, {materials} new materials "
              f"(existing rows left untouched).")
        return


if __name__ == "__main__":
    asyncio.run(_run())
