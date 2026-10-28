from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.chat import ChatCreateRequest, ChatResponse, MessageResponse
from app.services.chat_service import (
    create_chat_session,
    get_user_chats,
    delete_chat_session,
    process_rag_query,
)

router = APIRouter()

@router.post("", response_model=ChatResponse, status_code=201)
def create_chat(payload: ChatCreateRequest, db: Session = Depends(get_db)):
    try:
        return create_chat_session(db, user_id=payload.user_id, video_id=payload.video_id)
    except ValueError as e:
        status = 404 if "not found" in str(e).lower() else 409
        raise HTTPException(status_code=status, detail=str(e))

@router.get("", response_model=list[ChatResponse])
def list_chats(user_id: str = Query(min_length=1), db: Session = Depends(get_db)):
    return get_user_chats(db, user_id=user_id)

@router.delete("/{chat_id}", status_code=204)
def delete_chat(chat_id: UUID, user_id: str = Query(min_length=1), db: Session = Depends(get_db)):
    success = delete_chat_session(db, chat_id=chat_id, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Chat not found.")
    return None

@router.post("/query")
def query_chat(payload: dict, db: Session = Depends(get_db)):
    """
    Executes RAG query for a specific chat session and returns the AI response with citations.
    """
    chat_id = payload.get("chat_id")
    user_id = payload.get("user_id")
    query_text = payload.get("query")

    if not chat_id or not user_id or not query_text:
        raise HTTPException(status_code=400, detail="chat_id, user_id, and query are required.")

    try:
        user_msg, assistant_msg, rag_result = process_rag_query(
            db, chat_id=chat_id, user_id=user_id, query=query_text
        )
        return {
            "answer": rag_result.get("answer"),
            "citations": rag_result.get("citations", []),
            "user_message_id": user_msg.id,
            "assistant_message_id": assistant_msg.id,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG generation failed: {str(e)}")