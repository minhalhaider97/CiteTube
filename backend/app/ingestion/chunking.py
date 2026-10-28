def create_chunks(rows: list[dict], chunk_size: int = 900, overlap: int = 150) -> list[dict]:
    """Build character-sized chunks while retaining first/last transcript timestamps."""
    if chunk_size <= 0 or overlap < 0 or overlap >= chunk_size:
        raise ValueError("Require chunk_size > overlap >= 0.")
    chunks = []
    buffer = []
    char_count = 0
    start_seconds = None
    end_seconds = 0.0

    def flush():
        nonlocal buffer, char_count, start_seconds, end_seconds
        if not buffer:
            return
        text = " ".join(part["text"] for part in buffer).strip()
        if text:
            chunks.append({
                "text": text,
                "start_seconds": float(start_seconds or 0),
                "end_seconds": float(end_seconds),
            })
        # Keep trailing text as overlap; approximate overlap by characters.
        tail = text[-overlap:] if overlap else ""
        buffer = [{"text": tail, "start": end_seconds, "duration": 0}] if tail else []
        char_count = len(tail)
        start_seconds = end_seconds if tail else None

    for row in rows:
        text = row["text"].strip()
        if not text:
            continue
        if buffer and char_count + len(text) + 1 > chunk_size:
            flush()
        if start_seconds is None:
            start_seconds = row["start"]
        buffer.append(row)
        char_count += len(text) + 1
        end_seconds = row["start"] + row.get("duration", 0)

    if buffer:
        text = " ".join(part["text"] for part in buffer).strip()
        if text:
            chunks.append({"text": text, "start_seconds": float(start_seconds or 0), "end_seconds": float(end_seconds)})
    return chunks
