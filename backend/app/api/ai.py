from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.chat import ChatMember
from backend.app.models.message import Message
from backend.app.schemas import (
    SmartRepliesResponse,
    TranslateRequest,
    TranslateResponse,
    ChatSummaryResponse,
)
from backend.app.core.auth import get_current_user
from backend.app.core.gemini import GeminiService

router = APIRouter()

@router.get("/suggestions", response_model=SmartRepliesResponse)
def get_reply_suggestions(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetches the last 5 messages in a chat and returns 3 smart reply suggestions.
    """
    # Verify membership
    membership = db.query(ChatMember).filter(
        ChatMember.chat_id == chat_id,
        ChatMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this chat."
        )

    # Fetch last 5 messages
    messages = db.query(Message).filter(
        Message.chat_id == chat_id
    ).order_by(Message.created_at.desc()).limit(5).all()
    
    # We want them chronologically
    messages.reverse()

    # Extract message contexts (e.g. "username: content")
    context_list = []
    for msg in messages:
        sender = db.query(User).filter(User.id == msg.sender_id).first()
        sender_name = sender.username if sender else "User"
        # Skip system or helper commands in context if possible
        if msg.content and not msg.content.startswith("@AI"):
            context_list.append(f"{sender_name}: {msg.content}")

    suggestions = GeminiService.generate_smart_replies(context_list)
    return SmartRepliesResponse(suggestions=suggestions)

@router.get("/summary", response_model=ChatSummaryResponse)
def get_chat_summary(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetches up to 50 messages from today/recent logs in the chat and returns an AI summary.
    """
    # Verify membership
    membership = db.query(ChatMember).filter(
        ChatMember.chat_id == chat_id,
        ChatMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this chat."
        )

    # Fetch last 50 messages
    messages = db.query(Message).filter(
        Message.chat_id == chat_id
    ).order_by(Message.created_at.desc()).limit(50).all()
    
    messages.reverse()

    message_dicts = []
    for msg in messages:
        sender = db.query(User).filter(User.id == msg.sender_id).first()
        message_dicts.append({
            "sender_username": sender.username if sender else "User",
            "content": msg.content
        })

    summary = GeminiService.generate_chat_summary(message_dicts)
    return ChatSummaryResponse(summary=summary)

@router.post("/translate", response_model=TranslateResponse)
def translate_message(
    payload: TranslateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Translates message content into a target language (en, te, hi).
    """
    translated = GeminiService.translate_text(payload.text, payload.target_language)
    return TranslateResponse(translated_text=translated)

@router.post("/transcribe")
def transcribe_voice_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Transcribes audio voice message into text using Gemini AI and saves it to the message.
    """
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    transcription = GeminiService.transcribe_voice(message.content)
    message.transcription = transcription
    db.commit()
    db.refresh(message)
    return {"transcription": transcription, "message_id": message_id}

@router.post("/code-explain")
def explain_code_snippet(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyzes and explains code snippets sent in chat.
    """
    code_text = payload.get("code", "")
    if not code_text:
        raise HTTPException(status_code=400, detail="Code snippet is required")
    explanation = GeminiService.explain_code(code_text)
    return {"explanation": explanation}

