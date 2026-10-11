
"""Add tenant ownership to purchase orders.

Revision ID: f0d4b40e7c09
Revises: 2b07b030623d
"""

from alembic import op
import sqlalchemy as sa


revision = "f0d4b40e7c09"
down_revision = "2b07b030623d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add as nullable first so existing orders remain valid.
    op.add_column(
        "purchase_orders",
        sa.Column("tenant_id", sa.String(length=100), nullable=True),
    )

    # Existing demo records belong to the explicitly designated demo tenant.
    op.execute(
        "UPDATE purchase_orders SET tenant_id = 'demo' WHERE tenant_id IS NULL"
    )

    # All rows now have an owner; enforce ownership going forward.
    op.alter_column(
        "purchase_orders",
        "tenant_id",
        existing_type=sa.String(length=100),
        nullable=False,
    )

    op.create_index(
        "ix_purchase_orders_tenant_id",
        "purchase_orders",
        ["tenant_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_purchase_orders_tenant_id",
        table_name="purchase_orders",
    )
    op.drop_column("purchase_orders", "tenant_id")
