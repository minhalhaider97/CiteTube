from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    database_url: str
    groq_api_key: str
    groq_chat_model: str                       # main model (you already have this)
    groq_fast_model: str | None = None                  # fast model for the first four tasks
    groq_reasoning_effort: str | None = None             # per-task overrides
    # ... your other fields ...

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()