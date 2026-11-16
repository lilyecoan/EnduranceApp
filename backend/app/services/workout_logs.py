"""The athlete's own logs (workouts, daily check-ins), summarized for the AI coach."""
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recovery import RecoveryMetric
from app.models.workout_log import WorkoutLog


async def recent_log_notes(db: AsyncSession, user_id, days: int = 7) -> Optional[str]:
    """The athlete's last week of logged sessions, summarized for the AI coach."""
    result = await db.execute(
        select(WorkoutLog)
        .where(WorkoutLog.user_id == user_id, WorkoutLog.date >= date.today() - timedelta(days=days))
        .order_by(WorkoutLog.date)
    )
    lines = []
    for log in result.scalars():
        bits = [f"{log.date.isoformat()} {log.planned_name or log.sport or 'session'}: {log.status}"]
        if log.actual_duration_min:
            bits.append(f"{round(log.actual_duration_min)} min")
        if log.actual_distance_m:
            bits.append(f"{round(log.actual_distance_m / 1000, 1)} km")
        if log.rpe:
            bits.append(f"RPE {log.rpe}/10")
        bits.append(f"load {round(log.load)} (planned {round(log.planned_load or 0)})")
        if log.notes:
            bits.append(f'notes: "{log.notes[:300]}"')
        lines.append(", ".join(bits))
    return "\n".join(lines) or None


async def recent_checkin_summary(db: AsyncSession, user_id, days: int = 3) -> Optional[str]:
    """The last few check-ins in plain words, for the AI coach."""
    result = await db.execute(
        select(RecoveryMetric)
        .where(RecoveryMetric.user_id == user_id, RecoveryMetric.source == "manual",
               RecoveryMetric.date >= date.today() - timedelta(days=days))
        .order_by(RecoveryMetric.date)
    )
    lines = []
    for r in result.scalars():
        bits = [r.date.isoformat()]
        for label, value in (("sleep quality", r.sleep_quality), ("soreness", r.soreness), ("energy", r.energy)):
            if value:
                bits.append(f"{label} {value}/5")
        if r.sleep_duration_seconds:
            bits.append(f"slept {round(r.sleep_duration_seconds / 3600, 1)} h")
        if r.resting_hr:
            bits.append(f"resting HR {r.resting_hr}")
        if r.hrv_rmssd:
            bits.append(f"HRV {round(r.hrv_rmssd)} ms")
        if r.checkin_notes:
            bits.append(f'notes: "{r.checkin_notes[:300]}"')
        lines.append(", ".join(bits))
    return "\n".join(lines) or None
