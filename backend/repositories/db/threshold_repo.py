import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db.models.material_threshold import MaterialThreshold


async def get_all(db: AsyncSession) -> list[MaterialThreshold]:
    result = await db.execute(select(MaterialThreshold).order_by(MaterialThreshold.material_id))
    return list(result.scalars().all())


async def get_by_material(db: AsyncSession, material_id: str) -> Optional[MaterialThreshold]:
    result = await db.execute(select(MaterialThreshold).where(MaterialThreshold.material_id == material_id))
    return result.scalar_one_or_none()


async def upsert(db: AsyncSession, material_id: str, threshold_mt: float, updated_by: Optional[uuid.UUID] = None) -> MaterialThreshold:
    existing = await get_by_material(db, material_id)
    if existing:
        existing.threshold_mt = threshold_mt
        existing.updated_by = updated_by
        await db.commit()
        await db.refresh(existing)
        return existing
    t = MaterialThreshold(material_id=material_id, threshold_mt=threshold_mt, updated_by=updated_by)
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return t


async def delete(db: AsyncSession, material_id: str) -> bool:
    existing = await get_by_material(db, material_id)
    if not existing:
        return False
    await db.delete(existing)
    await db.commit()
    return True


async def as_dict(db: AsyncSession) -> dict[str, float]:
    rows = await get_all(db)
    return {r.material_id: float(r.threshold_mt) for r in rows}
