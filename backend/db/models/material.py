from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from backend.db.base import Base


class Material(Base):
    __tablename__ = "materials"

    material_id: Mapped[str] = mapped_column(String, primary_key=True)
    description: Mapped[str] = mapped_column(String, nullable=False)
    brand_group: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_bag: Mapped[bool] = mapped_column(Boolean, default=True)
    is_bulk: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # True only when auto-discovered from a CSV material_id never seen before
    # (seed_reference.py / materials/sync). False for admin-created materials
    # and pre-existing rows. Admin panel highlights is_new=True rows; any
    # edit clears it.
    is_new: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
