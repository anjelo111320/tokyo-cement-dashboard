"""
main.py — Application Entry Point
===================================
This is the first file Python runs. It creates the FastAPI app, wires
together every layer (middleware, routes, error handlers), and controls
what happens at startup and shutdown.

Connection map:
  main.py
    ├── core/config.py       → reads environment variables (CSV path, log level…)
    ├── core/logging.py      → sets up structured JSON logging
    ├── core/middleware.py   → adds CORS and request-timing headers
    ├── core/scheduler.py    → starts the 15-minute CSV refresh background job
    ├── core/exceptions.py   → AppError base class used in the error handler below
    ├── api/router.py        → all /api/v1/* route groups registered here
    └── repositories/csv/csv_base.py → CsvCache loaded once at startup
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from backend.api.router import api_router
from backend.core.config import settings
from backend.core.exceptions import AppError
from backend.core.logging import configure_logging, get_logger
from backend.core.middleware import add_cors, TimingMiddleware
from backend.core.scheduler import start_scheduler, stop_scheduler
from backend.repositories.csv.csv_base import csv_cache

configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("startup", app=settings.app_name, version=settings.app_version)

    # Refuse to silently run with the placeholder JWT signing key in any
    # cross-site (production) deployment — tokens would be forgeable by anyone
    # who has read the public repo. Local same-site dev still boots with a warning.
    if settings.secret_key.startswith("changeme"):
        if settings.cookie_secure:  # cookie_secure=true is our production signal
            raise RuntimeError(
                "SECRET_KEY is still the placeholder value. Set a real key on the "
                "host (generate with: openssl rand -hex 32) before deploying."
            )
        logger.warning("insecure_secret_key", detail="Using placeholder SECRET_KEY — dev only, never deploy like this")

    # Initialise PostgreSQL engine if DATABASE_URL is configured
    if settings.database_url:
        from backend.db.database import init_engine, get_db
        init_engine(settings.database_url)
        logger.info("database_connected", url=settings.database_url.split("@")[-1])

        # Hydrate the in-memory threshold cache from the DB so low-stock alert
        # settings survive restarts (Render free tier spins down when idle —
        # without this, thresholds silently reset on every wake-up).
        # Best-effort: an unreachable DB must not prevent the CSV API booting.
        from backend.repositories.db import threshold_repo
        from backend.core.material_ledger_config import MATERIAL_THRESHOLDS
        try:
            async for db in get_db():
                db_thresholds = await threshold_repo.as_dict(db)
                MATERIAL_THRESHOLDS.clear()
                MATERIAL_THRESHOLDS.update(db_thresholds)
                logger.info("thresholds_hydrated", count=len(db_thresholds))
                break
        except Exception as exc:
            logger.error("threshold_hydration_failed", error=str(exc))

    csv_cache.load_all()

    # If an admin-uploaded dataset was active before this restart, re-pin it
    # over the bundled file so the dashboard keeps showing the uploaded data.
    # Best-effort: failure falls back to the bundled CSV already loaded above.
    if settings.database_url:
        try:
            import io
            import pandas as pd
            from sqlalchemy import select as sa_select
            from backend.db.database import get_db
            from backend.db.models.csv_dataset import CsvDataset
            async for db in get_db():
                result = await db.execute(sa_select(CsvDataset).where(CsvDataset.is_active == True))  # noqa: E712
                active = result.scalar_one_or_none()
                if active:
                    df = pd.read_csv(io.StringIO(active.content), low_memory=False)
                    csv_cache.pin_dataframe("material_ledger", df, f"uploaded: {active.filename}")
                    logger.info("dataset_rehydrated", filename=active.filename, rows=len(df))
                break
        except Exception as exc:
            logger.error("dataset_rehydration_failed", error=str(exc))

    start_scheduler()

    yield

    stop_scheduler()
    logger.info("shutdown")


def create_app() -> FastAPI:
    """
    Factory function that builds and configures the FastAPI application.
    Using a factory (instead of a top-level `app = FastAPI()`) makes it
    easy to create test instances with different settings.
    """
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Tokyo Cement Analytics API",
        docs_url="/docs",       # Swagger UI available at /docs
        redoc_url="/redoc",     # ReDoc available at /redoc
        lifespan=lifespan,
    )

    # ── Middleware ────────────────────────────────────────────────────────────
    # CORS: allows the React frontend (different origin/port) to call this API.
    add_cors(app)
    # TimingMiddleware: adds X-Process-Time-Ms header to every response.
    app.add_middleware(TimingMiddleware)

    # ── Routes ───────────────────────────────────────────────────────────────
    # All /api/v1/* endpoints are defined in api/router.py and its sub-files.
    app.include_router(api_router)

    # ── Global error handler ─────────────────────────────────────────────────
    # Converts our custom AppError (and its subclasses CsvReadError,
    # DataValidationError, NotFoundError) into a consistent JSON response
    # instead of a raw 500 Internal Server Error.
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        from datetime import datetime
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": {"code": exc.code, "message": exc.message},
                "meta": {"timestamp": datetime.utcnow().isoformat() + "Z"},
            },
        )

    # ── Root health check ─────────────────────────────────────────────────────
    # Simple ping endpoint used by deployment platforms (Railway, Render)
    # to verify the server is alive. Does not touch the CSV cache.
    @app.get("/health")
    async def root_health():
        return {"status": "healthy", "version": settings.app_version}

    return app


# Create the application instance used by uvicorn.
app = create_app()

if __name__ == "__main__":
    # Run directly with: python -m backend.main
    # In production use: uvicorn backend.main:app --host 0.0.0.0 --port 8000
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
