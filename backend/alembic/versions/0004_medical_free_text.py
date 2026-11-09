"""free-text chronic conditions, injuries, dietary restrictions

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-09

Like 0002/0003, checks the live schema first because 0001 builds tables
from current model metadata.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS = ("chronic_conditions_text", "injuries_text", "dietary_restrictions_text")


def upgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("medical_profiles")}
    for name in _COLUMNS:
        if name not in existing:
            op.add_column("medical_profiles", sa.Column(name, sa.Text()))


def downgrade() -> None:
    for name in reversed(_COLUMNS):
        op.drop_column("medical_profiles", name)
