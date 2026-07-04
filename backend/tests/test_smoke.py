"""
API smoke tests — exercise every critical path end-to-end:
health, CSV data endpoints, auth flow, admin CRUD, threshold persistence,
login rate limiting, and CSV column validation.
"""


# ── Health & CSV data ─────────────────────────────────────────────────────────

def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_status_reports_loaded_csvs(client):
    res = client.get("/api/v1/status")
    assert res.status_code == 200
    files = res.json()["data"]["csv_files"]
    assert files["material_ledger"]["status"] == "ok"
    assert files["material_ledger"]["rows_loaded"] > 0
    assert files["plant_names"]["status"] == "ok"


def test_inventory_summary_returns_rows(client):
    res = client.get("/api/v1/material-ledger/inventory-summary")
    assert res.status_code == 200
    body = res.json()["data"]
    assert len(body["rows"]) > 0
    assert body["total_on_hand_mt"] > 0


def test_materials_and_plants_endpoints(client):
    mats = client.get("/api/v1/material-ledger/materials")
    plants = client.get("/api/v1/material-ledger/plants")
    assert mats.status_code == 200 and len(mats.json()["data"]) > 0
    assert plants.status_code == 200 and len(plants.json()["data"]) > 0


# ── Auth ──────────────────────────────────────────────────────────────────────

def test_login_rejects_bad_credentials(client):
    res = client.post("/api/v1/auth/login",
                      json={"email": "nobody@test.local", "password": "wrong"})
    assert res.status_code == 401


def _without_cookies(client, method: str, url: str, **kwargs):
    """Run one request with the cookie jar emptied, then restore it."""
    saved = dict(client.cookies)
    client.cookies.clear()
    try:
        return getattr(client, method)(url, **kwargs)
    finally:
        for k, v in saved.items():
            client.cookies.set(k, v)


def test_me_requires_auth(client):
    res = _without_cookies(client, "get", "/api/v1/auth/me")
    assert res.status_code == 401


def test_login_and_me_flow(admin_client, admin_credentials):
    email, _ = admin_credentials
    res = admin_client.get("/api/v1/auth/me")
    assert res.status_code == 200
    assert res.json()["data"]["email"] == email
    assert res.json()["data"]["role"] == "admin"


def test_login_rate_limit_kicks_in(client):
    email = "bruteforce-target@test.local"
    for _ in range(5):
        res = client.post("/api/v1/auth/login", json={"email": email, "password": "x"})
        assert res.status_code == 401
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "x"})
    assert res.status_code == 429


# ── Admin CRUD (plants) ───────────────────────────────────────────────────────

def test_admin_plant_crud_with_soft_delete(admin_client):
    # Create
    res = admin_client.post("/api/v1/admin/plants",
                            json={"plant_id": "9999", "name": "Smoke Test Plant", "city": "Testville"})
    assert res.status_code == 201

    # Update
    res = admin_client.put("/api/v1/admin/plants/9999", json={"name": "Renamed Plant"})
    assert res.status_code == 200

    # Soft-delete → still listed, is_active False
    res = admin_client.delete("/api/v1/admin/plants/9999")
    assert res.status_code == 200
    plants = {p["plant_id"]: p for p in admin_client.get("/api/v1/admin/plants").json()["data"]}
    assert plants["9999"]["name"] == "Renamed Plant"
    assert plants["9999"]["is_active"] is False

    # Restore
    res = admin_client.put("/api/v1/admin/plants/9999", json={"is_active": True})
    assert res.status_code == 200
    plants = {p["plant_id"]: p for p in admin_client.get("/api/v1/admin/plants").json()["data"]}
    assert plants["9999"]["is_active"] is True


def test_inactive_plant_hidden_from_dashboard(admin_client):
    admin_client.put("/api/v1/admin/plants/9999", json={"is_active": False})
    ids = [p["plant_id"] for p in admin_client.get("/api/v1/material-ledger/plants").json()["data"]]
    assert "9999" not in ids


# ── Threshold persistence (the "data keeps resetting" fix) ────────────────────

