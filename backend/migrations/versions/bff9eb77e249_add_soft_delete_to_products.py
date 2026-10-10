"""Add soft delete to products.

Revision ID: bff9eb77e249
Revises: 64720334fb45
Create Date: 2026-10-10
"""

from alembic import op
import sqlalchemy as sa


# Revision identifiers used by Alembic.
revision = "bff9eb77e249"
down_revision = "64720334fb45"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add a nullable deletion timestamp to products."""
    op.add_column(
        "products",
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Remove the deletion timestamp column."""
    op.drop_column("products", "deleted_at")