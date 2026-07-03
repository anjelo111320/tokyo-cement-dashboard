from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db.models.plant import Plant


async def get_all(db: AsyncSession, active_only: bool = False) -> list[Plant]:
    q = select(Plant).order_by(Plant.plant_id)
    if active_only:
        q = q.where(Plant.is_active == True)  # noqa: E712
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, plant_id: str) -> Optional[Plant]:
    result = await db.execute(select(Plant).where(Plant.plant_id == plant_id))
    return result.scalar_one_or_none()


async def upsert(db: AsyncSession, **kwargs) -> Plant:
    plant_id = kwargs["plant_id"]
    existing = await get_by_id(db, plant_id)
    if existing:
        for k, v in kwargs.items():
            if k != "plant_id":
                setattr(existing, k, v)
        await db.commit()
        await db.refresh(existing)
        return existing
    plant = Plant(**kwargs)
    db.add(plant)
    await db.commit()
    await db.refresh(plant)
    return plant


async def update(db: AsyncSession, plant: Plant, **kwargs) -> Plant:
    for k, v in kwargs.items():
        setattr(plant, k, v)
    await db.commit()
    await db.refresh(plant)
    return plant
