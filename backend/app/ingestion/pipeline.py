from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.models.video import Video
from app.db.models.transcript import TranscriptChunk, ChunkEmbedding
from app.ingestion.youtube import extract_video_id, canonical_url
from app.ingestion.metadata import fetch_metadata
from app.ingestion.transcript import fetch_transcript
from app.ingestion.cleaning import clean_transcript
from app.ingestion.chunking import create_chunks
from app.ingestion.embeddings import embed_texts

def ingest_video(db: Session, submitted_url: str) -> tuple[Video, bool]:
    """Return (video, reused_existing). Existing completed ingestion is reused."""
    video_id = extract_video_id(submitted_url)
    existing = db.scalar(select(Video).where(Video.youtube_video_id == video_id))
    if existing and existing.status == "completed":
        return existing, True

    video = existing
    if video is None:
        video = Video(youtube_video_id=video_id, canonical_url=canonical_url(video_id), title="Processing", status="processing")
        db.add(video)
        db.commit()
        db.refresh(video)
    else:
        video.status = "processing"
        video.error_message = None
        db.query(TranscriptChunk).filter(TranscriptChunk.video_id == video.id).delete()
        db.commit()

    try:
        metadata = fetch_metadata(video.canonical_url)
        raw_transcript = fetch_transcript(video_id)
        cleaned = clean_transcript(raw_transcript)
        chunks = create_chunks(cleaned, chunk_size=900, overlap=150)
        if not chunks:
            raise ValueError("Transcript did not produce any chunks.")
        vectors = embed_texts([chunk["text"] for chunk in chunks])

        video.title = metadata["title"]
        video.channel_name = metadata["channel_name"]
        video.duration_seconds = metadata["duration_seconds"]
        video.canonical_url = canonical_url(video_id)
        db.add_all([
            TranscriptChunk(
                video_id=video.id,
                chunk_index=i,
                content=chunk["text"],
                start_seconds=chunk["start_seconds"],
                end_seconds=chunk["end_seconds"],
                embedding=ChunkEmbedding(
                    embedding=vectors[i],
                    embedding_model="all-MiniLM-L6-v2"
                )
            )
            for i, chunk in enumerate(chunks)
        ])
        video.status = "completed"
        video.error_message = None
        video.processed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(video)
        return video, False
    except Exception as exc:
        db.rollback()
        # Re-fetch row after rollback so failure status can be committed.
        failed_video = db.scalar(select(Video).where(Video.youtube_video_id == video_id))
        if failed_video:
            failed_video.status = "failed"
            failed_video.error_message = str(exc)[:2000]
            db.commit()
        raise
