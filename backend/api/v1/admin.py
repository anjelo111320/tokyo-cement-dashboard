from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import require_admin, get_current_user
from backend.db.database import get_db
from backend.db.models.user import User
from backend.repositories.db import user_repo, plant_repo, settings_repo, threshold_repo
from backend.auth.password import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Plants ────────────────────────────────────────────────────────────────────

class PlantCreate(BaseModel):
    plant_id: str
    name: str
    city: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    plant_type: str = "depot"
    is_active: bool = True


class PlantUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    plant_type: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/plants")
async def list_plants(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    plants = await plant_repo.get_all(db)
    return {"success": True, "data": [
        {"plant_id": p.plant_id, "name": p.name, "city": p.city, "lat": float(p.lat) if p.lat else None,
         "lng": float(p.lng) if p.lng else None, "plant_type": p.plant_type, "is_active": p.is_active}
        for p in plants
    ]}


@router.post("/plants", status_code=status.HTTP_201_CREATED)
async def create_plant(body: PlantCreate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    if await plant_repo.get_by_id(db, body.plant_id):
        raise HTTPException(status_code=409, detail="Plant ID already exists")
    from backend.db.models.plant import Plant as _P
    p = _P(**body.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return {"success": True, "data": {"plant_id": p.plant_id}}


@router.put("/plants/{plant_id}")
async def update_plant(plant_id: str, body: PlantUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    plant = await plant_repo.get_by_id(db, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    updates = body.model_dump(exclude_none=True)
    await plant_repo.update(db, plant, **updates)
    return {"success": True}


@router.delete("/plants/{plant_id}")
async def delete_plant(plant_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    plant = await plant_repo.get_by_id(db, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    await plant_repo.update(db, plant, is_active=False)
    return {"success": True}


# ── Materials ─────────────────────────────────────────────────────────────────

from backend.db.models.material import Material  # noqa: E402
from sqlalchemy import select  # noqa: E402


class MaterialCreate(BaseModel):
    material_id: str
    description: str
    brand_group: Optional[str] = None
    is_bag: bool = True
    is_bulk: bool = False
    is_active: bool = True


class MaterialUpdate(BaseModel):
    description: Optional[str] = None
    brand_group: Optional[str] = None
    is_bag: Optional[bool] = None
    is_bulk: Optional[bool] = None
    is_active: Optional[bool] = None


@router.get("/materials")
async def list_materials(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Material).order_by(Material.material_id))
    mats = result.scalars().all()
    return {"success": True, "data": [
        {"material_id": m.material_id, "description": m.description,
         "brand_group": m.brand_group, "is_bag": m.is_bag, "is_bulk": m.is_bulk, "is_active": m.is_active}
        for m in mats
    ]}


@router.post("/materials", status_code=status.HTTP_201_CREATED)
async def create_material(body: MaterialCreate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    existing = await db.execute(select(Material).where(Material.material_id == body.material_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Material ID already exists")
    mat = Material(**body.model_dump())
    db.add(mat)
    await db.commit()
    return {"success": True}


@router.put("/materials/{material_id}")
async def update_material(material_id: str, body: MaterialUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(select(Material).where(Material.material_id == material_id))
    mat = result.scalar_one_or_none()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(mat, k, v)
    await db.commit()
    return {"success": True}


@router.delete("/materials/{material_id}")
async def delete_material(material_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(select(Material).where(Material.material_id == material_id))
    mat = result.scalar_one_or_none()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")
    mat.is_active = False
    await db.commit()
    return {"success": True}


@router.post("/materials/sync")
async def sync_materials(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    """Re-import distinct materials from the current in-memory CSV cache."""
    from backend.repositories.csv.csv_base import csv_cache
    from backend.core.material_ledger_config import COLUMN_MAP
    from backend.services.material_ledger_service import _classify_brand, _material_is_bulk

    df = csv_cache.get("material_ledger")
    if df is None:
        raise HTTPException(status_code=503, detail="CSV not loaded")

    mat_col = COLUMN_MAP.get("material_id", "Material")
    desc_col = COLUMN_MAP.get("material_description", "Material Description")
    if mat_col not in df.columns or desc_col not in df.columns:
        raise HTTPException(status_code=503, detail="CSV missing material columns")

    pairs = df[[mat_col, desc_col]].drop_duplicates().dropna()
    count = 0
    for _, row in pairs.iterrows():
        mat_id = str(row[mat_col]).strip()
        desc   = str(row[desc_col]).strip()
        result = await db.execute(select(Material).where(Material.material_id == mat_id))
        existing = result.scalar_one_or_none()
        if not existing:
            db.add(Material(
                material_id=mat_id,
                description=desc,
                brand_group=_classify_brand(desc),
                is_bag=not _material_is_bulk(desc),
                is_bulk=_material_is_bulk(desc),
            ))
            count += 1
    await db.commit()
    return {"success": True, "data": {"imported": count}}


# ── App settings ──────────────────────────────────────────────────────────────

class SettingUpdate(BaseModel):
    value: str


@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    rows = await settings_repo.get_all_settings(db)
    return {"success": True, "data": [
        {"key": r.key, "value": r.value, "value_type": r.value_type, "description": r.description}
        for r in rows
    ]}


@router.put("/settings/{key}")
async def update_setting(key: str, body: SettingUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_admin)):
    await settings_repo.set_setting(db, key, body.value, updated_by=user.id)
    return {"success": True}


# ── Thresholds ────────────────────────────────────────────────────────────────

class ThresholdUpsert(BaseModel):
    threshold_mt: float


@router.get("/thresholds")
async def get_thresholds(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    rows = await threshold_repo.get_all(db)
    return {"success": True, "data": [
        {"material_id": r.material_id, "threshold_mt": float(r.threshold_mt)}
        for r in rows
    ]}


@router.put("/thresholds/{material_id}")
async def upsert_threshold(material_id: str, body: ThresholdUpsert, db: AsyncSession = Depends(get_db), user: User = Depends(require_admin)):
    await threshold_repo.upsert(db, material_id, body.threshold_mt, updated_by=user.id)
    return {"success": True}


@router.delete("/thresholds/{material_id}")
async def delete_threshold(material_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    deleted = await threshold_repo.delete(db, material_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Threshold not found")
    return {"success": True}


# ── Users ─────────────────────────────────────────────────────────────────────

class CreateUser(BaseModel):
    email: str
    password: str
    role: str = "viewer"


class UpdateUser(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    users = await user_repo.get_all(db)
    return {"success": True, "data": [
        {"id": str(u.id), "email": u.email, "role": u.role, "is_active": u.is_active}
        for u in users
    ]}


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(body: CreateUser, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    existing = await user_repo.get_by_email(db, body.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = await user_repo.create(db, body.email, hash_password(body.password), body.role)
    return {"success": True, "data": {"id": str(user.id), "email": user.email, "role": user.role}}


@router.put("/users/{user_id}")
async def update_user(user_id: str, body: UpdateUser, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    import uuid
    user = await user_repo.get_by_id(db, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updates = body.model_dump(exclude_none=True)
    await user_repo.update(db, user, **updates)
    return {"success": True}


# ── SharePoint config ─────────────────────────────────────────────────────────

class SharePointUpdate(BaseModel):
    tenant_id: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    site_url: Optional[str] = None
    drive_id: Optional[str] = None
    file_path: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/sharepoint")
async def get_sharepoint(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    cfg = await settings_repo.get_sharepoint_config(db)
    if not cfg:
        return {"success": True, "data": None}
    return {"success": True, "data": {
        "tenant_id": cfg.tenant_id,
        "client_id": cfg.client_id,
        "client_secret": "***" if cfg.client_secret else None,
        "site_url": cfg.site_url,
        "drive_id": cfg.drive_id,
        "file_path": cfg.file_path,
        "is_active": cfg.is_active,
    }}


@router.put("/sharepoint")
async def update_sharepoint(body: SharePointUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_admin)):
    updates = body.model_dump(exclude_none=True)
    await settings_repo.upsert_sharepoint_config(db, updated_by=user.id, **updates)
    return {"success": True}


@router.post("/sharepoint/test")
async def test_sharepoint(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    from backend.services.sharepoint_service import SharePointService
    cfg = await settings_repo.get_sharepoint_config(db)
    if not cfg:
        raise HTTPException(status_code=404, detail="No SharePoint config found")
    svc = SharePointService()
    try:
        await svc.test_connection(cfg)
        return {"success": True, "data": {"message": "Connection successful"}}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── Ingestion log ─────────────────────────────────────────────────────────────

@router.get("/ingestion-log")
async def get_ingestion_log(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    logs = await settings_repo.get_recent_logs(db)
    return {"success": True, "data": [
        {"id": str(l.id), "source": l.source, "file_name": l.file_name,
         "status": l.status, "rows_loaded": l.rows_loaded,
         "error_msg": l.error_msg, "created_at": l.created_at.isoformat()}
        for l in logs
    ]}
