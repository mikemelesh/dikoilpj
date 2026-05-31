"""Generic Alembic migration script."""

from alembic import op
import sqlalchemy as sa

revision = '9254b434bd01'
down_revision = '1b51695e54f5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

