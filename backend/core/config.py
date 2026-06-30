"""
core/config.py — Environment Configuration
============================================
Single source of truth for every value that can change between environments
(development, staging, production). All values are read from environment
variables or a .env file — never hard-coded.

How it works:
  - Pydantic's BaseSettings reads variables from the process environment
    and from a .env file automatically.
  - Any module that needs a config value imports `settings` from here.
  - Never import raw os.environ anywhere else — always use `settings`.

Used by:
  main.py            → app_name, app_version, allowed_origins
  core/logging.py    → log_level
  core/middleware.py → allowed_origins
  core/scheduler.py  → csv_refresh_interval_seconds
  repositories/csv/csv_base.py → csv_base_path
  api/v1/settings.py → csv_base_path, csv_refresh_interval_seconds
"""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    All configurable values for the application.
    Each field maps 1-to-1 to an environment variable (case-insensitive).

    Example .env file:
        CSV_BASE_PATH=../sample-data
        CSV_REFRESH_INTERVAL_SECONDS=900
        LOG_LEVEL=INFO
    """

    # ── CSV data source ───────────────────────────────────────────────────────
    # Path to the folder that contains production.csv, inventory.csv, etc.
    # Default points to sample-data/ for local development.
    csv_base_path: str = str(Path(__file__).parent.parent.parent / "sample-data")

    # How often (in seconds) the background scheduler re-reads the CSV files.
    # 900 seconds = 15 minutes, matching the source system's update cadence.
    csv_refresh_interval_seconds: int = 900

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Which frontend origins are allowed to call this API.
    # Set as comma-separated string in env: ALLOWED_ORIGINS=https://app.vercel.app,http://localhost:5173
    allowed_origins_str: str = "http://localhost:5173,http://localhost:3000"

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins_str.split(",")]

    # ── Logging ───────────────────────────────────────────────────────────────
    # Standard Python log level: DEBUG, INFO, WARNING, ERROR, CRITICAL.
    log_level: str = "INFO"

    # ── App metadata ──────────────────────────────────────────────────────────
    # Shown in the FastAPI docs UI and health check response.
    app_name: str = "Tokyo Cement API"
    app_version: str = "1.0.0"

    # ── Database (Phase 2) ────────────────────────────────────────────────────
    # Empty in Phase 1 — will hold the PostgreSQL connection string in Phase 2.
    # Format: postgresql://user:password@host:5432/dbname
    database_url: str = ""

    # Pydantic settings config — tells it where to look for the .env file.
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # silently ignore unknown env vars
    )


# Singleton instance — import this everywhere you need config values.
settings = Settings()
