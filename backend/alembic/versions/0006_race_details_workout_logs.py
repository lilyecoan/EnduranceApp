"""race-day details, training goal, workout logs

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-16

Adds more race types, race-page / race-day columns on race_events,
athlete_profiles.training_goal, and the workout_logs table. Like 0002-0005,
checks the live schema first because 0001 builds tables from current model
metadata.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW_RACE_TYPES = ("five_k", "ten_k", "ultramarathon", "other")

_RACE_COLUMNS = [
    sa.Column("race_url", sa.String()),
    sa.Column("start_time", sa.Time()),
    sa.Column("goal_finish_minutes", sa.Integer()),
    sa.Column("latitude", sa.Float()),
    sa.Column("longitude", sa.Float()),
    sa.Column("timezone", sa.String()),
    sa.Column("venue_elevation_m", sa.Float()),
    sa.Column("course_info", sa.JSON()),
    sa.Column("nutrition_plan", sa.JSON()),
    sa.Column("nutrition_plan_generated_at", sa.DateTime(timezone=True)),
]


def upgrade() -> None:
    # New enum values can't be added inside a transaction that later uses them.
    with op.get_context().autocommit_block():
        for value in _NEW_RACE_TYPES:
            op.execute(f"ALTER TYPE racedistance ADD VALUE IF NOT EXISTS '{value}'")

    inspector = sa.inspect(op.get_bind())

    race_columns = {c["name"] for c in inspector.get_columns("race_events")}
    for column in _RACE_COLUMNS:
        if column.name not in race_columns:
            op.add_column("race_events", column.copy())

    athlete_columns = {c["name"] for c in inspector.get_columns("athlete_profiles")}
    if "training_goal" not in athlete_columns:
        op.add_column("athlete_profiles", sa.Column("training_goal", sa.String(30)))

    if not inspector.has_table("workout_logs"):
        op.create_table(
            "workout_logs",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("slot", sa.String(20), nullable=False),
            sa.Column("sport", sa.String(20)),
            sa.Column("planned_name", sa.String()),
            sa.Column("planned_duration_min", sa.Float()),
            sa.Column("planned_distance_m", sa.Float()),
            sa.Column("planned_load", sa.Float()),
            sa.Column("status", sa.String(20), nullable=False),
            sa.Column("actual_duration_min", sa.Float()),
            sa.Column("actual_distance_m", sa.Float()),
            sa.Column("rpe", sa.Integer()),
            sa.Column("avg_hr", sa.Integer()),
            sa.Column("notes", sa.Text()),
            sa.Column("load", sa.Float(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True)),
            sa.UniqueConstraint("user_id", "date", "slot", name="uq_workout_log_user_date_slot"),
        )
        op.create_index("ix_workout_logs_user_id", "workout_logs", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_workout_logs_user_id", table_name="workout_logs")
    op.drop_table("workout_logs")
    op.drop_column("athlete_profiles", "training_goal")
    for column in reversed(_RACE_COLUMNS):
        op.drop_column("race_events", column.name)
    # Postgres can't drop enum values; the extra race types stay.
