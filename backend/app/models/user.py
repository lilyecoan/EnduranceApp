from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    athlete_profile = relationship("AthleteProfile", back_populates="user", uselist=False)
    medical_profile = relationship("MedicalProfile", back_populates="user", uselist=False)
    race_events = relationship("RaceEvent", back_populates="user")
    recommendations = relationship("Recommendation", back_populates="user")
    coach_messages = relationship("CoachMessage", back_populates="user")
