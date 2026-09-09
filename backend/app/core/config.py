from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "IronMind AI"
    environment: str = "development"
    secret_key: str = "change-me-in-production"

    database_url: str = "postgresql+asyncpg://ironmind:ironmind_secret@localhost:5432/ironmind"
    redis_url: str = "redis://localhost:6379"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-pro"

    openweather_api_key: str = ""

    garmin_email: str = ""
    garmin_password: str = ""

    class Config:
        env_file = ".env"
        # Map legacy/alternate env var names
        fields = {
            "gemini_api_key": {"env": ["GEMINI_API_KEY", "GOOGLE_API_KEY"]},
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
