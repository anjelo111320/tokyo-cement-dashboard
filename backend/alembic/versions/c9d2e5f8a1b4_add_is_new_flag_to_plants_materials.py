"""add is_new flag to plants and materials

Lets the admin panel highlight plants/materials that were auto-discovered
from a CSV plant_id/material_id never seen before, so an operator notices a
new SKU or location appeared instead of it silently blending into the list.
Existing rows get is_new=false via server_default (they aren't "new").

Revision ID: c9d2e5f8a1b4
Revises: b7c1d4e9a3f2
Create Date: 2026-07-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c9d2e5f8a1b4'
down_revision: Union[str, None] = 'b7c1d4e9a3f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('plants', sa.Column('is_new', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('materials', sa.Column('is_new', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('materials', 'is_new')
    op.drop_column('plants', 'is_new')
