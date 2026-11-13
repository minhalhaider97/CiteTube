from app.core.ml_models import get_reranker_model


def rerank_chunks(query: str, chunks: list[dict], top_k: int = 5) -> list[dict]:
    """Score query-chunk pairs using a cross-encoder and return top candidates."""
    if not chunks:
        return []

    documents = [chunk["content"] for chunk in chunks]
    scores = list(
        get_reranker_model().rerank(
            query=query,
            documents=documents,
            batch_size=16,
        )
    )

    for i, chunk in enumerate(chunks):
        chunk["rerank_score"] = float(scores[i])

    sorted_chunks = sorted(chunks, key=lambda x: x["rerank_score"], reverse=True)
    return sorted_chunks[:top_k]
