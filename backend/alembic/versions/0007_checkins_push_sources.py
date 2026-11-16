"""daily check-in fields on recovery_metrics

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-16

Adds the athlete's subjective daily check-in (sleep quality, soreness,
energy, notes). Like 0002-0006, checks the live schema first because 0001
builds tables from current model metadata.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS = [
    sa.Column("sleep_quality", sa.Integer()),
    sa.Column("soreness", sa.Integer()),
    sa.Column("energy", sa.Integer()),
    sa.Column("checkin_notes", sa.Text()),
]


def upgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("recovery_metrics")}
    for column in _COLUMNS:
        if column.name not in existing:
            op.add_column("recovery_metrics", column.copy())


def downgrade() -> None:
    for column in reversed(_COLUMNS):
        op.drop_column("recovery_metrics", column.name)
