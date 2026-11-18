"""Gathers the athlete's real inputs, generates a week with plan_generator,
and stores it (TrainingPlan + Workout rows) so the week stays stable."""
import hashlib
import json
from datetime import date, datetime, time, timedelta, timezone
from statistics import mean
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.models.race import RaceEvent
from app.models.recovery import RecoveryMetric
from app.models.training import TrainingPhase, TrainingPlan, Workout, WorkoutType
from app.models.user import User
from app.models.workout_log import WorkoutLog
from app.services.plan_generator import PlanInputs, build_week
from app.services.profile_service import get_or_create_athlete_profile, get_or_create_medical_profile
from app.services.sources import AI_EXCLUDED_SOURCES
from app.services.workout_load import estimate_load

ACTIVITY_SPORT = {"swimming": "Swim", "cycling": "Bike", "running": "Run", "strength": "Strength"}


async def gather_inputs(db: AsyncSession, user: User, week_start: date, tz_offset_minutes: int = 0) -> PlanInputs:
    athlete = await get_or_create_athlete_profile(db, user)
    medical = await get_or_create_medical_profile(db, user)
    race = (await db.execute(
        select(RaceEvent).where(RaceEvent.user_id == user.id, RaceEvent.is_primary.is_(True))
    )).scalars().first()
    goal = athlete.training_goal or (race.distance.value if race else "general")

    # Recent load: the 4 weeks before this week, synced workouts plus the
    # athlete's own logs for sessions no synced workout covers.
    offset = timedelta(minutes=tz_offset_minutes)
    since = week_start - timedelta(days=28)
    acts = (await db.execute(
        select(Activity).where(
            Activity.user_id == user.id,
            Activity.start_time >= datetime.combine(since, time.min, tzinfo=timezone.utc) + offset,
            Activity.start_time < datetime.combine(week_start, time.min, tzinfo=timezone.utc) + offset,
            Activity.source.not_in(AI_EXCLUDED_SOURCES),
        )
    )).scalars().all()
    covered = set()
    total = 0.0
    for a in acts:
        local_day = (a.start_time - offset).date()
        covered.add((local_day, ACTIVITY_SPORT.get(a.sport_type.value if a.sport_type else "", "Other")))
        total += a.tss or estimate_load(actual_duration_min=(a.duration_seconds or 0) / 60)
    logs = (await db.execute(
        select(WorkoutLog).where(WorkoutLog.user_id == user.id, WorkoutLog.date >= since,
                                 WorkoutLog.date < week_start, WorkoutLog.status == "completed")
    )).scalars().all()
    total += sum(l.load for l in logs if (l.date, l.sport) not in covered)
    first_day = min([since + timedelta(days=28)] + [(a.start_time - offset).date() for a in acts] + [l.date for l in logs])
    days_of_data = max(7, (week_start - first_day).days)
    recent_weekly = total / days_of_data * 7 if total else None

    # Recovery: last 3 days vs the 2 weeks before.
    metrics = (await db.execute(
        select(RecoveryMetric).where(
            RecoveryMetric.user_id == user.id,
            RecoveryMetric.date >= week_start - timedelta(days=17),
            RecoveryMetric.date < week_start + timedelta(days=1),
            RecoveryMetric.source.not_in(AI_EXCLUDED_SOURCES),
        )
    )).scalars().all()
    recent_cut = week_start - timedelta(days=3)

    def avg(field: str, recent: bool) -> Optional[float]:
        vals = [getattr(m, field) for m in metrics if getattr(m, field) is not None and ((m.date >= recent_cut) == recent)]
        return mean(vals) if vals else None

    checkins = [m for m in metrics if m.source == "manual" and m.date >= recent_cut]
    ctl_rows = sorted((m for m in metrics if m.ctl is not None), key=lambda m: m.date)

    return PlanInputs(
        week_start=week_start,
        goal=goal,
        race_date=race.race_date if race else None,
        hours_available=athlete.weekly_hours_available,
        recent_weekly_load=recent_weekly,
        ctl=ctl_rows[-1].ctl if ctl_rows else None,
        ftp_watts=athlete.ftp_watts,
        run_threshold_pace=athlete.run_threshold_pace,
        swim_pace_per_100m=athlete.swim_pace_per_100m,
        max_hr=athlete.max_hr,
        injuries=medical.injuries_text or "",
        conditions=medical.chronic_conditions_text or "",
        has_type1_diabetes=bool(medical.has_type1_diabetes),
        resting_hr_recent=avg("resting_hr", True),
        resting_hr_baseline=avg("resting_hr", False),
        hrv_recent=avg("hrv_rmssd", True),
        hrv_baseline=avg("hrv_rmssd", False),
        worst_soreness=max((m.soreness for m in checkins if m.soreness), default=None),
        lowest_energy=min((m.energy for m in checkins if m.energy), default=None),
    )


