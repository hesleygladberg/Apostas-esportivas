from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import ChatQuery, ChatResponse
from app.services.gemini_assistant import analyze_match_with_ai

router = APIRouter(prefix="/assistant", tags=["assistant"])

@router.post("/chat", response_model=ChatResponse)
def chat_with_assistant(query: ChatQuery, db: Session = Depends(get_db)):
    """
    Endpoint para interagir com o assistente Gemini sobre uma partida de futebol específica.
    """
    try:
        reply = analyze_match_with_ai(query.match_id, query.message, db)
        return ChatResponse(reply=reply)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar conversa com o assistente: {str(e)}"
        )
