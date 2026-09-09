from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.db.base import Base


class SportType(str, enum.Enum):
    swimming = "swimming"
    cycling = "cycling"
    running = "running"
    strength = "strength"
    transition = "transition"
    other = "other"


class Activity(Base):
    __tablename__ = "activities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    garmin_activity_id = Column(String, unique=True)

    sport_type = Column(Enum(SportType))
    name = Column(String)
    start_time = Column(DateTime(timezone=True))
    duration_seconds = Column(Integer)
    distance_meters = Column(Float)

    avg_hr = Column(Integer)
    max_hr = Column(Integer)
    avg_power = Column(Float)
    normalized_power = Column(Float)
    tss = Column(Float)
    if_value = Column(Float)

    avg_pace = Column(Float)
    avg_cadence = Column(Integer)
    elevation_gain = Column(Float)

    calories = Column(Integer)
    avg_temperature = Column(Float)

    training_effect = Column(Float)
    aerobic_training_effect = Column(Float)
    anaerobic_training_effect = Column(Float)

    zone_distribution = Column(JSON)
    laps = Column(JSON)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
