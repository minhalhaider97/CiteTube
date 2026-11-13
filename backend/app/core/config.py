from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    database_url: str
    groq_api_key: str
    groq_chat_model: str                       # main model (you already have this)
    groq_fast_model: str | None = None                  # fast model for the first four tasks
    groq_reasoning_effort: str | None = None             # per-task overrides
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    fastembed_threads: int = 1

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
