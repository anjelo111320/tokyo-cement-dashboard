"""
core/middleware.py — HTTP Middleware
======================================
Middleware sits between the client request and the route handler.
Every request passes through middleware before reaching a route,
and every response passes back through it before returning to the client.

This module provides two middleware pieces:

1. TimingMiddleware — measures how long each request takes and adds
   the result as the X-Process-Time-Ms response header. Useful for
   performance monitoring without needing an external APM tool.

2. add_cors() — configures CORS (Cross-Origin Resource Sharing) so the
   React frontend (running on a different port/domain) is allowed to
   call this API. Without CORS, browsers block cross-origin requests.

Request flow:
  Browser → TimingMiddleware → CORS check → Route Handler
  Browser ← TimingMiddleware ← Response (with timing header added)

Used by:
  main.py → add_cors(app) and app.add_middleware(TimingMiddleware)

Depends on:
  core/config.py → settings.allowed_origins
  core/logging.py → logger for request logging
"""

import time
from fastapi import Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from backend.core.config import settings
from backend.core.logging import get_logger

logger = get_logger(__name__)


class TimingMiddleware(BaseHTTPMiddleware):
    """
    Measures the wall-clock time of every HTTP request and records it in:
      - The X-Process-Time-Ms response header (visible to the client).
      - A DEBUG log line (visible in server logs).

    Example header: X-Process-Time-Ms: 42.18
    """

    async def dispatch(self, request: Request, call_next: object) -> Response:
        start = time.perf_counter()

        # call_next runs the actual route handler and returns the response.
        response: Response = await call_next(request)  # type: ignore[arg-type]

        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        # Attach timing to the response so frontend devtools can show it.
        response.headers["X-Process-Time-Ms"] = str(duration_ms)

        logger.debug(
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
        )
        return response


def add_cors(app: object) -> None:
    """
    Adds CORS middleware to the FastAPI app.

    allowed_origins comes from settings (config.py), so you can easily
    add new origins (e.g. your Vercel deployment URL) without touching code:
        ALLOWED_ORIGINS=["https://concreteops.vercel.app"]

    allow_credentials=True is needed if you later add JWT cookie auth.
    allow_methods/allow_headers=["*"] permits all — restrict in production
    if you want tighter security.
    """
    app.add_middleware(  # type: ignore[attr-defined]
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
