from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── CSV data source ───────────────────────────────────────────────────────
    csv_base_path: str = str(Path(__file__).parent.parent.parent / "sample-data")
    csv_refresh_interval_seconds: int = 900

    # ── CORS ──────────────────────────────────────────────────────────────────
    allowed_origins_str: str = "http://localhost:5173,http://localhost:3000"

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins_str.split(",")]

    # ── Logging ───────────────────────────────────────────────────────────────
    log_level: str = "INFO"

    # ── App metadata ──────────────────────────────────────────────────────────
    app_name: str = "Tokyo Cement API"
    app_version: str = "1.0.0"

    # ── Database ──────────────────────────────────────────────────────────────
    # Format: postgresql+asyncpg://user:password@host:5432/dbname
    database_url: str = ""

    # ── Auth (JWT) ────────────────────────────────────────────────────────────
    # Generate with: openssl rand -hex 32
    secret_key: str = "changeme-replace-with-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # ── Admin bootstrap ───────────────────────────────────────────────────────
    # Same env var bootstrap_admin.py reads directly (see backend/scripts/) —
    # exposed here too so the admin API can identify and protect that account
    # from deletion. None locally, where this script is normally unused.
    bootstrap_admin_email: Optional[str] = None

    # ── Auth cookies ──────────────────────────────────────────────────────────
    # Defaults suit local dev (same-site http://localhost). For a cross-site
    # deploy (frontend and backend on different domains, e.g. Vercel + Render)
    # set COOKIE_SAMESITE=none and COOKIE_SECURE=true — browsers only send
    # SameSite=None cookies when they are also marked Secure.
    cookie_samesite: str = "lax"
    cookie_secure: bool = False

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parent.parent / ".env"),  # always backend/.env
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
