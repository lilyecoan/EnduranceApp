"""Workout logs: what the athlete actually did, in their own words."""
from datetime import date, timedelta
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.base import get_db
from app.models.user import User
from app.models.workout_log import WorkoutLog
from app.services.workout_load import estimate_load

router = APIRouter(prefix="/training", tags=["training"])

MAX_RANGE_DAYS = 120


class WorkoutLogIn(BaseModel):
    date: date
    slot: str = Field(default="main", pattern=r"^(main|strength|extra)$")
    sport: Optional[str] = Field(default=None, max_length=20)
    planned_name: Optional[str] = Field(default=None, max_length=200)
    planned_duration_min: Optional[float] = Field(default=None, ge=0, le=1440)
    planned_distance_m: Optional[float] = Field(default=None, ge=0, le=500_000)
    planned_load: Optional[float] = Field(default=None, ge=0, le=1000)
    status: Literal["completed", "skipped"] = "completed"
    actual_duration_min: Optional[float] = Field(default=None, ge=0, le=1440)
    actual_distance_m: Optional[float] = Field(default=None, ge=0, le=500_000)
    rpe: Optional[int] = Field(default=None, ge=1, le=10)
    avg_hr: Optional[int] = Field(default=None, ge=30, le=250)
    notes: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("notes")
    @classmethod
    def _trim(cls, v: Optional[str]) -> Optional[str]:
        return (v or "").strip() or None


class WorkoutLogOut(WorkoutLogIn):
    id: UUID
    load: float

    model_config = {"from_attributes": True}


@router.get("/logs", response_model=list[WorkoutLogOut])
async def list_logs(
    start: date = Query(...),
    end: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if end < start or (end - start) > timedelta(days=MAX_RANGE_DAYS):
        raise HTTPException(status_code=400, detail=f"Range must be 0-{MAX_RANGE_DAYS} days")
    result = await db.execute(
        select(WorkoutLog)
        .where(WorkoutLog.user_id == current_user.id, WorkoutLog.date >= start, WorkoutLog.date <= end)
        .order_by(WorkoutLog.date, WorkoutLog.slot)
    )
    return result.scalars().all()


@router.put("/logs", response_model=WorkoutLogOut)
async def save_log(
    payload: WorkoutLogIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or replace the log for one session (one per day + slot)."""
    values = payload.model_dump()
    values["load"] = estimate_load(
        status=payload.status,
        planned_load=payload.planned_load,
        planned_duration_min=payload.planned_duration_min,
        planned_distance_m=payload.planned_distance_m,
        actual_duration_min=payload.actual_duration_min,
        actual_distance_m=payload.actual_distance_m,
        rpe=payload.rpe,
    )
    stmt = insert(WorkoutLog).values(user_id=current_user.id, **values)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_workout_log_user_date_slot",
        set_={k: stmt.excluded[k] for k in values if k not in ("date", "slot")},
    ).returning(WorkoutLog.id)
    log_id = (await db.execute(stmt)).scalar_one()
    await db.commit()
    return await db.get(WorkoutLog, log_id, populate_existing=True)


@router.delete("/logs/{log_id}", status_code=204)
async def delete_log(
    log_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(WorkoutLog).where(WorkoutLog.id == log_id, WorkoutLog.user_id == current_user.id)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Log not found")
    await db.commit()

