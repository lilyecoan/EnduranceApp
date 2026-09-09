from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, JSON, Enum, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.db.base import Base


class FitnessLevel(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"
    elite = "elite"


class AthleteProfile(Base):
    __tablename__ = "athlete_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    age = Column(Integer)
    gender = Column(String(10))
    weight_kg = Column(Float)
    height_cm = Column(Float)
    fitness_level = Column(Enum(FitnessLevel), default=FitnessLevel.intermediate)

    ftp_watts = Column(Float)
    vo2_max = Column(Float)
    lactate_threshold_hr = Column(Integer)
    max_hr = Column(Integer)
    resting_hr = Column(Integer)

    swim_pace_per_100m = Column(Float)
    run_threshold_pace = Column(Float)

    weekly_hours_available = Column(Float, default=10.0)
    preferred_long_ride_day = Column(String(10), default="Saturday")
    preferred_long_run_day = Column(String(10), default="Sunday")

    strengths = Column(JSON, default=list)
    limiters = Column(JSON, default=list)
    injury_history = Column(JSON, default=list)

    garmin_user_id = Column(String)
    garmin_connected = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="athlete_profile")


class MedicalProfile(Base):
    __tablename__ = "medical_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    has_type1_diabetes = Column(Boolean, default=False)
    insulin_sensitivity_factor = Column(Float)
    carb_ratio = Column(Float)
    target_glucose_low = Column(Float)
    target_glucose_high = Column(Float)
    cgm_type = Column(String(50))

    medications = Column(JSON, default=list)
    conditions = Column(JSON, default=list)
    allergies = Column(JSON, default=list)
    notes = Column(Text)

    disclaimer_acknowledged = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="medical_profile")
