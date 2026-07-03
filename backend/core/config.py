from pathlib import Path
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

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parent.parent / ".env"),  # always backend/.env
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
