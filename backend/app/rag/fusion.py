def reciprocal_rank_fusion(dense_results: list[dict], sparse_results: list[dict], k: int = 60, top_n: int = 10) -> list[dict]:
    """Merge dense and sparse rank lists using Reciprocal Rank Fusion (RRF)."""
    rrf_scores = {}
    chunk_map = {}

    def add_ranks(results):
        for rank, item in enumerate(results, start=1):
            chunk_id = item["chunk_id"]
            chunk_map[chunk_id] = item
            score = 1.0 / (k + rank)
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + score

    add_ranks(dense_results)
    add_ranks(sparse_results)

    sorted_chunks = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

    fused_results = []
    for chunk_id, score in sorted_chunks[:top_n]:
        chunk = chunk_map[chunk_id]
        chunk["rrf_score"] = score
        fused_results.append(chunk)

    return fused_results
