from app.core.ml_models import get_embedding_model


EMBEDDING_BATCH_SIZE = 16


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    vectors = get_embedding_model().embed(
        texts,
        batch_size=EMBEDDING_BATCH_SIZE,
        parallel=None,
    )
    return [vector.tolist() for vector in vectors]
