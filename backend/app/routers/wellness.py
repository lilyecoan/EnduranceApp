"""The athlete's daily check-in: numbers they read off their watch or scale,
plus how they feel. Works with no device connected at all."""
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.base import get_db
from app.models.recovery import RecoveryMetric
from app.models.user import User
from app.services import sync
from app.services.sources import AI_EXCLUDED_SOURCES

router = APIRouter(prefix="/wellness", tags=["wellness"])

SOURCE = "manual"
FIELDS = ("resting_hr", "hrv_rmssd", "sleep_duration_seconds", "weight_kg",
          "sleep_quality", "soreness", "energy", "checkin_notes")


class CheckIn(BaseModel):
    date: date
    resting_hr: Optional[int] = Field(default=None, ge=20, le=150)
    # rMSSD, as Garmin, WHOOP and Oura report it (Apple's SDNN isn't comparable).
    hrv_rmssd: Optional[float] = Field(default=None, ge=1, le=300)
    sleep_duration_seconds: Optional[int] = Field(default=None, ge=0, le=24 * 3600)
    weight_kg: Optional[float] = Field(default=None, ge=20, le=320)
    sleep_quality: Optional[int] = Field(default=None, ge=1, le=5)
    soreness: Optional[int] = Field(default=None, ge=1, le=5)
    energy: Optional[int] = Field(default=None, ge=1, le=5)
    checkin_notes: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("checkin_notes")
    @classmethod
    def _trim(cls, v: Optional[str]) -> Optional[str]:
        return (v or "").strip() or None

    @field_validator("date")
    @classmethod
    def _not_future(cls, v: date) -> date:
        if v > date.today() + timedelta(days=1):  # +1: athlete may be ahead of server time zone
            raise ValueError("Check-ins can't be in the future")
        return v


@router.get("/checkins", response_model=list[CheckIn])
async def list_checkins(
    days: int = Query(default=14, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RecoveryMetric)
        .where(RecoveryMetric.user_id == current_user.id, RecoveryMetric.source == SOURCE,
               RecoveryMetric.date >= date.today() - timedelta(days=days))
        .order_by(RecoveryMetric.date.desc())
    )
    return [CheckIn(date=r.date, **{f: getattr(r, f) for f in FIELDS}) for r in result.scalars()]


@router.put("/checkins", response_model=CheckIn)
async def save_checkin(
    payload: CheckIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or replace the check-in for one day."""
    values = payload.model_dump()
    if all(values[f] is None for f in FIELDS):
        raise HTTPException(status_code=400, detail="Fill in at least one field")
    await sync.upsert_recovery(db, current_user.id, SOURCE, [values])
    await db.commit()
    return payload



class HistoryDay(BaseModel):
    date: date
    resting_hr: Optional[int] = None
    hrv_rmssd: Optional[float] = None
    hrv_sdnn: Optional[float] = None
    sleep_hours: Optional[float] = None
    steps: Optional[int] = None
    ctl: Optional[float] = None
    atl: Optional[float] = None
    tsb: Optional[float] = None
    sleep_quality: Optional[int] = None
    energy: Optional[int] = None
    soreness: Optional[int] = None


# Same order the dashboard snapshot uses: the athlete's own check-in first.
_PRIORITY = {"manual": 0, "intervals_icu": 1, "health_auto_export": 2, "file_upload": 3}
_HISTORY_FIELDS = ("resting_hr", "hrv_rmssd", "hrv_sdnn", "steps", "ctl", "atl",
                   "sleep_quality", "energy", "soreness")


@router.get("/history", response_model=list[HistoryDay])
async def wellness_history(
    days: int = Query(default=30, ge=7, le=180),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """One row per day, each field taken from the highest-priority source that has it."""
    rows = (await db.execute(
        select(RecoveryMetric).where(
            RecoveryMetric.user_id == current_user.id,
            RecoveryMetric.date >= date.today() - timedelta(days=days),
            RecoveryMetric.source.not_in(AI_EXCLUDED_SOURCES),
        )
    )).scalars().all()
    by_day: dict[date, list[RecoveryMetric]] = {}
    for r in rows:
        by_day.setdefault(r.date, []).append(r)
    out = []
    for day in sorted(by_day):
        ranked = sorted(by_day[day], key=lambda r: _PRIORITY.get(r.source, 9))
        pick = lambda f: next((getattr(r, f) for r in ranked if getattr(r, f) is not None), None)  # noqa: E731
        values = {f: pick(f) for f in _HISTORY_FIELDS}
        sleep = pick("sleep_duration_seconds")
        values["sleep_hours"] = round(sleep / 3600, 2) if sleep else None
        if values["ctl"] is not None and values["atl"] is not None:
            values["tsb"] = round(values["ctl"] - values["atl"], 1)
        out.append(HistoryDay(date=day, **values))
    return out
