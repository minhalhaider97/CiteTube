from sentence_transformers import CrossEncoder

_reranker_model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def rerank_chunks(query: str, chunks: list[dict], top_k: int = 5) -> list[dict]:
    """Score query-chunk pairs using a cross-encoder and return top candidates[cite: 4]."""
    if not chunks:
        return []

    pairs = [[query, chunk["content"]] for chunk in chunks]
    scores = _reranker_model.predict(pairs)

    for i, chunk in enumerate(chunks):
        chunk["rerank_score"] = float(scores[i])

    sorted_chunks = sorted(chunks, key=lambda x: x["rerank_score"], reverse=True)
    return sorted_chunks[:top_k]