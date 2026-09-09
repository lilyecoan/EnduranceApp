from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, JSON, Date, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.db.base import Base


class NutritionPlan(Base):
    __tablename__ = "nutrition_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    date = Column(Date)

    daily_calories = Column(Integer)
    protein_g = Column(Float)
    carbs_g = Column(Float)
    fat_g = Column(Float)
    fiber_g = Column(Float)

    training_day = Column(Boolean, default=False)
    sport_type = Column(String(20))
    workout_duration_minutes = Column(Integer)
    workout_intensity = Column(String(20))

    pre_workout_carbs_g = Column(Float)
    intra_workout_carbs_g_per_hour = Column(Float)
    post_workout_carbs_g = Column(Float)
    post_workout_protein_g = Column(Float)

    hydration_ml_per_hour = Column(Integer)
    sodium_mg_per_hour = Column(Integer)
    electrolyte_notes = Column(Text)

    diabetes_notes = Column(Text)
    fueling_timeline = Column(JSON)

    ai_reasoning = Column(Text)
    confidence = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
