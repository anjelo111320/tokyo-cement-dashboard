"""
Seed the plants table from plant_names.csv.
Run once after alembic upgrade head:
  python -m backend.scripts.seed_plants
"""
import asyncio
import sys
import os

# Allow running from the repo root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.config import settings
from backend.db.database import init_engine, get_db
from backend.repositories.csv.material_ledger_csv_repo import PlantMasterCsvRepository
from backend.repositories.csv.csv_base import csv_cache
from backend.repositories.db import plant_repo

# Plant type classification (mirrors frontend mapIcons.ts)
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


async def main():
    db_url = settings.database_url
    if not db_url:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)

    init_engine(db_url)
    csv_cache.load_all()

    repo = PlantMasterCsvRepository()
    plants = repo.get_all_plants()

    async for db in get_db():
        count = 0
        for p in plants:
            lat = p.latitude
            lng = p.longitude
            await plant_repo.upsert(
                db,
                plant_id=p.plant_id,
                name=p.name,
                city=p.city,
                address=p.address,
                country=p.country,
                postal_code=p.postal_code,
                customer_number=p.customer_number,
                lat=lat,
                lng=lng,
                plant_type=_plant_type(p.plant_id),
            )
            count += 1
        print(f"Seeded {count} plants.")


if __name__ == "__main__":
    asyncio.run(main())
