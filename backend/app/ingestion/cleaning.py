import re
import html

def clean_transcript(rows: list[dict]) -> list[dict]:
    cleaned = []
    for row in rows:
        text = html.unescape(str(row["text"]))
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            cleaned.append({
                "text": text,
                "start": float(row["start"]),
                "duration": float(row.get("duration", 0)),
            })
    return cleaned
