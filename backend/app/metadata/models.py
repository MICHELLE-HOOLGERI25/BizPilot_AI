from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Index, JSON, String, Text, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class MetadataEntry(Base):
    """Registry for discoverable UI and data capabilities."""

    __tablename__ = "metadata_registry"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "kind", "key",
            name="uq_metadata_registry_tenant_kind_key",
        ),
        Index("ix_metadata_registry_tenant_kind", "tenant_id", "kind"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, default="demo", index=True
    )
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    key: Mapped[str] = mapped_column(String(160), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    parent_key: Mapped[str | None] = mapped_column(
        String(160), nullable=True
    )
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
