from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, JSON, Date, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.db.base import Base


class RaceDistance(str, enum.Enum):
    sprint = "sprint"
    olympic = "olympic"
    half_iron = "half_iron"
    full_iron = "full_iron"
    half_marathon = "half_marathon"
    marathon = "marathon"


class RaceEvent(Base):
    __tablename__ = "race_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    distance = Column(Enum(RaceDistance), nullable=False)
    race_date = Column(Date, nullable=False)
    location = Column(String)
    country = Column(String)

    swim_distance_m = Column(Float)
    bike_distance_km = Column(Float)
    run_distance_km = Column(Float)

    elevation_gain_m = Column(Float)
    avg_temp_celsius = Column(Float)
    is_wetsuit_legal = Column(String(10))

    is_primary = Column(String(10), default="true")

    user = relationship("User", back_populates="race_events")
    goals = relationship("RaceGoal", back_populates="race_event")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RaceGoal(Base):
    __tablename__ = "race_goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    race_event_id = Column(UUID(as_uuid=True), ForeignKey("race_events.id"), nullable=False)

    goal_type = Column(String(20))
    target_finish_seconds = Column(Integer)
    target_swim_seconds = Column(Integer)
    target_bike_seconds = Column(Integer)
    target_run_seconds = Column(Integer)
    target_t1_seconds = Column(Integer)
    target_t2_seconds = Column(Integer)

    target_bike_watts = Column(Float)
    target_run_pace = Column(Float)
    target_swim_pace = Column(Float)

    predicted_finish_seconds = Column(Integer)
    confidence = Column(Float)
    ai_reasoning = Column(Text)
    pacing_plan = Column(JSON)
    fueling_plan = Column(JSON)

    race_event = relationship("RaceEvent", back_populates="goals")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
