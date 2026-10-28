from pydantic import BaseModel, Field
from uuid import UUID

class VideoSubmitRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)

class VideoResponse(BaseModel):
    id: UUID
    youtube_id: str
    title: str
    channel_name: str | None
    duration_seconds: int | None
    ingestion_status: str
    reused_existing: bool = False

class VideoStatusResponse(BaseModel):
    youtube_id: str
    ingestion_status: str
    id: int | None = None
    title: str | None = None
    channel_name: str | None = None
    duration_seconds: int | None = None
    ingestion_error: str | None = None
    chunk_count: int = 0
