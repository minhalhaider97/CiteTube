from fastapi import FastAPI
from app.api.v1.router import api_router
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.agent.checkpointer import get_checkpointer, close_checkpointer
from app.core.config import settings
from app.core.ml_models import get_embedding_model

@asynccontextmanager
async def lifespan(app):
    get_checkpointer()
    # Preload only the shared embedding model. The reranker remains lazy so idle
    # instances retain more memory on Railway's 512 MB tier.
    get_embedding_model()
    yield
    close_checkpointer()

app = FastAPI(title="YouTube RAG API", version="0.1.0", lifespan=lifespan)

# Configure local or deployed frontend origins through ALLOWED_ORIGINS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
def health():
    return {"status": "ok"}
