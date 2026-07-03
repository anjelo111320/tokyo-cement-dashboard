import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db.models.app_setting import AppSetting
from backend.db.models.sharepoint_config import SharePointConfig
from backend.db.models.ingestion_log import IngestionLog

# ── App settings ─────────────────────────────────────────────────────────────

DEFAULT_SETTINGS: dict[str, tuple[str, str, str]] = {
    # key: (default_value, value_type, description)
    "csv_refresh_interval_seconds": ("900",   "int",    "How often (seconds) to reload CSV"),
    "allowed_origins":              ("",       "json",   "CORS origins as JSON array"),
    "low_stock_mode":               ("accurate", "string", "accurate | active_only"),
    "bag_weight_kg":                ("50",     "float",  "kg per cement bag"),
    "quantity_unit":                ("MT",     "string", "Display unit for quantities"),
}


async def seed_defaults(db: AsyncSession) -> None:
    for key, (value, vtype, desc) in DEFAULT_SETTINGS.items():
        existing = await get_setting(db, key)
        if not existing:
            db.add(AppSetting(key=key, value=value, value_type=vtype, description=desc))
    await db.commit()


async def get_setting(db: AsyncSession, key: str) -> Optional[AppSetting]:
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    return result.scalar_one_or_none()


async def get_all_settings(db: AsyncSession) -> list[AppSetting]:
    result = await db.execute(select(AppSetting).order_by(AppSetting.key))
    return list(result.scalars().all())


async def set_setting(db: AsyncSession, key: str, value: str, updated_by: Optional[uuid.UUID] = None) -> AppSetting:
    setting = await get_setting(db, key)
    if setting:
        setting.value = value
        setting.updated_by = updated_by
    else:
        setting = AppSetting(key=key, value=value, updated_by=updated_by)
        db.add(setting)
    await db.commit()
    await db.refresh(setting)
    return setting


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


# ── Ingestion log ─────────────────────────────────────────────────────────────

async def log_ingestion(
    db: AsyncSession,
    source: str,
    status: str,
    file_name: Optional[str] = None,
    rows_loaded: Optional[int] = None,
    error_msg: Optional[str] = None,
) -> IngestionLog:
    entry = IngestionLog(
        source=source,
        status=status,
        file_name=file_name,
        rows_loaded=rows_loaded,
        error_msg=error_msg,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def get_recent_logs(db: AsyncSession, limit: int = 50) -> list[IngestionLog]:
    result = await db.execute(
        select(IngestionLog).order_by(IngestionLog.created_at.desc()).limit(limit)
    )
    return list(result.scalars().all())
