import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.chat import Message

HISTORY_LIMIT = 6        # last 6 messages = 3 turns
MAX_CHARS_PER_MESSAGE = 800


def load_history(db: Session, chat_id: uuid.UUID, limit: int = HISTORY_LIMIT) -> list[dict[str, str]]:
    """Windowed chat memory read straight from the messages table (oldest -> newest)."""
    stmt = (
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    rows = list(db.scalars(stmt).all())
    rows.reverse()
    return [{"role": m.role, "content": m.content[:MAX_CHARS_PER_MESSAGE]} for m in rows]
