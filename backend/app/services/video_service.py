from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.db.models.video import Video
from app.db.models.transcript import TranscriptChunk
from app.ingestion.pipeline import ingest_video
from app.ingestion.youtube import extract_video_id


def get_video_status(db: Session, submitted_url: str) -> dict:
    youtube_video_id = extract_video_id(submitted_url)
    video = db.scalar(select(Video).where(Video.youtube_video_id == youtube_video_id))
    if not video:
        # "status" kept for backwards compatibility; "ingestion_status" matches the found-case shape.
        return {
            "youtube_id": youtube_video_id,
            "status": "not_found",
            "ingestion_status": "not_found",
        }

    chunk_count = db.scalar(
        select(func.count(TranscriptChunk.id)).where(TranscriptChunk.video_id == video.id)
    )
    # Response keys are unchanged (so your API schema still matches);
    # only the model attributes they are read from were corrected.
    return {
        "id": video.id,
        "youtube_id": video.youtube_video_id,
        "title": video.title,
        "channel_name": video.channel_name,
        "duration_seconds": video.duration_seconds,
        "ingestion_status": video.status,
        "ingestion_error": video.error_message,
        "chunk_count": chunk_count or 0,
    }


def submit_video(db: Session, url: str) -> tuple[Video, bool]:
    return ingest_video(db, url)
