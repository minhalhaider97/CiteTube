"""Shared, memory-conscious FastEmbed model instances."""

from functools import lru_cache

from fastembed import TextEmbedding
from fastembed.rerank.cross_encoder import TextCrossEncoder

from app.core.config import settings


EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
RERANKER_MODEL_NAME = "Xenova/ms-marco-MiniLM-L-6-v2"


@lru_cache(maxsize=1)
def get_embedding_model() -> TextEmbedding:
    """Return the single ONNX embedding model used by ingestion and retrieval."""
    return TextEmbedding(
        model_name=EMBEDDING_MODEL_NAME,
        threads=settings.fastembed_threads,
        enable_cpu_mem_arena=False,
    )


@lru_cache(maxsize=1)
def get_reranker_model() -> TextCrossEncoder:
    """Return the single ONNX cross-encoder used to rerank fused candidates."""
    return TextCrossEncoder(
        model_name=RERANKER_MODEL_NAME,
        threads=settings.fastembed_threads,
        enable_cpu_mem_arena=False,
    )