def test_threshold_write_through_to_db(admin_client, async_session_factory):
    import anyio
    from backend.core.material_ledger_config import MATERIAL_THRESHOLDS
    from backend.repositories.db import threshold_repo

    async def _db_thresholds():
        async with async_session_factory() as db:
            return await threshold_repo.as_dict(db)

    # Set via the Settings-page endpoint (the only surface left that writes thresholds
    # now that the admin panel's Thresholds tab + /admin/thresholds are removed)
    res = admin_client.post("/api/v1/settings/thresholds",
                            json={"material_id": "80300000008", "min_stock_mt": 42.5})
    assert res.status_code == 200

    # In-memory cache updated (drives CSV alert calculations)
    assert MATERIAL_THRESHOLDS.get("80300000008") == 42.5
    # Persisted to DB (survives restarts — the "data keeps resetting" fix)
    assert anyio.run(_db_thresholds).get("80300000008") == 42.5

    # Clearing (0) removes from both stores
    res = admin_client.post("/api/v1/settings/thresholds",
                            json={"material_id": "80300000008", "min_stock_mt": 0})
    assert res.status_code == 200
    assert "80300000008" not in MATERIAL_THRESHOLDS
    assert "80300000008" not in anyio.run(_db_thresholds)


def test_threshold_set_requires_admin(client):
    res = _without_cookies(client, "post", "/api/v1/settings/thresholds",
                           json={"material_id": "X", "min_stock_mt": 1})
    assert res.status_code == 401


# ── Brand groups + admin sort order ────────────────────────────────────────────

def test_brand_groups_list_seeded(admin_client):
    res = admin_client.get("/api/v1/admin/brand-groups")
    assert res.status_code == 200
    groups = res.json()["data"]
    ids = [g["id"] for g in groups]
    assert "sanstha" in ids and "extra" in ids
    orders = [g["sort_order"] for g in groups]
    assert orders == sorted(orders)


def test_brand_group_create_requires_admin(client):
    res = _without_cookies(client, "post", "/api/v1/admin/brand-groups", json={"label": "Nope"})
    assert res.status_code == 401


def test_brand_group_create_slugify_and_dedupe(admin_client):
    res = admin_client.post("/api/v1/admin/brand-groups", json={"label": "Holcim Cement"})
    assert res.status_code == 201
    body = res.json()["data"]
    assert body["id"] == "holcim_cement"
    assert body["label"] == "Holcim Cement"

    # Newly created group is immediately usable on a material
    res = admin_client.post("/api/v1/admin/materials", json={
        "material_id": "SMOKE-BRAND-1", "description": "Smoke Brand Material",
        "brand_group": "holcim_cement",
    })
    assert res.status_code == 201

    # Same label again -> same slug -> conflict
    res = admin_client.post("/api/v1/admin/brand-groups", json={"label": "Holcim Cement"})
    assert res.status_code == 409


def test_material_rejects_unknown_brand_group(admin_client):
    res = admin_client.post("/api/v1/admin/materials", json={
        "material_id": "SMOKE-BRAND-2", "description": "Bad Brand Material",
        "brand_group": "does_not_exist",
    })
    assert res.status_code == 400


def test_location_summary_reflects_db_brand_groups(client):
    # holcim_cement was created by an admin above — the report must pick it up
    # without any code change, since it now reads brand_groups from the DB.
    res = client.get("/api/v1/material-ledger/location-summary")
    assert res.status_code == 200
    ids = [b["id"] for b in res.json()["data"]["brand_groups"]]
    assert "sanstha" in ids
    assert "holcim_cement" in ids


def test_materials_sorted_grouped_before_ungrouped(admin_client):
    res = admin_client.post("/api/v1/admin/materials", json={
        "material_id": "SMOKE-UNGROUPED-1", "description": "AAA Ungrouped Material",
    })
    assert res.status_code == 201

    ids_in_order = [m["material_id"] for m in admin_client.get("/api/v1/admin/materials").json()["data"]]
    assert ids_in_order.index("SMOKE-BRAND-1") < ids_in_order.index("SMOKE-UNGROUPED-1")


