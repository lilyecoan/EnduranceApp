from sqlalchemy import Column, Float, Integer, DateTime, ForeignKey, Date, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.db.base import Base


class RecoveryMetric(Base):
    __tablename__ = "recovery_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)

    hrv_rmssd = Column(Float)
    hrv_status = Column(Float)
    hrv_baseline = Column(Float)
    hrv_5day_avg = Column(Float)

    sleep_score = Column(Integer)
    sleep_duration_seconds = Column(Integer)
    sleep_deep_seconds = Column(Integer)
    sleep_light_seconds = Column(Integer)
    sleep_rem_seconds = Column(Integer)
    sleep_awake_seconds = Column(Integer)

    body_battery_high = Column(Integer)
    body_battery_low = Column(Integer)
    body_battery_at_sleep = Column(Integer)
    body_battery_morning = Column(Integer)

    stress_avg = Column(Integer)
    stress_max = Column(Integer)

    resting_hr = Column(Integer)
    respiration_avg = Column(Float)

    training_readiness_score = Column(Integer)
    training_readiness_description = Column(Float)

    recovery_time_hours = Column(Integer)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
