import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Boolean, Integer, Text, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from backend.db.base import Base


class CsvDataset(Base):
    """An admin-uploaded inventory CSV, stored whole in the database.

    Datasets stay in the DB until an admin deletes them ("library" model).
    At most one row has is_active=True; that dataset is pinned into the CSV
    cache and drives the entire dashboard instead of the bundled sample file.
    Zero active rows = the bundled (repo/Docker image) CSV is in effect.

    content is the raw CSV text (~340 KB for the current export — well within
    what a TEXT column handles comfortably).
    """
    __tablename__ = "csv_datasets"

    id:          Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    filename:    Mapped[str] = mapped_column(String, nullable=False)
    content:     Mapped[str] = mapped_column(Text, nullable=False)
    row_count:   Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active:   Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    uploaded_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
