"""Generic Alembic migration script."""

from alembic import op
import sqlalchemy as sa

revision = 'dc833d8d76bf'
down_revision = 'd2eff6493d07'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type
    client_type = sa.Enum('physical', 'legal', name='client_type_enum')
    client_type.create(op.get_bind())
    # Add column to clients table
    op.add_column('clients', sa.Column('client_type', client_type, server_default='physical', nullable=False))


def downgrade() -> None:
    op.drop_column('clients', 'client_type')
    client_type = sa.Enum('physical', 'legal', name='client_type_enum')
    client_type.drop(op.get_bind())

