"""baseline schema

Revision ID: 0001
Revises:
Create Date: 2026-09-13

This is the first Alembic migration introduced into a repository that
previously had no migration tooling and no tables in any real database.
Rather than hand-transcribing every column of every model into
`op.create_table(...)` calls (error-prone and hard to verify without a
live database to diff against), this migration creates the schema
directly from the current SQLAlchemy model metadata, which is the
single source of truth for these tables. All future schema changes
should be made via `alembic revision --autogenerate` against a running
database so they get normal per-column migration diffs; this baseline
is the one deliberate exception.
"""
from typing import Sequence, Union

from alembic import op

from app.db.base import Base
import app.models  # noqa: F401  registers all model tables on Base.metadata

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
