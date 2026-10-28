from youtube_transcript_api import YouTubeTranscriptApi

def fetch_transcript(video_id: str) -> list[dict]:
    """Return normalized transcript snippets with text, start, and duration."""
    api = YouTubeTranscriptApi()
    transcript = api.fetch(video_id)
    rows = []
    for item in transcript:
        # New API returns FetchedTranscriptSnippet objects.
        text = getattr(item, "text", None)
        start = getattr(item, "start", None)
        duration = getattr(item, "duration", None)
        # Also tolerate dict-like items for compatibility.
        if isinstance(item, dict):
            text = item.get("text")
            start = item.get("start", 0)
            duration = item.get("duration", 0)
        if text and start is not None:
            rows.append({"text": str(text), "start": float(start), "duration": float(duration or 0)})
    if not rows:
        raise ValueError("No usable transcript was found for this video.")
    return rows
