"""Daily wellness snapshot for the dashboard and coaching agents.

Built from the athlete's own synced/uploaded RecoveryMetric rows when they
exist ("live"); otherwise returns the static demo fixture ("demo"). It never
falls back to the shared GARMIN_EMAIL login: that is one real person's
account, and serving it to other athletes would leak their data. Keys match
the GarminService snapshot the agents already read.
Values a source doesn't provide stay None — nothing is filled in.
"""
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recovery import RecoveryMetric
from app.models.user import User
from app.services.garmin_service import demo_snapshot
from app.services.sources import AI_EXCLUDED_SOURCES

_LOOKBACK_DAYS = 14
# Prefer the API-synced source when several report the same day.
_SOURCE_PRIORITY = {"intervals_icu": 0, "file_upload": 1}

_SNAPSHOT_KEYS = (
    "hrv_rmssd", "hrv_baseline", "hrv_5day_avg", "hrv_status", "sleep_score",
    "sleep_duration_seconds", "body_battery_morning", "body_battery_high", "stress_avg",
    "training_readiness_score", "recovery_time_hours", "ctl", "atl", "tsb",
    "acute_chronic_ratio", "acute_load", "vo2_max", "ftp", "resting_hr", "weight_kg",
)


def _latest(rows: list[RecoveryMetric], field: str):
    """Most recent non-null value of `field` (rows sorted newest first)."""
    for row in rows:
        value = getattr(row, field, None)
        if value is not None:
            return value, row
    return None, None


async def build_snapshot(db: AsyncSession, user: User) -> dict:
    since = date.today() - timedelta(days=_LOOKBACK_DAYS)
    result = await db.execute(
        select(RecoveryMetric).where(
            RecoveryMetric.user_id == user.id,
            RecoveryMetric.date >= since,
            RecoveryMetric.source.not_in(AI_EXCLUDED_SOURCES),
        )
    )
    rows = sorted(
        result.scalars().all(),
        key=lambda r: (r.date, -_SOURCE_PRIORITY.get(r.source, 9)),
        reverse=True,
    )
    if not rows:
        return demo_snapshot()

    snapshot: dict = dict.fromkeys(_SNAPSHOT_KEYS)
    for field in ("hrv_rmssd", "sleep_score", "sleep_duration_seconds", "training_readiness_score",
                  "resting_hr", "weight_kg", "ctl", "atl"):
        snapshot[field], _ = _latest(rows, field)

    # 5-day trailing mean of rMSSD, from distinct days only.
    recent_hrv = {}
    for row in rows:
        if row.hrv_rmssd is not None and row.date not in recent_hrv:
            recent_hrv[row.date] = row.hrv_rmssd
    last5 = sorted(recent_hrv)[-5:]
    if last5:
        snapshot["hrv_5day_avg"] = round(sum(recent_hrv[d] for d in last5) / len(last5), 1)

    if snapshot["ctl"] is not None and snapshot["atl"] is not None:
        snapshot["tsb"] = round(snapshot["ctl"] - snapshot["atl"], 1)

    _, newest = _latest(rows, "date")
    snapshot["source"] = "live"
    snapshot["data_source"] = newest.source if newest else None
    snapshot["data_date"] = newest.date.isoformat() if newest else None
    return snapshot
