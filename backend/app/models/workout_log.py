from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Date, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.db.base import Base


class WorkoutLog(Base):
    """What the athlete actually did for one planned session, in their own words.

    Planned values are copied in when the log is saved, so the log still
    makes sense if the plan changes later. ``load`` is the estimated
    training stress (TSS-like) of what was actually done.
    """

    __tablename__ = "workout_logs"
    __table_args__ = (UniqueConstraint("user_id", "date", "slot", name="uq_workout_log_user_date_slot"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    # Which session on that day: "main", "strength", or "extra" for unplanned work.
    slot = Column(String(20), nullable=False, default="main")
    sport = Column(String(20))
    planned_name = Column(String)
    planned_duration_min = Column(Float)
    planned_distance_m = Column(Float)
    planned_load = Column(Float)

    status = Column(String(20), nullable=False, default="completed")  # completed | skipped
    actual_duration_min = Column(Float)
    actual_distance_m = Column(Float)
    rpe = Column(Integer)  # 1-10 session effort
    avg_hr = Column(Integer)
    notes = Column(Text)
    load = Column(Float, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
