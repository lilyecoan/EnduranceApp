from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, JSON, Enum, Date, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.db.base import Base


class TrainingPhase(str, enum.Enum):
    base = "base"
    build = "build"
    peak = "peak"
    taper = "taper"
    race = "race"
    recovery = "recovery"


class WorkoutType(str, enum.Enum):
    endurance = "endurance"
    tempo = "tempo"
    intervals = "intervals"
    recovery = "recovery"
    long = "long"
    brick = "brick"
    race_simulation = "race_simulation"
    strength = "strength"


class TrainingPlan(Base):
    __tablename__ = "training_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    race_event_id = Column(UUID(as_uuid=True), ForeignKey("race_events.id"))

    name = Column(String)
    phase = Column(Enum(TrainingPhase))
    week_number = Column(Integer)
    start_date = Column(Date)
    end_date = Column(Date)

    total_planned_hours = Column(Float)
    total_planned_tss = Column(Float)
    ctl_target = Column(Float)
    atl_target = Column(Float)

    ai_generated = Column(Boolean, default=True)
    ai_reasoning = Column(Text)
    confidence = Column(Float)

    workouts = relationship("Workout", back_populates="training_plan")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Workout(Base):
    __tablename__ = "workouts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    training_plan_id = Column(UUID(as_uuid=True), ForeignKey("training_plans.id"))
    garmin_workout_id = Column(String)

    scheduled_date = Column(Date)
    sport_type = Column(String(20))
    workout_type = Column(Enum(WorkoutType))
    name = Column(String)
    description = Column(Text)

    planned_duration_minutes = Column(Integer)
    planned_distance_km = Column(Float)
    planned_tss = Column(Float)

    target_zones = Column(JSON)
    intervals = Column(JSON)
    fueling_plan = Column(JSON)

    completed = Column(Boolean, default=False)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("activities.id"))

    ai_reasoning = Column(Text)

    training_plan = relationship("TrainingPlan", back_populates="workouts")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
