"""Add metadata registry and saved report tables."""

from alembic import op
import sqlalchemy as sa

revision = "c91a7e4d2f60"
down_revision = "bff9eb77e249"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "metadata_registry",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.String(100), nullable=False, server_default="demo"),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("key", sa.String(160), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("parent_key", sa.String(160), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "tenant_id", "kind", "key",
            name="uq_metadata_registry_tenant_kind_key",
        ),
    )
    op.create_index(
        "ix_metadata_registry_tenant_id",
        "metadata_registry",
        ["tenant_id"],
    )
    op.create_index(
        "ix_metadata_registry_tenant_kind",
        "metadata_registry",
        ["tenant_id", "kind"],
    )
    op.create_table(
        "metadata_reports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(100), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("spec", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_metadata_reports_tenant",
        "metadata_reports",
        ["tenant_id"],
    )


def downgrade():
    op.drop_index("ix_metadata_reports_tenant", table_name="metadata_reports")
    op.drop_table("metadata_reports")
    op.drop_index("ix_metadata_registry_tenant_kind", table_name="metadata_registry")
    op.drop_index("ix_metadata_registry_tenant_id", table_name="metadata_registry")
    op.drop_table("metadata_registry")
