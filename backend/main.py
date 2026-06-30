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

# Configure logging before anything else so every import below can log correctly.
configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Lifespan context manager — runs startup code before the server accepts
    requests, and shutdown code when the server is stopping.

    Startup sequence:
      1. Load all CSV files into the in-memory cache (so the first API
         request is never waiting for a slow disk read).
      2. Start the APScheduler background job that refreshes the cache
         every 15 minutes.

    Shutdown sequence:
      1. Stop the scheduler gracefully so no job is mid-execution.
    """
    logger.info("startup", app=settings.app_name, version=settings.app_version)

    # Step 1 — Prime the CSV cache immediately on startup.
    # Without this, the first API call after a server restart would return
    # an error because the cache would be empty.
    csv_cache.load_all()

    # Step 2 — Start the background scheduler (every 15 min re-reads CSVs).
    start_scheduler()

    yield  # Server is running — handle requests between startup and shutdown.

    # Shutdown — stop the scheduler so it doesn't fire after the process exits.
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
