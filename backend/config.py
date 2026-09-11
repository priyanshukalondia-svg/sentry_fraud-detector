import json
import os
from pathlib import Path

from pydantic import BaseModel, Field


def _get_database_url() -> str:
    return os.getenv("DATABASE_URL", f"sqlite:///{Path(__file__).with_name('transactions.db')}")


def _get_cors_origins() -> list[str]:
    default_origins = [
        "https://fraudfrontend-dgtfe68ko-priyanshukalondia-8616s-projects.vercel.app",
        "https://www.fraudfrontend-dgtfe68ko-priyanshukalondia-8616s-projects.vercel.app",
        "https://fraudfrontend-ekzm0s5r8-priyanshukalondia-8616s-projects.vercel.app",
        "https://www.fraudfrontend-ekzm0s5r8-priyanshukalondia-8616s-projects.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    env_value = os.getenv("CORS_ORIGINS", "")
    if not env_value:
        return default_origins

    try:
        parsed = json.loads(env_value)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    return [origin.strip() for origin in env_value.split(",") if origin.strip()]


def _get_cors_origin_regex() -> str | None:
    env_value = os.getenv("CORS_ORIGIN_REGEX", "")
    if not env_value:
        return r"https?://(localhost|127\.0\.0\.1|([a-z0-9-]+\.)*vercel\.app|fraud-detection-scheme\.onrender\.com)(:[0-9]+)?(/.*)?"
    return env_value


class Settings(BaseModel):
    app_name: str = "Fraud Detection API"
    environment: str = Field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    database_url: str = Field(default_factory=_get_database_url)
    cors_origins: list[str] = Field(default_factory=_get_cors_origins)
    cors_origin_regex: str | None = Field(default_factory=_get_cors_origin_regex)


settings = Settings()
