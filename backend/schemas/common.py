"""
schemas/common.py — Shared API Response Envelopes
===================================================
Every API response is wrapped in a standard envelope so the frontend
always knows exactly what shape to expect. This prevents the frontend
from having to handle both raw data and error objects differently.

Standard success response:
  { "success": true, "data": <payload>, "meta": { "timestamp": "...", "source": "csv_cache" } }

Standard error response (from main.py exception handler):
  { "success": false, "error": { "code": "CSV_READ_ERROR", "message": "..." }, "meta": {...} }

Paginated response:
  { "success": true, "data": [...], "pagination": { "page": 1, "total_items": 180, ... }, "meta": {...} }

Generic types (T) let us write ApiResponse[DashboardKpis] or
PaginatedResponse[InventoryItemSchema] with full type safety.

Used by:
  Every api/v1/*.py endpoint as the response_model.
  schemas/dashboard.py, fleet.py, analytics.py etc. as a base.
"""

from datetime import datetime
from typing import Any, Generic, Optional, TypeVar
from pydantic import BaseModel, Field, ConfigDict

# T is the type of the `data` field — substituted at usage time.
T = TypeVar("T")


class ApiMeta(BaseModel):
    """Metadata attached to every API response."""
    # ISO 8601 UTC timestamp of when this response was generated.
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    # When the underlying data was last refreshed from the CSV files.
    data_freshness: Optional[str] = None
    # Where the data came from — "csv_cache" in Phase 1, "database" in Phase 2.
    source: str = "csv_cache"


class ApiResponse(BaseModel, Generic[T]):
    """
    Wraps any single-object response.
    Usage: ApiResponse[DashboardKpis](data=kpis_object)
    """
    success: bool = True
    data: T
    meta: ApiMeta = Field(default_factory=ApiMeta)


class ErrorDetail(BaseModel):
    """The error object inside an error response."""
    code: str             # Machine-readable: "CSV_READ_ERROR", "NOT_FOUND"…
    message: str          # Human-readable description shown in the UI.
    details: Optional[dict[str, Any]] = None  # Optional extra context.


class ErrorResponse(BaseModel):
    """Standard error envelope — produced by main.py's exception handler."""
    success: bool = False
    error: ErrorDetail
    meta: ApiMeta = Field(default_factory=ApiMeta)