def test_plants_sorted_by_type_group(admin_client):
    admin_client.post("/api/v1/admin/plants", json={"plant_id": "8001", "name": "ZZZ Depot", "plant_type": "depot"})
    admin_client.post("/api/v1/admin/plants", json={"plant_id": "8002", "name": "AAA Factory", "plant_type": "factory"})

    ids_in_order = [p["plant_id"] for p in admin_client.get("/api/v1/admin/plants").json()["data"]]
    assert ids_in_order.index("8002") < ids_in_order.index("8001")


# ── New-item highlighting (admin panel yellow row) ─────────────────────────────

def test_admin_created_rows_are_not_flagged_new(admin_client):
    # An admin manually adding a plant/material already knows about it —
    # only CSV-auto-discovered rows should ever start as is_new=True.
    admin_client.post("/api/v1/admin/plants", json={"plant_id": "7001", "name": "Manual Plant"})
    admin_client.post("/api/v1/admin/materials", json={"material_id": "SMOKE-MANUAL-1", "description": "Manual Material"})

    plants = {p["plant_id"]: p for p in admin_client.get("/api/v1/admin/plants").json()["data"]}
    mats = {m["material_id"]: m for m in admin_client.get("/api/v1/admin/materials").json()["data"]}
    assert plants["7001"]["is_new"] is False
    assert mats["SMOKE-MANUAL-1"]["is_new"] is False


def test_editing_a_new_row_clears_the_flag(admin_client, async_session_factory):
    import anyio
    from backend.db.models.plant import Plant

    async def _mark_new():
        async with async_session_factory() as db:
            p = await db.get(Plant, "7001")
            p.is_new = True
            await db.commit()

    anyio.run(_mark_new)
    plants = {p["plant_id"]: p for p in admin_client.get("/api/v1/admin/plants").json()["data"]}
    assert plants["7001"]["is_new"] is True

    # Editing any field implicitly acknowledges the row.
    admin_client.put("/api/v1/admin/plants/7001", json={"city": "Colombo"})
    plants = {p["plant_id"]: p for p in admin_client.get("/api/v1/admin/plants").json()["data"]}
    assert plants["7001"]["is_new"] is False


def test_explicit_dismiss_clears_the_flag_without_other_changes(admin_client, async_session_factory):
    import anyio
    from backend.db.models.material import Material

    async def _mark_new():
        async with async_session_factory() as db:
            m = await db.get(Material, "SMOKE-MANUAL-1")
            m.is_new = True
            await db.commit()

    anyio.run(_mark_new)
    res = admin_client.put("/api/v1/admin/materials/SMOKE-MANUAL-1", json={"is_new": False})
    assert res.status_code == 200
    mats = {m["material_id"]: m for m in admin_client.get("/api/v1/admin/materials").json()["data"]}
    assert mats["SMOKE-MANUAL-1"]["is_new"] is False


# ── Uploaded datasets (library + switcher) ─────────────────────────────────────
# These tests run in order and walk one dataset through its full lifecycle:
# upload → scopes every screen → switch to default → delete.

_DATASET_CSV = (
    "Plant,Valuation Class,Material,Material Description,Obj Type,Category,All Items,Proc Cat Name,Quantity,Price\n"
    "2140,3100,80300000008,Insee Extra - Puttalam 50kg,CA,EB,Ending Balance,,55.5,\n"
    "2140,3100,SMOKE-DS-NEW,Smoke Dataset Material,CA,EB,Ending Balance,,12.0,\n"
)


def test_dataset_upload_requires_admin(client):
    res = _without_cookies(client, "post", "/api/v1/admin/datasets",
                           files={"file": ("t.csv", _DATASET_CSV.encode(), "text/csv")})
    assert res.status_code == 401


def test_dataset_upload_rejects_missing_columns(admin_client):
    bad = "Plant,Material\n2140,80300000008\n"
    res = admin_client.post("/api/v1/admin/datasets",
                            files={"file": ("bad.csv", bad.encode(), "text/csv")})
    assert res.status_code == 400
    assert "missing required column" in res.json()["detail"]