def settings_key(inp: PlanInputs) -> str:
    """Fingerprint of what the athlete set (goal, race, zones, health notes);
    a change means the stored week is out of date."""
    keys = [inp.goal, inp.race_date, inp.hours_available, inp.ftp_watts, inp.run_threshold_pace,
            inp.swim_pace_per_100m, inp.max_hr, inp.injuries, inp.conditions, inp.has_type1_diabetes]
    return hashlib.sha256(json.dumps(keys, default=str).encode()).hexdigest()[:16]


async def _stored(db: AsyncSession, user: User, week_start: date) -> Optional[TrainingPlan]:
    return (await db.execute(
        select(TrainingPlan).where(TrainingPlan.user_id == user.id, TrainingPlan.start_date == week_start)
        .order_by(TrainingPlan.created_at.desc())
    )).scalars().first()


async def generate_and_store(db: AsyncSession, user: User, week_start: date, tz_offset_minutes: int = 0) -> TrainingPlan:
    inp = await gather_inputs(db, user, week_start, tz_offset_minutes)
    plan = build_week(inp)
    old = (await db.execute(
        select(TrainingPlan.id).where(TrainingPlan.user_id == user.id, TrainingPlan.start_date == week_start)
    )).scalars().all()
    if old:
        await db.execute(delete(Workout).where(Workout.training_plan_id.in_(old)))
        await db.execute(delete(TrainingPlan).where(TrainingPlan.id.in_(old)))

    row = TrainingPlan(
        user_id=user.id,
        name=f"{plan.phase_label} week",
        phase=TrainingPhase(plan.phase),
        week_number=plan.weeks_to_race,
        start_date=week_start,
        end_date=week_start + timedelta(days=6),
        total_planned_hours=plan.hours,
        total_planned_tss=plan.target_load,
        ai_generated=False,
        ai_reasoning=json.dumps({
            "phase_label": plan.phase_label, "recovery_week": plan.recovery_week,
            "readiness_factor": plan.readiness_factor, "reasons": plan.reasons, "notes": plan.notes,
            "settings_key": settings_key(inp),
            "inputs": {"recent_weekly_load": round(inp.recent_weekly_load) if inp.recent_weekly_load else None,
                       "ctl": round(inp.ctl, 1) if inp.ctl else None, "goal": inp.goal},
        }),
    )
    db.add(row)
    await db.flush()
    for s in plan.sessions:
        db.add(Workout(
            user_id=user.id,
            training_plan_id=row.id,
            scheduled_date=date.fromisoformat(s["date"]),
            sport_type=s["sport"],
            workout_type=WorkoutType(s["workout_type"]),
            name=s["name"],
            description=s["description"],
            planned_duration_minutes=s["duration_min"],
            planned_distance_km=s["distance_m"] / 1000 if s["distance_m"] else None,
            planned_tss=s["load"],
            target_zones={"slot": s["slot"], "intensity": s["intensity"], "kind": s["kind"]},
        ))
    await db.commit()
    return row


async def get_week(db: AsyncSession, user: User, week_start: date, tz_offset_minutes: int = 0) -> dict:
    row = await _stored(db, user, week_start)
    if row is None:
        row = await generate_and_store(db, user, week_start, tz_offset_minutes)
    workouts = (await db.execute(
        select(Workout).where(Workout.training_plan_id == row.id).order_by(Workout.scheduled_date)
    )).scalars().all()
    meta = json.loads(row.ai_reasoning or "{}")
    current_key = settings_key(await gather_inputs(db, user, week_start, tz_offset_minutes))
    return {
        "week_start": row.start_date.isoformat(),
        "phase": row.phase.value if row.phase else "base",
        "phase_label": meta.get("phase_label", ""),
        "weeks_to_race": row.week_number,
        "recovery_week": meta.get("recovery_week", False),
        "readiness_factor": meta.get("readiness_factor", 1.0),
        "planned_load": row.total_planned_tss,
        "planned_hours": row.total_planned_hours,
        "reasons": meta.get("reasons", []),
        "notes": meta.get("notes", []),
        "inputs": meta.get("inputs", {}),
        "generated_at": row.created_at.isoformat() if row.created_at else None,
        "stale": meta.get("settings_key") != current_key,
        "sessions": [
            {
                "id": str(w.id),
                "date": w.scheduled_date.isoformat(),
                "slot": (w.target_zones or {}).get("slot", "main"),
                "sport": w.sport_type,
                "kind": (w.target_zones or {}).get("kind"),
                "name": w.name,
                "intensity": (w.target_zones or {}).get("intensity"),
                "duration_min": w.planned_duration_minutes,
                "distance_m": w.planned_distance_km * 1000 if w.planned_distance_km else None,
                "load": w.planned_tss,
                "description": w.description,
            }
            for w in sorted(workouts, key=lambda w: (w.scheduled_date, (w.target_zones or {}).get("slot") != "main"))
        ],
    }
