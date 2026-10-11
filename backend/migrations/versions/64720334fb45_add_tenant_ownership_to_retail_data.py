"""Add tenant ownership to retail data.

Revision ID: 64720334fb45
Revises: f0d4b40e7c09
"""

from alembic import op
import sqlalchemy as sa


revision = "64720334fb45"
down_revision = "f0d4b40e7c09"
branch_labels = None
depends_on = None


TABLES = (
    "categories",
    "products",
    "stores",
    "inventory",
    "stock_movements",
    "suppliers",
    "supplier_products",
    "sales_orders",
    "sales_items",
    "purchase_order_items",
)


def upgrade() -> None:
    # Add nullable columns so existing records remain valid.
    for table in TABLES:
        op.add_column(
            table,
            sa.Column("tenant_id", sa.String(length=100), nullable=True),
        )

    # Preserve existing records under the demo tenant.
    for table in TABLES:
        op.execute(
            sa.text(
                f'UPDATE "{table}" '
                "SET tenant_id = 'demo' WHERE tenant_id IS NULL"
            )
        )

    # Enforce ownership after backfilling.
    for table in TABLES:
        op.alter_column(
            table,
            "tenant_id",
            existing_type=sa.String(length=100),
            nullable=False,
        )

    # Remove global uniqueness from identifiers that are tenant-scoped.
    op.drop_constraint(
        "categories_name_key", "categories", type_="unique"
    )
    op.drop_index("ix_products_sku", table_name="products")
    op.drop_constraint(
        "stores_code_key", "stores", type_="unique"
    )
    op.drop_constraint(
        "sales_orders_order_number_key",
        "sales_orders",
        type_="unique",
    )
    op.drop_constraint(
        "purchase_orders_order_number_key",
        "purchase_orders",
        type_="unique",
    )

    # Enforce uniqueness within each tenant.
    op.create_unique_constraint(
        "uq_categories_tenant_name",
        "categories",
        ["tenant_id", "name"],
    )
    op.create_unique_constraint(
        "uq_products_tenant_sku",
        "products",
        ["tenant_id", "sku"],
    )
    op.create_unique_constraint(
        "uq_stores_tenant_code",
        "stores",
        ["tenant_id", "code"],
    )
    op.create_unique_constraint(
        "uq_sales_orders_tenant_order_number",
        "sales_orders",
        ["tenant_id", "order_number"],
    )
    op.create_unique_constraint(
        "uq_purchase_orders_tenant_order_number",
        "purchase_orders",
        ["tenant_id", "order_number"],
    )

    # Indexes for common tenant-scoped queries.
    op.create_index(
        "ix_products_tenant_id",
        "products",
        ["tenant_id"],
    )
    op.create_index(
        "ix_stores_tenant_id",
        "stores",
        ["tenant_id"],
    )
    op.create_index(
        "ix_inventory_tenant_store_product",
        "inventory",
        ["tenant_id", "store_id", "product_id"],
    )
    op.create_index(
        "ix_sales_orders_tenant_sold_at",
        "sales_orders",
        ["tenant_id", "sold_at"],
    )


def downgrade() -> None:
    # Remove indexes created by this migration.
    op.drop_index(
        "ix_sales_orders_tenant_sold_at",
        table_name="sales_orders",
    )
    op.drop_index(
        "ix_inventory_tenant_store_product",
        table_name="inventory",
    )
    op.drop_index(
        "ix_stores_tenant_id",
        table_name="stores",
    )
    op.drop_index(
        "ix_products_tenant_id",
        table_name="products",
    )

    # Remove tenant-scoped uniqueness.
    op.drop_constraint(
        "uq_purchase_orders_tenant_order_number",
        "purchase_orders",
        type_="unique",
    )
    op.drop_constraint(
        "uq_sales_orders_tenant_order_number",
        "sales_orders",
        type_="unique",
    )
    op.drop_constraint(
        "uq_stores_tenant_code",
        "stores",
        type_="unique",
    )
    op.drop_constraint(
        "uq_products_tenant_sku",
        "products",
        type_="unique",
    )
    op.drop_constraint(
        "uq_categories_tenant_name",
        "categories",
        type_="unique",
    )

    # Restore original global uniqueness.
    op.create_unique_constraint(
        "categories_name_key",
        "categories",
        ["name"],
    )
    op.create_index(
        "ix_products_sku",
        "products",
        ["sku"],
        unique=True,
    )
    op.create_unique_constraint(
        "stores_code_key",
        "stores",
        ["code"],
    )
    op.create_unique_constraint(
        "sales_orders_order_number_key",
        "sales_orders",
        ["order_number"],
    )
    op.create_unique_constraint(
        "purchase_orders_order_number_key",
        "purchase_orders",
        ["order_number"],
    )

    # Remove ownership columns last.
    for table in reversed(TABLES):
        op.drop_column(table, "tenant_id")