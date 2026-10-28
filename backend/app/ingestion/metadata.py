from yt_dlp import YoutubeDL

def fetch_metadata(url: str) -> dict:
    options = {"quiet": True, "no_warnings": True, "skip_download": True, "extract_flat": False}
    with YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=False)
    return {
        "title": info.get("title") or "Untitled video",
        "channel_name": info.get("channel") or info.get("uploader"),
        "duration_seconds": info.get("duration"),
    }
