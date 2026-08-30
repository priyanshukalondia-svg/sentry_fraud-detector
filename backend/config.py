import json
import os
from pathlib import Path

from pydantic import BaseModel, Field


def _get_database_url() -> str:
    return os.getenv("DATABASE_URL", f"sqlite:///{Path(__file__).with_name('transactions.db')}")


def _get_cors_origins() -> list[str]:
    default_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
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


class Settings(BaseModel):
    app_name: str = "Fraud Detection API"
    environment: str = Field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    database_url: str = Field(default_factory=_get_database_url)
    cors_origins: list[str] = Field(default_factory=_get_cors_origins)


settings = Settings()
