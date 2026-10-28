def format_citations(chunks: list[dict], youtube_video_id: str) -> list[dict]:
    """Format source chunks and generate clickable YouTube timestamp URLs[cite: 4]."""
    citations = []
    for chunk in chunks:
        start_sec = int(chunk["start_seconds"])
        timestamp_url = f"https://www.youtube.com/watch?v={youtube_video_id}&t={start_sec}s"

        citations.append({
            "chunk_id": str(chunk["chunk_id"]),
            "start_seconds": chunk["start_seconds"],
            "end_seconds": chunk["end_seconds"],
            "timestamp_formatted": f"{int(start_sec//60):02d}:{int(start_sec%60):02d}",
            "url": timestamp_url,
            "content": chunk["content"]
        })
    return citations
