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

def test_threshold_write_through_to_db(admin_client):
    from backend.core.material_ledger_config import MATERIAL_THRESHOLDS

    # Set via the Settings-page endpoint
    res = admin_client.post("/api/v1/settings/thresholds",
                            json={"material_id": "80300000008", "min_stock_mt": 42.5})
    assert res.status_code == 200

    # In-memory cache updated (drives CSV alert calculations)
    assert MATERIAL_THRESHOLDS.get("80300000008") == 42.5

    # Persisted to DB (visible through the admin DB-backed endpoint)
    rows = {t["material_id"]: t["threshold_mt"]
            for t in admin_client.get("/api/v1/admin/thresholds").json()["data"]}
    assert rows.get("80300000008") == 42.5

    # Clearing (0) removes from both stores
    res = admin_client.post("/api/v1/settings/thresholds",
                            json={"material_id": "80300000008", "min_stock_mt": 0})
    assert res.status_code == 200
    assert "80300000008" not in MATERIAL_THRESHOLDS
    rows = {t["material_id"] for t in admin_client.get("/api/v1/admin/thresholds").json()["data"]}
    assert "80300000008" not in rows


def test_threshold_set_requires_admin(client):
    res = _without_cookies(client, "post", "/api/v1/settings/thresholds",
                           json={"material_id": "X", "min_stock_mt": 1})
    assert res.status_code == 401


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
