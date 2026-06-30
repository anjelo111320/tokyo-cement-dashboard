"""
core/scheduler.py — Background CSV Refresh Scheduler
======================================================
Runs a background job every 15 minutes (configurable) that re-reads all
CSV files into memory. This keeps the API data fresh without needing
the client to trigger a manual import.

Why a scheduler?
  The source system (ERP, plant control) writes updated CSV files every
  15 minutes. Without this scheduler, the API would keep serving stale
  data from the last server restart. With it, data is always at most
  15 minutes old — automatically, with no user action.

Job lifecycle:
  1. main.py calls start_scheduler() at application startup.
  2. APScheduler fires _refresh_csv() every 900 seconds in a background thread.
  3. _refresh_csv() calls csv_cache.load_all() which re-reads all 5 CSV files.
  4. main.py calls stop_scheduler() when the server shuts down.

Depends on:
  repositories/csv/csv_base.py → csv_cache.load_all()
  core/config.py               → settings.csv_refresh_interval_seconds
  core/logging.py              → logger

Used by:
  main.py → start_scheduler(), stop_scheduler()
"""

from apscheduler.schedulers.background import BackgroundScheduler
from backend.repositories.csv.csv_base import csv_cache
from backend.core.config import settings
from backend.core.logging import get_logger

logger = get_logger(__name__)

# Module-level scheduler instance — one per process.
# BackgroundScheduler runs jobs in a separate thread so they don't
# block the FastAPI event loop.
_scheduler = BackgroundScheduler()


def _refresh_csv() -> None:
    """
    The actual job function called by APScheduler every 15 minutes.
    Reloads all 5 CSV files (production, inventory, fleet, deliveries, orders)
    into the in-memory cache. Thread-safe — csv_cache uses a lock internally.
    """
    logger.info("csv_refresh_started")
    csv_cache.load_all()
    logger.info("csv_refresh_completed")


def start_scheduler() -> None:
    """
    Registers the CSV refresh job and starts the scheduler.
    Called once by main.py at application startup.

    The 'interval' trigger fires _refresh_csv() every N seconds.
    replace_existing=True means re-registering on a hot-reload doesn't
    create duplicate jobs.
    """
    _scheduler.add_job(
        _refresh_csv,
        trigger="interval",
        seconds=settings.csv_refresh_interval_seconds,
        id="csv_refresh",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info(
        "scheduler_started",
        interval_seconds=settings.csv_refresh_interval_seconds,
    )


def stop_scheduler() -> None:
    """
    Stops the scheduler gracefully on application shutdown.
    wait=False means don't block if a job is currently running — just stop.
    """
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("scheduler_stopped")
