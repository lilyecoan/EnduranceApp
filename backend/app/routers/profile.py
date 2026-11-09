from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.base import get_db
from app.models.race import RaceEvent
from app.models.user import User
from app.services.health_profile import detect_type1_diabetes
from app.services.profile_service import (
    get_or_create_athlete_profile,
    get_or_create_medical_profile,
)

router = APIRouter(prefix="/profile", tags=["profile"])


Units = Literal["imperial", "metric"]


class ProfileUpdate(BaseModel):
    units: Optional[Units] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    ftp_watts: Optional[float] = None
    vo2_max: Optional[float] = None
    lactate_threshold_hr: Optional[int] = None
    max_hr: Optional[int] = None
    resting_hr: Optional[int] = None
    swim_pace_per_100m: Optional[float] = None
    run_threshold_pace: Optional[float] = None
    chronic_conditions: Optional[str] = Field(default=None, max_length=2000)
    injuries: Optional[str] = Field(default=None, max_length=2000)
    dietary_restrictions: Optional[str] = Field(default=None, max_length=2000)


class ProfileResponse(BaseModel):
    is_complete: bool
    onboarding_completed: bool = False
    units: Units = "imperial"
    full_name: Optional[str] = None
    email: str
    age: Optional[int] = None
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    ftp_watts: Optional[float] = None
    vo2_max: Optional[float] = None
    lactate_threshold_hr: Optional[int] = None
    max_hr: Optional[int] = None
    resting_hr: Optional[int] = None
    swim_pace_per_100m: Optional[float] = None
    run_threshold_pace: Optional[float] = None
    has_type1_diabetes: bool = False
    chronic_conditions: Optional[str] = None
    injuries: Optional[str] = None
    dietary_restrictions: Optional[str] = None
    primary_race_name: Optional[str] = None
    primary_race_date: Optional[str] = None
    primary_race_distance: Optional[str] = None


ATHLETE_FIELDS = (
    "age",
    "gender",
    "weight_kg",
    "height_cm",
    "ftp_watts",
    "vo2_max",
    "lactate_threshold_hr",
    "max_hr",
    "resting_hr",
    "swim_pace_per_100m",
    "run_threshold_pace",
)


MEDICAL_TEXT_FIELDS = ("chronic_conditions", "injuries", "dietary_restrictions")


def _is_complete(athlete) -> bool:
    return athlete.age is not None and athlete.weight_kg is not None


async def _build_response(db: AsyncSession, current_user: User) -> ProfileResponse:
    athlete = await get_or_create_athlete_profile(db, current_user)
    medical = await get_or_create_medical_profile(db, current_user)
    result = await db.execute(
        select(RaceEvent).where(
            RaceEvent.user_id == current_user.id, RaceEvent.is_primary.is_(True)
        )
    )
    race = result.scalars().first()
    return ProfileResponse(
        is_complete=_is_complete(athlete),
        onboarding_completed=current_user.onboarding_completed_at is not None,
        units=current_user.units or "imperial",
        full_name=current_user.full_name,
        email=current_user.email,
        age=athlete.age,
        gender=athlete.gender,
        weight_kg=athlete.weight_kg,
        height_cm=athlete.height_cm,
        ftp_watts=athlete.ftp_watts,
        vo2_max=athlete.vo2_max,
        lactate_threshold_hr=athlete.lactate_threshold_hr,
        max_hr=athlete.max_hr,
        resting_hr=athlete.resting_hr,
        swim_pace_per_100m=athlete.swim_pace_per_100m,
        run_threshold_pace=athlete.run_threshold_pace,
        has_type1_diabetes=medical.has_type1_diabetes,
        chronic_conditions=medical.chronic_conditions_text,
        injuries=medical.injuries_text,
        dietary_restrictions=medical.dietary_restrictions_text,
        primary_race_name=race.name if race else None,
        primary_race_date=race.race_date.isoformat() if race else None,
        primary_race_distance=race.distance.value if race else None,
    )


@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _build_response(db, current_user)


@router.patch("/me", response_model=ProfileResponse)
async def update_my_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    athlete = await get_or_create_athlete_profile(db, current_user)
    medical = await get_or_create_medical_profile(db, current_user)

    updates = payload.model_dump(exclude_unset=True)
    for field in ATHLETE_FIELDS:
        if field in updates:
            setattr(athlete, field, updates[field])
    for field in MEDICAL_TEXT_FIELDS:
        if field in updates:
            text = (updates[field] or "").strip()
            setattr(medical, f"{field}_text", text or None)
    if updates.get("units"):
        current_user.units = updates["units"]
    # T1D is detected from what the athlete wrote, not a separate toggle.
    if "chronic_conditions" in updates:
        medical.has_type1_diabetes = detect_type1_diabetes(medical.chronic_conditions_text)

    await db.commit()
    return await _build_response(db, current_user)


@router.post("/onboarding/complete", response_model=ProfileResponse)
async def complete_onboarding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark first-run onboarding done (finished or skipped) so it isn't shown again."""
    if current_user.onboarding_completed_at is None:
        current_user.onboarding_completed_at = datetime.now(timezone.utc)
        await db.commit()
    return await _build_response(db, current_user)
