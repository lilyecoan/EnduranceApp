from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.state import AgentState, AthleteContext
from app.agents.head_coach import HeadCoachGraph
from app.core.config import settings
from app.core.security import get_current_user
from app.db.base import get_db
from app.models.race import RaceEvent
from app.models.recommendation import Recommendation
from app.models.training import Workout
from app.models.user import User
from app.services.garmin_service import get_garmin_service
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


async def _load_scheduled_workout(db: AsyncSession, current_user: User) -> Optional[dict]:
    """Look up today's planned Workout, if any, for nutrition/diabetes agents.

    There's no scheduling UI in Phase 1 (that's Phase 2's planner), so this
    will usually be empty — the point is that "no scheduled workout" is now
    an honest, explicit lookup result instead of always-empty fields the
    Garmin service silently never populated.
    """
    result = await db.execute(
        select(Workout).where(
            Workout.user_id == current_user.id,
            Workout.scheduled_date == date.today(),
        )
    )
    workout = result.scalars().first()
    if workout is None:
        return None
    return {
        "sport": workout.sport_type,
        "duration_min": workout.planned_duration_minutes or 0,
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
    garmin = get_garmin_service(settings.garmin_email, settings.garmin_password)
    garmin_data = await garmin.get_daily_snapshot()

    ctx = await _build_athlete_context(req, db, current_user)
    scheduled_workout = await _load_scheduled_workout(db, current_user)

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
        db.add(
            Recommendation(
                user_id=current_user.id,
                date=plan.date,
                type="general",
                summary=plan.today_recommendation,
                supporting_metrics=plan.model_dump(mode="json"),
                confidence=plan.confidence,
                agent_source="head_coach",
            )
        )
        await db.commit()

    return {
        "plan": plan.model_dump(mode="json") if plan else None,
        "errors": result.get("errors", []),
        "garmin_source": garmin_data.get("source", "unknown"),
    }


@router.get("/garmin/snapshot")
async def get_garmin_snapshot(current_user: User = Depends(get_current_user)):
    """Return the raw Garmin data snapshot for the dashboard (demo/fixture source in Phase 1)."""
    garmin = get_garmin_service(settings.garmin_email, settings.garmin_password)
    return await garmin.get_daily_snapshot()
