from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, JSON, Enum, Text, Boolean, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.db.base import Base


class RecommendationType(str, enum.Enum):
    training = "training"
    recovery = "recovery"
    nutrition = "nutrition"
    race = "race"
    diabetes = "diabetes"
    performance = "performance"
    general = "general"


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    date = Column(Date)

    type = Column(Enum(RecommendationType))
    priority = Column(Integer, default=5)

    title = Column(String)
    summary = Column(Text)
    reasoning = Column(Text)
    supporting_metrics = Column(JSON)
    confidence = Column(Float)

    agent_source = Column(String(50))
    action_items = Column(JSON)
    dismissed = Column(Boolean, default=False)

    user = relationship("User", back_populates="recommendations")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CoachMessage(Base):
    __tablename__ = "coach_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    role = Column(String(10))
    content = Column(Text)
    agent_context = Column(JSON)
    referenced_data = Column(JSON)

    user = relationship("User", back_populates="coach_messages")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
