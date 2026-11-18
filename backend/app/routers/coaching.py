import hashlib
import json
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.state import AgentState, AthleteContext
from app.agents.head_coach import HeadCoachGraph
from app.core.security import get_current_user
from app.db.base import get_db
from app.models.activity import Activity
from app.models.race import RaceEvent
from app.models.recommendation import Recommendation
from app.models.training import Workout
from app.models.user import User
from app.models.workout_log import WorkoutLog
from app.services.sources import AI_EXCLUDED_SOURCES
from app.services.snapshot import build_snapshot
from app.services.workout_logs import recent_checkin_summary, recent_log_notes
from app.services.profile_service import get_or_create_athlete_profile, get_or_create_medical_profile

router = APIRouter(prefix="/coaching", tags=["coaching"])


class RunCoachRequest(BaseModel):
    """Optional manual overrides for a coaching run.

    These are explicit "what-if" parameter overrides, not identity — the
    athlete is always derived from the authenticated session, never from
    the request body.
    """

    age: Optional[int] = None
    weight_kg: Optional[float] = None
    ftp_watts: Optional[float] = None
    vo2_max: Optional[float] = None
    race_date: Optional[date] = None
    race_distance: Optional[str] = None
    weeks_to_race: Optional[int] = None
    # Browser's Date.getTimezoneOffset() (minutes behind UTC), so "today"
    # means the athlete's day, not the server's.
    tz_offset_minutes: int = 0
    # Re-run the AI even if today's inputs haven't changed.
    force: bool = False


# A failed AI call is retried at most this often for unchanged inputs.
AI_RETRY_AFTER = timedelta(minutes=30)


def local_today(req: RunCoachRequest) -> date:
    offset = max(-14 * 60, min(14 * 60, req.tz_offset_minutes))
    return (datetime.now(timezone.utc) - timedelta(minutes=offset)).date()


async def _build_athlete_context(
    req: RunCoachRequest, db: AsyncSession, current_user: User
) -> AthleteContext:
    athlete = await get_or_create_athlete_profile(db, current_user)
    medical = await get_or_create_medical_profile(db, current_user)

    result = await db.execute(
        select(RaceEvent).where(
            RaceEvent.user_id == current_user.id, RaceEvent.is_primary.is_(True)
        )
    )
    primary_race = result.scalars().first()

    race_date = req.race_date or (primary_race.race_date if primary_race else None)
    race_distance = req.race_distance or (
        primary_race.distance.value if primary_race else None
    )

    weeks = req.weeks_to_race
    if race_date and weeks is None:
        delta = (race_date - date.today()).days
        weeks = max(0, delta // 7)

    return AthleteContext(
        user_id=str(current_user.id),
        age=req.age if req.age is not None else athlete.age,
        weight_kg=req.weight_kg if req.weight_kg is not None else athlete.weight_kg,
        ftp_watts=req.ftp_watts if req.ftp_watts is not None else athlete.ftp_watts,
        vo2_max=req.vo2_max if req.vo2_max is not None else athlete.vo2_max,
        lactate_threshold_hr=athlete.lactate_threshold_hr,
        max_hr=athlete.max_hr,
        swim_pace_per_100m=athlete.swim_pace_per_100m,
        run_threshold_pace=athlete.run_threshold_pace,
        has_type1_diabetes=medical.has_type1_diabetes,
        units=current_user.units or "imperial",
        chronic_conditions=medical.chronic_conditions_text,
        injuries=medical.injuries_text,
        dietary_restrictions=medical.dietary_restrictions_text,
        recent_workouts=await recent_log_notes(db, current_user.id),
        recent_checkins=await recent_checkin_summary(db, current_user.id),
        race_date=race_date,
        race_distance=race_distance,
        race_location=primary_race.location if primary_race else None,
        weeks_to_race=weeks,
    )


_WORKOUT_TYPE_TO_INTENSITY = {
    "intervals": "intervals",
    "race_simulation": "race_pace",
    "tempo": "high",
}


_PLAN_SPORT = {"Swim": "swimming", "Bike": "cycling", "Run": "running", "Strength": "strength", "Cross": "other"}


async def _load_scheduled_workout(db: AsyncSession, current_user: User, req: RunCoachRequest) -> Optional[dict]:
    """Today's session for the nutrition/diabetes agents: what the athlete
    actually did today (synced workouts and their own logs) if anything,
    otherwise today's planned session."""
    today = local_today(req)
    offset = timedelta(minutes=req.tz_offset_minutes)
    day_start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc) + offset
    acts = (await db.execute(
        select(Activity).where(
            Activity.user_id == current_user.id,
            Activity.start_time >= day_start,
            Activity.start_time < day_start + timedelta(days=1),
            Activity.source.not_in(AI_EXCLUDED_SOURCES),
        )
    )).scalars().all()
    logs = (await db.execute(
        select(WorkoutLog).where(WorkoutLog.user_id == current_user.id, WorkoutLog.date == today,
                                 WorkoutLog.status == "completed")
    )).scalars().all()
    sessions = [
        (a.sport_type.value if a.sport_type else "other", (a.duration_seconds or 0) / 60, a.tss) for a in acts
    ] + [(_PLAN_SPORT.get(l.sport or "", "other"), l.actual_duration_min or 0, l.load) for l in logs]
    if sessions:
        total_min = sum(s[1] for s in sessions)
        main = max(sessions, key=lambda s: s[1])
        load = sum(s[2] or 0 for s in sessions)
        # ~72 load per hour is roughly threshold-ish effort (IF 0.85).
        intensity = "high" if total_min and load / (total_min / 60) >= 72 else "moderate"
        return {"sport": main[0], "duration_min": round(total_min), "intensity": intensity, "actual": True}

    planned = (await db.execute(
        select(Workout).where(Workout.user_id == current_user.id, Workout.scheduled_date == today)
    )).scalars().all()
    if not planned:
        return None
    workout = max(planned, key=lambda w: w.planned_duration_minutes or 0)
    return {
        "sport": _PLAN_SPORT.get(workout.sport_type or "", workout.sport_type),
        "duration_min": sum(w.planned_duration_minutes or 0 for w in planned),
        "intensity": _WORKOUT_TYPE_TO_INTENSITY.get(
            workout.workout_type.value if workout.workout_type else "", "moderate"
        ),
    }


