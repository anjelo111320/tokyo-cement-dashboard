"""add csv_datasets table

Admin-uploaded inventory CSVs, stored whole in the DB (library model).
At most one is active; it overrides the bundled sample CSV for the whole
dashboard until deactivated or deleted.

Revision ID: d5e8f1a4b7c2
Revises: c9d2e5f8a1b4
Create Date: 2026-07-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd5e8f1a4b7c2'
down_revision: Union[str, None] = 'c9d2e5f8a1b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'csv_datasets',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('row_count', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('uploaded_by', sa.Uuid(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('csv_datasets')
