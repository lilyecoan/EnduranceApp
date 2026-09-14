from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.base import get_db
from app.models.race import RaceEvent
from app.models.user import User
from app.services.profile_service import (
    get_or_create_athlete_profile,
    get_or_create_medical_profile,
)

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
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
    has_type1_diabetes: Optional[bool] = None


class ProfileResponse(BaseModel):
    is_complete: bool
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
    if "has_type1_diabetes" in updates:
        medical.has_type1_diabetes = updates["has_type1_diabetes"]

    await db.commit()
    return await _build_response(db, current_user)
