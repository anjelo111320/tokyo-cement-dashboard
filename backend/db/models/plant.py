from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from backend.db.base import Base


class Plant(Base):
    __tablename__ = "plants"

    plant_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    city: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    customer_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    lat: Mapped[Optional[float]] = mapped_column(Numeric(10, 6), nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Numeric(10, 6), nullable=True)
    # factory | terminal | hq | depot
    plant_type: Mapped[str] = mapped_column(String, nullable=False, default="depot")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # True only when auto-discovered from a CSV plant_id never seen before
    # (seed_reference.py). False for admin-created plants and pre-existing
    # rows. Admin panel highlights is_new=True rows; any edit clears it.
    is_new: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
