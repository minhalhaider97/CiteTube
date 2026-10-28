from sqlalchemy.orm import Session
from uuid import UUID
from app.rag.embeddings import generate_question_embedding
from app.rag.dense_retriever import dense_retrieval
from app.rag.sparse_retriever import sparse_retrieval
from app.rag.fusion import reciprocal_rank_fusion
from app.rag.reranker import rerank_chunks
from app.rag.prompt import build_prompt
from app.rag.generator import generate_answer
from app.rag.citations import format_citations
from app.db.models.video import Video


def retrieve_chunks(db: Session, video_id: UUID, query: str, top_k: int = 5) -> list[dict]:
    """Hybrid retrieval: dense + sparse -> RRF -> cross-encoder rerank. Reused by the agent graph."""
    query_embedding = generate_question_embedding(query)
    dense_results = dense_retrieval(db, video_id, query_embedding, top_k=20)
    sparse_results = sparse_retrieval(db, video_id, query, top_k=20)
    fused_chunks = reciprocal_rank_fusion(dense_results, sparse_results, top_n=10)
    return rerank_chunks(query, fused_chunks, top_k=top_k)


def run_rag_chain(db: Session, video_id: UUID, query: str) -> dict:
    """Legacy single-pass RAG flow (kept as a fallback / for comparison)."""
    ranked_chunks = retrieve_chunks(db, video_id, query)
    prompt = build_prompt(query, ranked_chunks)
    answer = generate_answer(prompt)

    video = db.query(Video).filter(Video.id == video_id).first()
    yt_video_id = video.youtube_video_id if video else ""
    citations = format_citations(ranked_chunks, yt_video_id)

    return {"answer": answer, "citations": citations}
