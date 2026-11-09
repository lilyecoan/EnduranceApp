"""user onboarding completion

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-09

Adds users.onboarding_completed_at. Like 0002, checks the live schema
first because 0001 builds tables from current model metadata.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("users")}
    if "onboarding_completed_at" not in columns:
        op.add_column("users", sa.Column("onboarding_completed_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("users", "onboarding_completed_at")
