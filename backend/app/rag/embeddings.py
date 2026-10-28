from sentence_transformers import SentenceTransformer
from app.core.config import settings

# Initialize model (e.g., all-MiniLM-L6-v2 or text-embedding model)
_embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

def generate_question_embedding(question: str) -> list[float]:
    """Generate dense vector embedding for the user question."""
    embedding = _embedding_model.encode(question, normalize_embeddings=True)
    return embedding.tolist()