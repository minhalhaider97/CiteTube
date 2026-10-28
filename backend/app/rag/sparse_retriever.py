from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import UUID

def sparse_retrieval(db: Session, video_id: UUID, query: str, top_k: int = 20) -> list[dict]:
    """Retrieve top-k chunks using PostgreSQL full-text search."""
    sql = text("""
        SELECT
            id as chunk_id,
            content,
            start_seconds,
            end_seconds,
            ts_rank(search_vector, websearch_to_tsquery('english', :query)) as score
        FROM transcript_chunks
        WHERE video_id = :video_id
          AND search_vector @@ websearch_to_tsquery('english', :query)
        ORDER BY score DESC
        LIMIT :top_k;
    """)

    result = db.execute(sql, {
        "query": query,
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
