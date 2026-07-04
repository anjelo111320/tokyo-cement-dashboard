import io
import re
import uuid as uuid_mod
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import require_admin, get_current_user
from backend.db.database import get_db
from backend.db.models.user import User
from backend.db.models.brand_group import BrandGroup
from backend.db.models.csv_dataset import CsvDataset
from backend.repositories.db import user_repo, plant_repo, settings_repo
from backend.auth.password import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])

# Canonical display order for plant groups — "sort by group" means this order,
# then alphabetical by name within each group. Any unexpected value sorts last.
_PLANT_TYPE_ORDER = {"factory": 0, "terminal": 1, "hq": 2, "depot": 3}


def _slugify(label: str) -> str:
    """'Holcim Cement' -> 'holcim_cement'. Used to derive a brand_group id from its label."""
    slug = re.sub(r'[^a-z0-9]+', '_', label.strip().lower()).strip('_')
    return slug or "group"


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
    is_new: Optional[bool] = None  # lets the frontend "Dismiss" action clear the highlight


@router.get("/plants")
async def list_plants(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    plants = await plant_repo.get_all(db)
    plants = sorted(plants, key=lambda p: (_PLANT_TYPE_ORDER.get(p.plant_type, 99), p.name))
    return {"success": True, "data": [
        {"plant_id": p.plant_id, "name": p.name, "city": p.city, "lat": float(p.lat) if p.lat else None,
         "lng": float(p.lng) if p.lng else None, "plant_type": p.plant_type, "is_active": p.is_active,
         "is_new": p.is_new}
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
    updates = body.model_dump(exclude_unset=True)
    # Any admin edit counts as acknowledging a "new" row, not just an explicit Dismiss.
    if updates and "is_new" not in updates:
        updates["is_new"] = False
    await plant_repo.update(db, plant, **updates)
    return {"success": True}


@router.delete("/plants/{plant_id}")
async def delete_plant(plant_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    plant = await plant_repo.get_by_id(db, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    await plant_repo.update(db, plant, is_active=False, is_new=False)
    return {"success": True}


# ── Materials ─────────────────────────────────────────────────────────────────

from backend.db.models.material import Material  # noqa: E402


async def _validate_brand_group(db: AsyncSession, brand_group: Optional[str]) -> None:
    if brand_group is None:
        return
    exists = await db.execute(select(BrandGroup).where(BrandGroup.id == brand_group))
    if not exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Unknown brand group: {brand_group}")


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
    is_new: Optional[bool] = None  # lets the frontend "Dismiss" action clear the highlight


def _dataset_material_ids() -> set[str]:
    """Distinct material IDs present in the ACTIVE dataset (uploaded or bundled).
    Drives the admin panel's not-in-dataset greying."""
    from backend.repositories.csv.csv_base import csv_cache  # noqa: PLC0415
    from backend.core.material_ledger_config import COLUMN_MAP  # noqa: PLC0415
    df = csv_cache.get("material_ledger")
    col = COLUMN_MAP.get("material_id", "Material")
    if df.empty or col not in df.columns:
        return set()
    return set(df[col].astype(str).str.strip())


@router.get("/materials")
async def list_materials(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Material).order_by(Material.material_id))
    mats = result.scalars().all()

    label_result = await db.execute(select(BrandGroup.id, BrandGroup.label))
    labels = dict(label_result.all())
    # Group first (by label A-Z), unassigned last, then description A-Z within group.
    mats = sorted(mats, key=lambda m: (
        m.brand_group is None,
        labels.get(m.brand_group, ""),
        m.description,
    ))

    in_dataset = _dataset_material_ids()

    return {"success": True, "data": [
        {"material_id": m.material_id, "description": m.description,
         "brand_group": m.brand_group, "is_bag": m.is_bag, "is_bulk": m.is_bulk, "is_active": m.is_active,
         "is_new": m.is_new, "in_dataset": m.material_id in in_dataset}
        for m in mats
    ]}


@router.post("/materials", status_code=status.HTTP_201_CREATED)
async def create_material(body: MaterialCreate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    existing = await db.execute(select(Material).where(Material.material_id == body.material_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Material ID already exists")
    await _validate_brand_group(db, body.brand_group)
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
    updates = body.model_dump(exclude_unset=True)
    if "brand_group" in updates:
        await _validate_brand_group(db, updates["brand_group"])
    # Any admin edit counts as acknowledging a "new" row, not just an explicit Dismiss.
    if updates and "is_new" not in updates:
        updates["is_new"] = False
    for k, v in updates.items():
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
    mat.is_new = False
    await db.commit()
    return {"success": True}


async def _import_new_materials_from_cache(db: AsyncSession) -> int:
    """Insert DB rows for material IDs present in the active dataset but not
    yet in the materials table, flagged is_new=True (yellow admin highlight).
    Existing rows are never touched. Shared by the manual Sync button and
    dataset upload/activation."""
    from backend.repositories.csv.csv_base import csv_cache  # noqa: PLC0415
    from backend.core.material_ledger_config import COLUMN_MAP  # noqa: PLC0415
    from backend.services.material_ledger_service import _classify_brand, _material_is_bulk  # noqa: PLC0415

    df = csv_cache.get("material_ledger")
    mat_col = COLUMN_MAP.get("material_id", "Material")
    desc_col = COLUMN_MAP.get("material_description", "Material Description")
    if df.empty or mat_col not in df.columns or desc_col not in df.columns:
        return 0

    pairs = df[[mat_col, desc_col]].drop_duplicates().dropna()
    count = 0
    for _, row in pairs.iterrows():
        mat_id = str(row[mat_col]).strip()
        desc   = str(row[desc_col]).strip()
        result = await db.execute(select(Material).where(Material.material_id == mat_id))
        if not result.scalar_one_or_none():
            db.add(Material(
                material_id=mat_id,
                description=desc,
                brand_group=_classify_brand(desc),
                is_bag=not _material_is_bulk(desc),
                is_bulk=_material_is_bulk(desc),
                is_new=True,
            ))
            count += 1
    await db.commit()
    return count


@router.post("/materials/sync")
async def sync_materials(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    """Re-import distinct materials from the current in-memory CSV cache."""
    count = await _import_new_materials_from_cache(db)
    return {"success": True, "data": {"imported": count}}


# ── Brand groups ──────────────────────────────────────────────────────────────
# Source of truth for the Materials tab's brand-group dropdown and for the
# Location Summary report's brand columns (see material_ledger.py). Anyone
# logged in can list them; only admins can add new ones.

class BrandGroupCreate(BaseModel):
    label: str


@router.get("/brand-groups")
async def list_brand_groups(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(BrandGroup).order_by(BrandGroup.sort_order))
    groups = result.scalars().all()
    return {"success": True, "data": [
        {"id": g.id, "label": g.label, "sort_order": g.sort_order} for g in groups
    ]}


@router.post("/brand-groups", status_code=status.HTTP_201_CREATED)
async def create_brand_group(body: BrandGroupCreate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    label = body.label.strip()
    if not label:
        raise HTTPException(status_code=400, detail="Label is required")
    slug = _slugify(label)
    existing = (await db.execute(select(BrandGroup).where(BrandGroup.id == slug))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"Brand group '{slug}' already exists")
    max_order = (await db.execute(select(BrandGroup.sort_order).order_by(BrandGroup.sort_order.desc()).limit(1))).scalar_one_or_none()
    group = BrandGroup(id=slug, label=label, sort_order=(max_order or 0) + 1)
    db.add(group)
    await db.commit()
    return {"success": True, "data": {"id": group.id, "label": group.label, "sort_order": group.sort_order}}


# ── Datasets (admin-uploaded inventory CSVs) ─────────────────────────────────
# Library model: uploaded CSVs are stored whole in the DB until deleted.
# At most one is active; it is pinned into the CSV cache and drives every
# dashboard screen. Zero active = the bundled (repo) CSV is in effect.

_LEDGER_KEY = "material_ledger"
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB — current exports are ~340 KB


def _parse_and_validate_csv(raw: bytes, filename: str) -> "object":
    """Parse uploaded bytes as CSV and enforce the same required-column rules
    as disk loads. Returns the DataFrame or raises HTTPException(400)."""
    import pandas as pd  # noqa: PLC0415
    from backend.repositories.csv.csv_base import REQUIRED_COLUMNS  # noqa: PLC0415

    try:
        df = pd.read_csv(io.BytesIO(raw), low_memory=False)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse {filename} as CSV: {exc}")

    required = REQUIRED_COLUMNS.get(_LEDGER_KEY, [])
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"{filename} is missing required column(s): {', '.join(missing)}. "
                   f"Found: {', '.join(map(str, df.columns[:15]))}",
        )
    if df.empty:
        raise HTTPException(status_code=400, detail=f"{filename} contains no data rows")
    return df


async def _apply_active_dataset(db: AsyncSession, dataset: Optional[CsvDataset]) -> int:
    """Make `dataset` the single active one (None = bundled default), update
    the CSV cache accordingly, and import any never-seen material IDs into the
    DB flagged is_new=True. Returns the number of newly imported materials."""
    import pandas as pd  # noqa: PLC0415
    from backend.repositories.csv.csv_base import csv_cache  # noqa: PLC0415

    await db.execute(sa_update(CsvDataset).values(is_active=False))
    if dataset is None:
        await db.commit()
        csv_cache.unpin(_LEDGER_KEY)
    else:
        dataset.is_active = True
        await db.commit()
        df = pd.read_csv(io.StringIO(dataset.content), low_memory=False)
        csv_cache.pin_dataframe(_LEDGER_KEY, df, f"uploaded: {dataset.filename}")

    return await _import_new_materials_from_cache(db)


def _dataset_out(d: CsvDataset) -> dict:
    return {
        "id": str(d.id), "filename": d.filename, "row_count": d.row_count,
        "is_active": d.is_active, "uploaded_at": d.uploaded_at.isoformat(),
    }


@router.get("/datasets")
async def list_datasets(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(select(CsvDataset).order_by(CsvDataset.uploaded_at.desc()))
    datasets = result.scalars().all()
    active = next((str(d.id) for d in datasets if d.is_active), None)
    return {"success": True, "data": {
        "datasets": [_dataset_out(d) for d in datasets],
        "active_dataset_id": active,  # null = bundled default is active
    }}


@router.post("/datasets", status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Upload an inventory CSV. Validated, stored in the DB, and activated
    immediately — the whole dashboard switches to it."""
    raw = await file.read()
    if len(raw) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")
    filename = file.filename or "upload.csv"

    df = _parse_and_validate_csv(raw, filename)

    dataset = CsvDataset(
        filename=filename,
        content=raw.decode("utf-8-sig", errors="replace"),
        row_count=len(df),
        uploaded_by=user.id,
    )
    db.add(dataset)
    await db.flush()

    imported = await _apply_active_dataset(db, dataset)
    return {"success": True, "data": {**_dataset_out(dataset), "new_materials_imported": imported}}


@router.post("/datasets/activate-default")
async def activate_default_dataset(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    """Switch the dashboard back to the bundled (repo) CSV without deleting
    any stored dataset."""
    imported = await _apply_active_dataset(db, None)
    return {"success": True, "data": {"new_materials_imported": imported}}


@router.post("/datasets/{dataset_id}/activate")
async def activate_dataset(dataset_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    try:
        did = uuid_mod.UUID(dataset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dataset id")
    dataset = await db.get(CsvDataset, did)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    imported = await _apply_active_dataset(db, dataset)
    return {"success": True, "data": {"new_materials_imported": imported}}


@router.delete("/datasets/{dataset_id}")
async def delete_dataset(dataset_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    """Delete a stored dataset. If it was active, the dashboard falls back to
    the bundled default CSV."""
    try:
        did = uuid_mod.UUID(dataset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dataset id")
    dataset = await db.get(CsvDataset, did)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    was_active = dataset.is_active
    await db.delete(dataset)
    await db.commit()
    if was_active:
        await _apply_active_dataset(db, None)
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
    updates = body.model_dump(exclude_unset=True)
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
    updates = body.model_dump(exclude_unset=True)
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
