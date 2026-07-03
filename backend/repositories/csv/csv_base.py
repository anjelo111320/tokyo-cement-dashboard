"""
repositories/csv/csv_base.py — Thread-Safe CSV Cache
======================================================
The single most important file in the data layer. This module:
  1. Defines which CSV files exist and what they are called.
  2. Provides CsvCache — an in-memory store of the parsed DataFrames.
  3. Exposes a singleton `csv_cache` used by every repository.

Why in-memory cache?
  Reading and parsing a CSV file on every API request would be very slow
  (disk I/O + pandas parsing for 800+ rows per file). Instead:
    - Startup: load all CSV files once into memory (fast dict lookup).
    - Scheduler: reload every 15 min in a background thread.
    - API request: serve from memory in microseconds.

Thread safety:
  The scheduler runs in a background thread. API requests run in FastAPI's
  async event loop (also threads under uvicorn). To prevent a request from
  reading a half-written DataFrame, every read and write acquires an RLock.
  RLock (re-entrant lock) allows the same thread to acquire it multiple times
  without deadlocking.

Data flow:
  APScheduler thread          →  csv_cache.load_all()
                                     ↓ (per file)
                                 _load_file()   →  pd.read_csv()
                                                →  _frames["production"] = df
  API request thread          →  csv_cache.get("production")
                                     ↓
                                 returns copy of df  →  repository  →  service

Used by:
  repositories/csv/*_csv_repo.py → each repo calls csv_cache.get("name")
  api/v1/settings.py             → trigger endpoint calls csv_cache.load_all()
  api/v1/health.py               → status endpoint calls csv_cache.all_statuses()
  core/scheduler.py              → scheduler calls csv_cache.load_all()
  main.py                        → csv_cache.load_all() called at startup
"""

import threading
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd

from backend.core.config import settings
from backend.core.exceptions import CsvReadError
from backend.core.logging import get_logger

logger = get_logger(__name__)

# Authoritative mapping: logical name → CSV filename.
# Add a new data source here and it becomes available to all repositories.
CSV_FILES = {
    # Tokyo Cement SAP exports
    "material_ledger": "June inventory(Data).csv",
    "plant_names":     "plant_names.csv",
}

# Columns each file MUST contain to be usable. A file missing any of these is
# rejected at load time with a clear error (visible in GET /api/v1/status)
# instead of silently producing empty dashboards. Optional columns (e.g.
# "Posting Date") are intentionally not listed.
REQUIRED_COLUMNS: dict[str, list[str]] = {
    "material_ledger": ["Plant", "Material", "Material Description", "Obj Type", "Category", "Quantity"],
    "plant_names":     ["Plant", "Name 1"],
}


class CsvCache:
    """
    In-memory cache of parsed CSV DataFrames.

    Each file is stored as a raw pd.DataFrame. Repositories call .get()
    to receive a copy and then apply their own filtering and mapping.
    Storing raw DataFrames (rather than pre-mapped domain objects) lets each
    repository apply different filters without needing separate cache entries.
    """

    def __init__(self) -> None:
        # RLock: allows the same thread to acquire the lock multiple times.
        # This prevents deadlocks if a method calls another locking method.
        self._lock = threading.RLock()

        # The cached DataFrames — one per CSV file.
        self._frames: dict[str, pd.DataFrame] = {}

        # Timestamps for status reporting (shown in the settings page).
        self._last_processed: dict[str, str] = {}  # When we last parsed the file.
        self._last_modified: dict[str, str] = {}   # When the file was last changed on disk.

        # Error messages from the last load attempt (empty string = no error).
        self._errors: dict[str, str] = {}

    def load_all(self) -> None:
        """
        Loads (or reloads) every CSV file listed in CSV_FILES.
        Called at startup and by the scheduler every 15 minutes.
        Files that fail to load log an error but don't crash the server —
        other files are still loaded successfully.
        """
        base = Path(settings.csv_base_path)
        for key, filename in CSV_FILES.items():
            self._load_file(key, base / filename)

    def _load_file(self, key: str, path: Path) -> None:
        """
        Loads one CSV file into the cache.
        Records the file's modification time and the load timestamp so the
        settings page can show how fresh the data is.

        If the file is missing or malformed:
          - Logs the error at ERROR level.
          - Stores the error message in _errors for the status endpoint.
          - Does NOT raise — the server keeps running with the old data.
        """
        try:
            if not path.exists():
                raise CsvReadError(f"File not found: {path}")

            # Record when the source file was last modified on disk.
            mtime = datetime.fromtimestamp(path.stat().st_mtime).isoformat()

            # Parse the CSV. low_memory=False prevents mixed-type column warnings.
            df = pd.read_csv(path, low_memory=False)

            # Validate the file has the columns the app depends on. A malformed
            # export is rejected here (old data stays live) rather than loading
            # and rendering an empty dashboard with no explanation.
            required = REQUIRED_COLUMNS.get(key, [])
            missing = [c for c in required if c not in df.columns]
            if missing:
                raise CsvReadError(
                    f"{path.name} is missing required column(s): {', '.join(missing)}. "
                    f"Found columns: {', '.join(map(str, df.columns[:15]))}"
                )

            # Acquire the lock ONLY after the slow disk read is done,
            # keeping the locked section as short as possible.
            with self._lock:
                self._frames[key] = df
                self._last_modified[key] = mtime
                self._last_processed[key] = datetime.utcnow().isoformat() + "Z"
                self._errors.pop(key, None)  # Clear any previous error.

            logger.info("csv_loaded", file=key, rows=len(df))

        except Exception as exc:
            with self._lock:
                self._errors[key] = str(exc)
            logger.error("csv_load_failed", file=key, error=str(exc))

    def get(self, key: str) -> pd.DataFrame:
        """
        Returns a copy of the cached DataFrame for the given file key.
        Returns a copy (not the original) so the caller can safely filter
        and mutate it without affecting other concurrent requests.

        Returns an empty DataFrame if the key was never loaded (e.g. the file
        was removed from sample-data). This lets old services return zero/empty
        data gracefully instead of crashing with a 422 error.
        """
        with self._lock:
            df = self._frames.get(key)

        if df is None:
            # Return empty DataFrame — callers get 0 rows, produce 0 totals.
            import pandas as pd
            return pd.DataFrame()

        return df.copy()

    def status(self, key: str) -> dict:
        """
        Returns status metadata for one CSV file.
        Used by api/v1/health.py to populate the CsvStatusCard on the frontend.
        """
        with self._lock:
            path = str(Path(settings.csv_base_path) / CSV_FILES.get(key, ""))
            rows = len(self._frames[key]) if key in self._frames else 0
            return {
                "path": path,
                "last_modified": self._last_modified.get(key, ""),
                "last_processed": self._last_processed.get(key, ""),
                "rows_loaded": rows,
                "status": "error" if key in self._errors else "ok",
            }

    def all_statuses(self) -> dict[str, dict]:
        """Returns status metadata for all CSV files at once."""
        return {key: self.status(key) for key in CSV_FILES}


# ── Singleton ────────────────────────────────────────────────────────────────
# One cache instance shared across the entire application.
# Import this directly in repositories and service modules:
#   from backend.repositories.csv.csv_base import csv_cache
csv_cache = CsvCache()
