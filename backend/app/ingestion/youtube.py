import re
from urllib.parse import urlparse, parse_qs

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

def extract_video_id(url: str) -> str:
    """Accept standard watch, youtu.be, shorts, live, and embed URLs."""
    raw = url.strip()
    if VIDEO_ID_RE.fullmatch(raw):
        return raw

    parsed = urlparse(raw if "://" in raw else f"https://{raw}")
    host = (parsed.hostname or "").lower()
    video_id = None

    if host in {"youtu.be", "www.youtu.be"}:
        video_id = parsed.path.strip("/").split("/")[0]
    elif host.endswith("youtube.com") or host.endswith("youtube-nocookie.com"):
        if parsed.path == "/watch":
            video_id = parse_qs(parsed.query).get("v", [None])[0]
        else:
            parts = [p for p in parsed.path.split("/") if p]
            if len(parts) >= 2 and parts[0] in {"shorts", "live", "embed", "v"}:
                video_id = parts[1]

    if not video_id or not VIDEO_ID_RE.fullmatch(video_id):
        raise ValueError("Invalid YouTube URL or video ID.")
    return video_id

def canonical_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"
