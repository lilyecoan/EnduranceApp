"""display units preference

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-09

Adds users.units ("imperial" | "metric"). Checks the live schema first,
like 0002-0004, because 0001 builds tables from current model metadata.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("users")}
    if "units" not in columns:
        op.add_column("users", sa.Column("units", sa.String(), nullable=False, server_default="imperial"))


def downgrade() -> None:
    op.drop_column("users", "units")
