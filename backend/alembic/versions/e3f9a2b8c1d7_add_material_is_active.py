"""add material is_active

Revision ID: e3f9a2b8c1d7
Revises: d9db91cfaaaf
Create Date: 2026-07-03 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e3f9a2b8c1d7'
down_revision: Union[str, None] = 'd9db91cfaaaf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('materials', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    op.drop_column('materials', 'is_active')
