"""data connections and per-source records

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-09

Adds data_connections, tags recovery_metrics with a source, and scopes the
activity de-duplication key per user.

0001 builds tables from the *current* model metadata, so on a fresh database
everything below already exists by the time this runs. Each step therefore
checks the live schema first and only applies what is missing.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW_RECOVERY_COLUMNS = [
    sa.Column("source", sa.String(), nullable=False, server_default="garmin"),
    sa.Column("hrv_sdnn", sa.Float()),
    sa.Column("weight_kg", sa.Float()),
    sa.Column("steps", sa.Integer()),
    sa.Column("ctl", sa.Float()),
    sa.Column("atl", sa.Float()),
]


def _unique_names(inspector, table):
    return {c["name"] for c in inspector.get_unique_constraints(table)}


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    if not inspector.has_table("data_connections"):
        op.create_table(
            "data_connections",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("provider", sa.String(), nullable=False),
            sa.Column("auth_type", sa.String(), nullable=False),
            sa.Column("external_athlete_id", sa.String()),
            sa.Column("encrypted_access_token", sa.String(), nullable=False),
            sa.Column("encrypted_refresh_token", sa.String()),
            sa.Column("token_expires_at", sa.DateTime(timezone=True)),
            sa.Column("scopes", sa.String()),
            sa.Column("last_sync_at", sa.DateTime(timezone=True)),
            sa.Column("last_sync_error", sa.String()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True)),
            sa.UniqueConstraint("user_id", "provider", name="uq_connection_user_provider"),
        )
        op.create_index("ix_data_connections_user_id", "data_connections", ["user_id"])

    existing = {c["name"] for c in inspector.get_columns("recovery_metrics")}
    for column in _NEW_RECOVERY_COLUMNS:
        if column.name not in existing:
            op.add_column("recovery_metrics", column)
    if "uq_recovery_user_source_date" not in _unique_names(inspector, "recovery_metrics"):
        op.create_unique_constraint(
            "uq_recovery_user_source_date", "recovery_metrics", ["user_id", "source", "date"]
        )

    activity_uniques = _unique_names(inspector, "activities")
    if "uq_activity_source_external_id" in activity_uniques:
        op.drop_constraint("uq_activity_source_external_id", "activities", type_="unique")
    if "uq_activity_user_source_external_id" not in activity_uniques:
        op.create_unique_constraint(
            "uq_activity_user_source_external_id", "activities", ["user_id", "source", "external_id"]
        )


def downgrade() -> None:
    op.drop_constraint("uq_activity_user_source_external_id", "activities", type_="unique")
    op.create_unique_constraint("uq_activity_source_external_id", "activities", ["source", "external_id"])
    op.drop_constraint("uq_recovery_user_source_date", "recovery_metrics", type_="unique")
    for column in reversed(_NEW_RECOVERY_COLUMNS):
        op.drop_column("recovery_metrics", column.name)
    op.drop_index("ix_data_connections_user_id", table_name="data_connections")
    op.drop_table("data_connections")
