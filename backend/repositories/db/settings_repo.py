import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db.models.sharepoint_config import SharePointConfig

# ── SharePoint config ─────────────────────────────────────────────────────────

async def get_sharepoint_config(db: AsyncSession) -> Optional[SharePointConfig]:
    result = await db.execute(select(SharePointConfig).where(SharePointConfig.is_active == True).limit(1))  # noqa: E712
    return result.scalar_one_or_none()


async def upsert_sharepoint_config(db: AsyncSession, updated_by: Optional[uuid.UUID] = None, **kwargs) -> SharePointConfig:
    existing = await get_sharepoint_config(db)
    if not existing:
        # Also check for any inactive row to update
        result = await db.execute(select(SharePointConfig).limit(1))
        existing = result.scalar_one_or_none()
    if existing:
        for k, v in kwargs.items():
            setattr(existing, k, v)
        existing.updated_by = updated_by
        await db.commit()
        await db.refresh(existing)
        return existing
    cfg = SharePointConfig(updated_by=updated_by, **kwargs)
    db.add(cfg)
    await db.commit()
    await db.refresh(cfg)
    return cfg
