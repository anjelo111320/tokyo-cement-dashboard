from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from typing import AsyncGenerator


_engine = None
_AsyncSessionLocal = None


def init_engine(database_url: str) -> None:
    global _engine, _AsyncSessionLocal
    _engine = create_async_engine(database_url, echo=False, pool_pre_ping=True)
    _AsyncSessionLocal = async_sessionmaker(_engine, expire_on_commit=False)


def get_engine():
    return _engine


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if _AsyncSessionLocal is None:
        raise RuntimeError("Database not initialised — call init_engine() first")
    async with _AsyncSessionLocal() as session:
        yield session
