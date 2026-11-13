from app.core.ml_models import get_embedding_model


def generate_question_embedding(question: str) -> list[float]:
    """Generate dense vector embedding for the user question."""
    embeddings = get_embedding_model().embed([question], batch_size=1, parallel=None)
    return next(iter(embeddings)).tolist()
