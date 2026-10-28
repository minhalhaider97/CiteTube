from datetime import datetime
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
    created_at: datetime
