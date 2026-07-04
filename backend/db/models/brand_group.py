from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from backend.db.base import Base


class BrandGroup(Base):
    """Admin-managed brand groups (Sanstha, MMC Plus, ...).

    id is a slug derived from the label (e.g. "Holcim" -> "holcim") and is what
    Material.brand_group stores. sort_order preserves the original hardcoded
    list order for the seeded rows; new admin-created groups append after it.
    """
    __tablename__ = "brand_groups"

    id:         Mapped[str] = mapped_column(String, primary_key=True)
    label:      Mapped[str] = mapped_column(String, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
