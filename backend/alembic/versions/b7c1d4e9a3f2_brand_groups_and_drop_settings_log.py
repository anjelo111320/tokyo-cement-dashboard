"""add brand_groups table, seed defaults, drop app_settings + ingestion_log

Brand groups move from a hardcoded Python list to a real table so admins can
add new ones from the UI. Seeded with the same 9 groups + order the old
hardcoded _BRAND_GROUPS list used, so existing Material.brand_group values
(set by the CSV auto-classifier) keep matching without a data migration.

app_settings and ingestion_log are dropped as part of removing the admin
Settings and Ingest Logs tabs: neither had any reader/writer left in the
codebase (ingestion_log's insert helper was never called; app_settings'
get/set were only reachable through the tab being removed).

Revision ID: b7c1d4e9a3f2
Revises: f4a8b3c9d2e1
Create Date: 2026-07-04 00:00:00.000000

"""
from datetime import datetime, timezone
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b7c1d4e9a3f2'
down_revision: Union[str, None] = 'f4a8b3c9d2e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Mirrors the old _BRAND_GROUPS list in services/material_ledger_service.py.
_SEED_BRAND_GROUPS = [
    {"id": "sanstha",          "label": "Sanstha"},
    {"id": "mmc_plus",         "label": "MMC Plus"},
    {"id": "marine_composite", "label": "Marine Composite"},
    {"id": "mahamera",         "label": "Mahamera"},
    {"id": "rapid_flow",       "label": "Rapid Flow"},
    {"id": "extra",            "label": "Extra"},
    {"id": "supiri",           "label": "Supiri"},
    {"id": "ambuja",           "label": "Ambuja"},
    {"id": "fiberbond",        "label": "Fiberbond"},
]

brand_groups_table = sa.table(
    'brand_groups',
    sa.column('id', sa.String),
    sa.column('label', sa.String),
    sa.column('sort_order', sa.Integer),
    sa.column('created_at', sa.DateTime(timezone=True)),
)


def upgrade() -> None:
    op.create_table(
        'brand_groups',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    now = datetime.now(timezone.utc)
    op.bulk_insert(brand_groups_table, [
        {"id": g["id"], "label": g["label"], "sort_order": i, "created_at": now}
        for i, g in enumerate(_SEED_BRAND_GROUPS)
    ])

    op.drop_table('app_settings')
    op.drop_table('ingestion_log')


def downgrade() -> None:
    op.create_table(
        'ingestion_log',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('source', sa.String(), nullable=False),
        sa.Column('file_name', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('rows_loaded', sa.Integer(), nullable=True),
        sa.Column('error_msg', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'app_settings',
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('value', sa.String(), nullable=False),
        sa.Column('value_type', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
        sa.PrimaryKeyConstraint('key'),
    )
    op.drop_table('brand_groups')
