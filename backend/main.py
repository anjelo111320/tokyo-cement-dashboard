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

    # Initialise PostgreSQL engine if DATABASE_URL is configured
    if settings.database_url:
        from backend.db.database import init_engine
        from sqlalchemy.ext.asyncio import AsyncEngine
        init_engine(settings.database_url)
        logger.info("database_connected", url=settings.database_url.split("@")[-1])

    csv_cache.load_all()
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
