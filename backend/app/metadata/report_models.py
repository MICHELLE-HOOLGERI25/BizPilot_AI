from datetime import datetime, timezone
from sqlalchemy import DateTime, Index, JSON, String
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base

class SavedMetadataReport(Base):
    __tablename__ = "metadata_reports"
    __table_args__ = (Index("ix_metadata_reports_tenant", "tenant_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    spec: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
