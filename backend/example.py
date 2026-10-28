from app.db.session import SessionLocal
from app.services.video_service import get_or_create_video

with SessionLocal() as db:
    video, created = get_or_create_video(
        db=db,
        youtube_video_id="dQw4w9WgXcQ",
        canonical_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title="Example video",
        channel_name="Example channel",
    )

    if created:
        print("New video. Start the ingestion pipeline.")
    elif video.status == "completed":
        print("Video already processed. Reuse its chunks and embeddings.")
    else:
        print(f"Existing video status: {video.status}")