@router.post("/run")
async def run_coaching_pipeline(
    req: RunCoachRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute the full multi-agent coaching pipeline and return today's plan."""
    garmin_data = await build_snapshot(db, current_user)

    ctx = await _build_athlete_context(req, db, current_user)
    scheduled_workout = await _load_scheduled_workout(db, current_user, req)
    today = local_today(req)

    # The pipeline (and its AI call) only re-runs when its inputs change, so
    # opening several pages doesn't burn through the AI quota.
    inputs = hashlib.sha256(json.dumps(
        [today, garmin_data, ctx.model_dump(mode="json"), scheduled_workout], default=str, sort_keys=True
    ).encode()).hexdigest()
    if not req.force:
        cached = (await db.execute(
            select(Recommendation)
            .where(Recommendation.user_id == current_user.id, Recommendation.date == today,
                   Recommendation.agent_source == "head_coach")
            .order_by(Recommendation.created_at.desc())
            .limit(1)
        )).scalar_one_or_none()
        meta = (cached.supporting_metrics or {}).get("_cache", {}) if cached else {}
        fresh = cached is not None and meta.get("inputs") == inputs and (
            meta.get("ai_ok") or datetime.now(timezone.utc) - cached.created_at < AI_RETRY_AFTER
        )
        if fresh:
            plan_dict = {k: v for k, v in cached.supporting_metrics.items() if k != "_cache"}
            await db.commit()
            return {"plan": plan_dict, "errors": [], "garmin_source": garmin_data.get("source", "unknown"),
                    "cached": True}

    # End the read transaction before the slow AI pipeline so it doesn't hold
    # locks (an abandoned run once left one open for days, blocking migrations).
    await db.commit()

    initial_state: AgentState = {
        "athlete_context": ctx,
        "garmin_data": garmin_data,
        "scheduled_workout": scheduled_workout,
        "recovery_output": None,
        "training_load_output": None,
        "performance_output": None,
        "nutrition_output": None,
        "diabetes_output": None,
        "weather_output": None,
        "race_strategy_output": None,
        "coaching_plan": None,
        "errors": [],
    }

    result = await HeadCoachGraph.ainvoke(initial_state)
    plan = result.get("coaching_plan")

    if plan is not None:
        plan.date = today
        ai_ok = not any(m.startswith("AI coaching narrative unavailable") for m in plan.key_messages)
        db.add(
            Recommendation(
                user_id=current_user.id,
                date=today,
                type="general",
                summary=plan.today_recommendation,
                supporting_metrics={**plan.model_dump(mode="json"), "_cache": {"inputs": inputs, "ai_ok": ai_ok}},
                confidence=plan.confidence,
                agent_source="head_coach",
            )
        )
        await db.commit()

    return {
        "plan": plan.model_dump(mode="json") if plan else None,
        "errors": result.get("errors", []),
        "garmin_source": garmin_data.get("source", "unknown"),
        "cached": False,
    }


@router.get("/garmin/snapshot")
async def get_garmin_snapshot(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return today's wellness snapshot: the athlete's own synced/uploaded data
    when available ("live"), else the shared demo fixture ("demo")."""
    return await build_snapshot(db, current_user)
