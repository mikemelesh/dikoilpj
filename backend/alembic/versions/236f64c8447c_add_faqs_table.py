"""add faqs table."""

from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = '236f64c8447c'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'faqs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('question', sa.String(length=500), nullable=False),
        sa.Column('answer', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, default=0),
        sa.Column('is_published', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime(), nullable=True, onupdate=datetime.utcnow),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_faqs_id'), 'faqs', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_faqs_id'), table_name='faqs')
    op.drop_table('faqs')

