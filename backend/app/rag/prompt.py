def format_time(seconds: float) -> str:
    """Format seconds into MM:SS timestamp format."""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"

def build_prompt(query: str, chunks: list[dict]) -> str:
    """Build grounded prompt and context formatting with timestamps[cite: 4]."""
    context_blocks = []
    for idx, chunk in enumerate(chunks, 1):
        start_fmt = format_time(chunk["start_seconds"])
        end_fmt = format_time(chunk["end_seconds"])
        context_blocks.append(
            f"[{idx}] Timestamp: {start_fmt} - {end_fmt}\nContent: {chunk['content']}"
        )

    context_str = "\n\n".join(context_blocks)

    prompt = f"""You are a helpful AI assistant answering questions about a YouTube video based strictly on the provided transcript excerpts.
If the answer cannot be found in the context, state clearly that you do not know.
Always cite the source chunk index and include clickable timestamps when referencing video moments.

Context Excerpts:
{context_str}

User Question: {query}
Answer:"""

    return prompt
