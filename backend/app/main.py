from fastapi import FastAPI
from app.api.v1.router import api_router
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.agent.checkpointer import get_checkpointer, close_checkpointer

@asynccontextmanager
async def lifespan(app):
    get_checkpointer()
    yield
    close_checkpointer()

app = FastAPI(title="YouTube RAG API", version="0.1.0", lifespan=lifespan)

# Configure CORS so the Vite frontend (port 5173) can talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
def health():
    return {"status": "ok"}
