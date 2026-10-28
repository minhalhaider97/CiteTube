from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.ingestion.youtube import extract_video_id
from app.services.video_service import submit_video, get_video_status
from app.schemas.video import VideoSubmitRequest, VideoResponse, VideoStatusResponse

router = APIRouter()

@router.post("/ingest", response_model=VideoResponse)
def ingest(request: VideoSubmitRequest, db: Session = Depends(get_db)):
    try:
        video, reused = submit_video(db, request.url)
        return VideoResponse(
            id=video.id, youtube_id=video.youtube_video_id, title=video.title,
            channel_name=video.channel_name, duration_seconds=video.duration_seconds,
            ingestion_status=video.status, reused_existing=reused,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Video ingestion failed: {exc}") from exc

@router.get("/status", response_model=VideoStatusResponse)
def status(url: str, db: Session = Depends(get_db)):
    try:
        return get_video_status(db, url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