def test_dataset_upload_activates_and_scopes_everything(admin_client):
    res = admin_client.post("/api/v1/admin/datasets",
                            files={"file": ("smoke-dataset.csv", _DATASET_CSV.encode(), "text/csv")})
    assert res.status_code == 201, res.text
    body = res.json()["data"]
    assert body["is_active"] is True
    assert body["row_count"] == 2

    # Status reports the uploaded source
    status = admin_client.get("/api/v1/status").json()["data"]["csv_files"]["material_ledger"]
    assert status["source"] == "uploaded: smoke-dataset.csv"
    assert status["rows_loaded"] == 2

    # Dashboard-facing materials list is scoped to EXACTLY the dataset's IDs
    ids = {m["material_id"] for m in admin_client.get("/api/v1/material-ledger/materials").json()["data"]}
    assert ids == {"80300000008", "SMOKE-DS-NEW"}

    # Never-seen ID was imported into the DB flagged as new (yellow highlight)
    mats = {m["material_id"]: m for m in admin_client.get("/api/v1/admin/materials").json()["data"]}
    assert mats["SMOKE-DS-NEW"]["is_new"] is True
    assert mats["SMOKE-DS-NEW"]["in_dataset"] is True
    assert mats["80300000008"]["in_dataset"] is True
    # A material that exists in the DB but not in this dataset is greyed out
    assert mats["SMOKE-MANUAL-1"]["in_dataset"] is False


def test_dataset_switch_back_to_default(admin_client):
    res = admin_client.post("/api/v1/admin/datasets/activate-default")
    assert res.status_code == 200

    status = admin_client.get("/api/v1/status").json()["data"]["csv_files"]["material_ledger"]
    assert status["source"] == "bundled"
    assert status["rows_loaded"] > 100  # full bundled dataset again

    ids = {m["material_id"] for m in admin_client.get("/api/v1/material-ledger/materials").json()["data"]}
    assert len(ids) > 2
    listing = admin_client.get("/api/v1/admin/datasets").json()["data"]
    assert listing["active_dataset_id"] is None
    assert len(listing["datasets"]) == 1


def test_dataset_delete_active_falls_back_to_default(admin_client):
    listing = admin_client.get("/api/v1/admin/datasets").json()["data"]
    ds_id = listing["datasets"][0]["id"]

    # Re-activate the stored dataset, then delete it while active
    assert admin_client.post(f"/api/v1/admin/datasets/{ds_id}/activate").status_code == 200
    assert admin_client.get("/api/v1/status").json()["data"]["csv_files"]["material_ledger"]["source"].startswith("uploaded")

    assert admin_client.delete(f"/api/v1/admin/datasets/{ds_id}").status_code == 200
    status = admin_client.get("/api/v1/status").json()["data"]["csv_files"]["material_ledger"]
    assert status["source"] == "bundled"
    assert admin_client.get("/api/v1/admin/datasets").json()["data"]["datasets"] == []


# ── CSV validation ────────────────────────────────────────────────────────────

def test_csv_missing_columns_rejected(tmp_path):
    from backend.repositories.csv.csv_base import CsvCache, CSV_FILES
    from backend.core.config import settings as app_settings

    # Write a structurally broken inventory file (missing Quantity etc.)
    bad_dir = tmp_path / "bad-csv"
    bad_dir.mkdir()
    (bad_dir / CSV_FILES["material_ledger"]).write_text("Plant,Material\n2140,80300000008\n")
    (bad_dir / CSV_FILES["plant_names"]).write_text("Plant,Name 1\n2140,Test\n")

    original = app_settings.csv_base_path
    try:
        app_settings.csv_base_path = str(bad_dir)
        cache = CsvCache()
        cache.load_all()
        assert cache.status("material_ledger")["status"] == "error"
        assert cache.status("plant_names")["status"] == "ok"
    finally:
        app_settings.csv_base_path = original
