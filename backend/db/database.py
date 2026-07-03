from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from typing import AsyncGenerator


_engine = None
_AsyncSessionLocal = None


def _normalize_async_url(database_url: str) -> str:
    """Coerce any Postgres URL scheme to the asyncpg driver SQLAlchemy needs.

    Render/Heroku hand out `postgres://…` (and sometimes `postgresql://…`),
    but the async engine requires `postgresql+asyncpg://…`. Rewriting the
    scheme here means DATABASE_URL can be pasted verbatim from the Render
    dashboard without manual editing.
    """
    if database_url.startswith("postgresql+asyncpg://"):
        return database_url
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    return database_url


def init_engine(database_url: str) -> None:
    global _engine, _AsyncSessionLocal
    _engine = create_async_engine(_normalize_async_url(database_url), echo=False, pool_pre_ping=True)
    _AsyncSessionLocal = async_sessionmaker(_engine, expire_on_commit=False)


def get_engine():
    return _engine


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if _AsyncSessionLocal is None:
        raise RuntimeError("Database not initialised — call init_engine() first")
    async with _AsyncSessionLocal() as session:
        yield session
