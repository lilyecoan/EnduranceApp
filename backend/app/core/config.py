from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "IronMind AI"
    environment: str = "development"

    database_url: str = "postgresql+asyncpg://ironmind:ironmind_secret@localhost:5432/ironmind"

    gemini_api_key: str = Field(
        default="", validation_alias=AliasChoices("GEMINI_API_KEY", "GOOGLE_API_KEY")
    )
    # Alias tracking a current Flash model: pinned IDs get retired (1.5-pro now 404s).
    gemini_model: str = "gemini-flash-latest"

    openweather_api_key: str = ""

    garmin_email: str = ""
    garmin_password: str = ""

    # Clerk auth
    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""
    clerk_issuer: str = ""

    # Comma-separated list of allowed CORS origins
    cors_origins: str = "http://localhost:3000"

    # Data-source connections. Public URLs build OAuth redirect URIs and the
    # post-connect redirect back to the app.
    backend_public_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    # Fernet key (base64, 32 bytes) encrypting stored provider tokens; also
    # signs OAuth state. Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    token_encryption_key: str = ""
    intervals_client_id: str = ""
    intervals_client_secret: str = ""
    strava_client_id: str = ""
    strava_client_secret: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
