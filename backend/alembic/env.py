import asyncio
import os
import sys
from pathlib import Path
from logging.config import fileConfig

# Add the project root (one level above this backend/ folder) to sys.path
# so that `from backend.xxx import ...` works when alembic is run from backend/
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Import all models so autogenerate can detect them
from backend.db.base import Base
import backend.db.models.user            # noqa: F401
import backend.db.models.plant           # noqa: F401
import backend.db.models.material        # noqa: F401
import backend.db.models.app_setting     # noqa: F401
import backend.db.models.material_threshold  # noqa: F401
import backend.db.models.sharepoint_config  # noqa: F401
import backend.db.models.ingestion_log   # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Read DATABASE_URL from environment (overrides alembic.ini value)
DATABASE_URL = os.environ.get("DATABASE_URL", config.get_main_option("sqlalchemy.url", ""))
# Alembic needs a sync URL for offline mode; async driver for online mode
ASYNC_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://").replace("postgres://", "postgresql+asyncpg://")


def run_migrations_offline() -> None:
    context.configure(
        url=ASYNC_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(ASYNC_URL, poolclass=pool.NullPool)
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
