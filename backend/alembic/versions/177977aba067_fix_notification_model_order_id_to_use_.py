"""Generic Alembic migration script."""

from alembic import op
import sqlalchemy as sa

revision = '177977aba067'
down_revision = '9254b434bd01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

