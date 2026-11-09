from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.db.base import Base


class DataConnection(Base):
    """One athlete's link to one data source (Intervals.icu, Strava, ...).

    Credentials are stored Fernet-encrypted (app.core.crypto), never in
    plaintext. File uploads don't create a connection row; their records are
    tagged with source="file_upload".
    """

    __tablename__ = "data_connections"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_connection_user_provider"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String, nullable=False)  # "intervals_icu" | "strava"
    auth_type = Column(String, nullable=False)  # "oauth" | "api_key"
    external_athlete_id = Column(String)
    encrypted_access_token = Column(String, nullable=False)
    encrypted_refresh_token = Column(String)
    token_expires_at = Column(DateTime(timezone=True))
    scopes = Column(String)

    last_sync_at = Column(DateTime(timezone=True))
    last_sync_error = Column(String)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
