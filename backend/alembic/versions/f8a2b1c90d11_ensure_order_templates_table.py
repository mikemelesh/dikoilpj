"""ensure order_templates exists (repair empty d2eff6493d07 on deployed DBs)"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "f8a2b1c90d11"
down_revision = "177977aba067"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "order_templates" in inspector.get_table_names():
        return

    op.create_table(
        "order_templates",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("items", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_order_templates_client_id", "order_templates", ["client_id"])
    op.create_index("ix_order_templates_name", "order_templates", ["name"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "order_templates" not in inspector.get_table_names():
        return
    op.drop_index("ix_order_templates_name", table_name="order_templates")
    op.drop_index("ix_order_templates_client_id", table_name="order_templates")
    op.drop_table("order_templates")
