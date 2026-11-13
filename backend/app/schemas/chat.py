from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID

class ChatCreateRequest(BaseModel):
    user_id: UUID
    video_id: UUID

class ChatResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    video_id: UUID
    title: str
    created_at: datetime
    youtube_id: str | None = None
    channel_name: str | None = None
    duration_seconds: int | None = None

class MessageCreateRequest(BaseModel):
    user_id: UUID
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=30000)

class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    chat_id: UUID
    role: str
    content: str
    message_metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
