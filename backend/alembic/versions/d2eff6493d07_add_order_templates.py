"""Generic Alembic migration script."""

from alembic import op
import sqlalchemy as sa

revision = 'd2eff6493d07'
down_revision = '236f64c8447c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

