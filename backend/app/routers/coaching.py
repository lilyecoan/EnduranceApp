from fastapi import APIRouter, Depends
from datetime import date
from pydantic import BaseModel
from typing import Optional

from app.agents.state import AgentState, AthleteContext
from app.agents.head_coach import HeadCoachGraph
from app.services.garmin_service import get_garmin_service
from app.core.config import settings

router = APIRouter(prefix="/coaching", tags=["coaching"])


class RunCoachRequest(BaseModel):
    user_id: str = "demo"
    age: Optional[int] = 32
    weight_kg: Optional[float] = 72.0
    ftp_watts: Optional[float] = None
    vo2_max: Optional[float] = None
    has_type1_diabetes: bool = False
    race_date: Optional[date] = None
    race_distance: Optional[str] = "half_iron"
    weeks_to_race: Optional[int] = None


@router.post("/run")
async def run_coaching_pipeline(req: RunCoachRequest):
    """Execute the full multi-agent coaching pipeline and return today's plan."""
    garmin = get_garmin_service(settings.garmin_email, settings.garmin_password)
    garmin_data = await garmin.get_daily_snapshot()

    weeks = req.weeks_to_race
    if req.race_date and weeks is None:
        delta = (req.race_date - date.today()).days
        weeks = max(0, delta // 7)

    ctx = AthleteContext(
        user_id=req.user_id,
        age=req.age,
        weight_kg=req.weight_kg,
        ftp_watts=req.ftp_watts,
        vo2_max=req.vo2_max,
        has_type1_diabetes=req.has_type1_diabetes,
        race_date=req.race_date,
        race_distance=req.race_distance,
        weeks_to_race=weeks,
    )

    initial_state: AgentState = {
        "athlete_context": ctx,
        "garmin_data": garmin_data,
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

    result = HeadCoachGraph.invoke(initial_state)
    plan = result.get("coaching_plan")

    return {
        "plan": plan.model_dump() if plan else None,
        "errors": result.get("errors", []),
        "garmin_connected": bool(settings.garmin_email),
    }


@router.get("/garmin/snapshot")
async def get_garmin_snapshot():
    """Return raw Garmin data snapshot for the dashboard."""
    garmin = get_garmin_service(settings.garmin_email, settings.garmin_password)
    data = await garmin.get_daily_snapshot()
    return data
