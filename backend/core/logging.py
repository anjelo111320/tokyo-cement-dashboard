"""
core/logging.py — Structured Logging Setup
============================================
Configures structlog to output JSON-formatted log lines.
JSON logs are easy to ingest into log aggregation tools
(Datadog, CloudWatch, Papertrail) without custom parsers.

Example log line produced:
  {"event": "csv_loaded", "file": "production", "rows": 819,
   "level": "info", "timestamp": "2024-01-15T08:30:00Z"}

How to use in any module:
  from backend.core.logging import get_logger
  logger = get_logger(__name__)
  logger.info("something_happened", key="value")

Called by:
  main.py                  → configure_logging() called once at startup
  core/scheduler.py        → get_logger() for scheduler events
  repositories/csv/csv_base.py → get_logger() for CSV load events
  services/*               → get_logger() for service-layer events
"""

import logging
import structlog
from backend.core.config import settings


def configure_logging() -> None:
    """
    Sets up the structlog pipeline. Call this ONCE at application startup
    (in main.py) before any loggers are used.

    In DEBUG mode: uses ConsoleRenderer (coloured, human-readable).
    In any other mode: uses JSONRenderer (machine-readable, one line per event).
    """
    # Configure Python's standard logging to use the level from config.
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(message)s",  # structlog handles formatting, not stdlib
    )

    structlog.configure(
        processors=[
            # Merges any context variables set with structlog.contextvars.bind_contextvars().
            structlog.contextvars.merge_contextvars,
            # Adds "level": "info" to every log entry.
            structlog.processors.add_log_level,
            # Adds "timestamp": "2024-01-15T08:30:00Z" to every log entry.
            structlog.processors.TimeStamper(fmt="iso"),
            # In DEBUG: pretty colours in the terminal.
            # In production: compact JSON on one line.
            structlog.dev.ConsoleRenderer()
            if settings.log_level == "DEBUG"
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.log_level.upper(), logging.INFO)
        ),
        logger_factory=structlog.PrintLoggerFactory(),
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """
    Returns a logger bound to the given module name.
    Usage:
        logger = get_logger(__name__)
        logger.info("event_name", key="value", count=42)
    """
    return structlog.get_logger(name)
