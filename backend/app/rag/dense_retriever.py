from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import UUID

def dense_retrieval(db: Session, video_id: UUID, query_embedding: list[float], top_k: int = 20) -> list[dict]:
    """Retrieve top-k chunks using pgvector cosine distance filtered by video_id."""
    sql = text("""
        SELECT
            c.id as chunk_id,
            c.content,
            c.start_seconds,
            c.end_seconds,
            1 - (e.embedding <=> CAST(:query_embedding AS vector)) as score
        FROM chunk_embeddings e
        JOIN transcript_chunks c ON e.chunk_id = c.id
        WHERE c.video_id = :video_id
        ORDER BY e.embedding <=> CAST(:query_embedding AS vector) ASC
        LIMIT :top_k;
    """)

    result = db.execute(sql, {
        "query_embedding": str(query_embedding),
        "video_id": str(video_id),
        "top_k": top_k
    }).fetchall()

    return [
        {
            "chunk_id": row.chunk_id,
            "content": row.content,
            "start_seconds": row.start_seconds,
            "end_seconds": row.end_seconds,
            "score": float(row.score)
        }
        for row in result
    ]
