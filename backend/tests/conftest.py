"""
Smoke-test fixtures.

Strategy: run the real FastAPI app (real CSV cache, real routers, real auth)
against a throwaway SQLite database instead of Postgres. The generic
`sqlalchemy.Uuid` column type keeps the models portable, so the whole schema
creates cleanly on SQLite. `get_db` is dependency-overridden; the app's own
lifespan skips Postgres init because DATABASE_URL is blanked before create_app.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

# Neutralise external config BEFORE the app modules read it.
from backend.core.config import settings as app_settings
app_settings.database_url = ""                      # lifespan must not touch Postgres
app_settings.secret_key = "smoke-test-secret-key"   # not the placeholder → no warning

from backend.db.base import Base
# Import every model so Base.metadata knows the full schema.
import backend.db.models.user        # noqa: F401
import backend.db.models.plant       # noqa: F401
import backend.db.models.material    # noqa: F401
import backend.db.models.brand_group # noqa: F401
import backend.db.models.csv_dataset # noqa: F401
import backend.db.models.material_threshold  # noqa: F401
import backend.db.models.sharepoint_config   # noqa: F401
from backend.db.database import get_db
from backend.auth.password import hash_password


@pytest.fixture(scope="session")
def db_path(tmp_path_factory):
    return tmp_path_factory.mktemp("db") / "smoke.sqlite3"


@pytest.fixture(scope="session")
def async_session_factory(db_path):
    # DDL via a plain sync engine (simplest reliable way to create tables),
    # app traffic via the async aiosqlite engine.
    sync_engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(sync_engine)

    # Mirrors the seed data the real Alembic migration inserts in production.
    from datetime import datetime, timezone
    from backend.db.models.brand_group import BrandGroup
    now = datetime.now(timezone.utc)
    with sync_engine.begin() as conn:
        conn.execute(BrandGroup.__table__.insert(), [
            {"id": "sanstha", "label": "Sanstha", "sort_order": 0, "created_at": now},
            {"id": "extra", "label": "Extra", "sort_order": 1, "created_at": now},
        ])
    sync_engine.dispose()

    async_engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    return async_sessionmaker(async_engine, expire_on_commit=False)


@pytest.fixture(scope="session")
def client(async_session_factory):
    from fastapi.testclient import TestClient
    from backend.main import create_app

    async def _override_get_db():
        async with async_session_factory() as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_db] = _override_get_db
    # Context manager runs the lifespan: loads the real sample-data CSVs.
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_credentials(client, async_session_factory):
    """Insert an admin user directly, return its login credentials."""
    import anyio
    from backend.db.models.user import User

    email, password = "smoke-admin@test.local", "smoke-pass-123"

    async def _create():
        async with async_session_factory() as db:
            db.add(User(email=email, hashed_pw=hash_password(password), role="admin"))
            await db.commit()

    anyio.run(_create)
    return email, password


@pytest.fixture(scope="session")
def admin_client(client, admin_credentials):
    """The shared TestClient, logged in as admin (cookies persist on it)."""
    email, password = admin_credentials
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return client
