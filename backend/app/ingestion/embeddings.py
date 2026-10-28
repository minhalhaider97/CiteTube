from functools import lru_cache
from sentence_transformers import SentenceTransformer
from app.core.config import settings

embedding_model="all-MiniLM-L6-v2"

@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    return SentenceTransformer(embedding_model)

def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    vectors = get_model().encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return vectors.tolist()
