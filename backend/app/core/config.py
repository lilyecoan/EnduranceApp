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
    gemini_model: str = "gemini-1.5-pro"

    openweather_api_key: str = ""

    garmin_email: str = ""
    garmin_password: str = ""

    # Clerk auth
    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""
    clerk_issuer: str = ""

    # Comma-separated list of allowed CORS origins
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
