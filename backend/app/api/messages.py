from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional
import asyncio

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.chat import ChatMember
from backend.app.models.message import Message
from backend.app.models.ai import AIHistory
from backend.app.schemas import (
    MessageCreate,
    MessageResponse,
)
from backend.app.core.auth import get_current_user
from backend.app.core.websocket import manager
from backend.app.core.gemini import GeminiService

router = APIRouter()

async def process_ai_assistant_query(chat_id: str, query: str, user_id: str, user_username: str):
    """
    Background task to query Gemini and generate the AI Assistant response in the chat room.
    """
    # Create database session
    from backend.app.database import SessionLocal
    db = SessionLocal()
    try:
        # Fetch last 10 messages for context
        history = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at.desc()).limit(10).all()
        history.reverse()
        
        context_list = []
        for msg in history:
            sender = db.query(User).filter(User.id == msg.sender_id).first()
            sender_name = sender.username if sender else "User"
            context_list.append(f"{sender_name}: {msg.content}")

        # Query Gemini
        # Remove the "@AI" prefix from the query
        clean_query = query.replace("@AI", "").strip()
        response_text = GeminiService.get_assistant_response(clean_query, context_list)

        # Create AI Assistant Message
        ai_user_id = "00000000-0000-0000-0000-000000000000"
        ai_message = Message(
            chat_id=chat_id,
            sender_id=ai_user_id,
            content=response_text,
            message_type="text"
        )
        db.add(ai_message)
        db.commit()
        db.refresh(ai_message)

        # Store in AI history
        ai_history = AIHistory(
            chat_id=chat_id,
            user_id=user_id,
            query=clean_query,
            response=response_text
        )
        db.add(ai_history)
        db.commit()

        # Build WS payload
        ws_data = {
            "id": ai_message.id,
            "chat_id": ai_message.chat_id,
            "sender_id": ai_user_id,
            "sender_username": "AI Assistant",
            "content": ai_message.content,
            "message_type": ai_message.message_type,
            "file_url": None,
            "file_name": None,
            "file_size": None,
            "is_seen": False,
            "seen_at": None,
            "created_at": ai_message.created_at.isoformat()
        }

        # Broadcast via WebSockets
        await manager.broadcast_to_chat(chat_id, "receive_message", ws_data, db)

    except Exception as e:
        print(f"Error processing AI assistant query: {e}")
    finally:
        db.close()

@router.post("", response_model=MessageResponse)
async def send_message(
    payload: MessageCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sends a message to a chat channel and broadcasts it in real time via WebSockets.
    """
    # Verify membership
    membership = db.query(ChatMember).filter(
        ChatMember.chat_id == payload.chat_id,
        ChatMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this chat."
        )

    # Save to database
    message = Message(
        chat_id=payload.chat_id,
        sender_id=current_user.id,
        content=payload.content,
        message_type=payload.message_type,
        file_url=payload.file_url,
        file_name=payload.file_name,
        file_size=payload.file_size
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    # Form WebSocket event payload
    ws_data = {
        "id": message.id,
        "chat_id": message.chat_id,
        "sender_id": message.sender_id,
        "sender_username": current_user.username,
        "content": message.content,
        "message_type": message.message_type,
        "file_url": message.file_url,
        "file_name": message.file_name,
        "file_size": message.file_size,
        "is_seen": message.is_seen,
        "seen_at": None,
        "created_at": message.created_at.isoformat()
    }

    # Broadcast message to chat room
    await manager.broadcast_to_chat(payload.chat_id, "receive_message", ws_data, db)

    # Trigger AI Assistant if message starts with @AI
    if payload.content and payload.content.strip().startswith("@AI"):
        background_tasks.add_task(
            process_ai_assistant_query,
            payload.chat_id,
            payload.content.strip(),
            current_user.id,
            current_user.username
        )

    return message

@router.get("", response_model=List[MessageResponse])
def get_message_history(
    chat_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves message history for a specific chat. Validates membership.
    """
    membership = db.query(ChatMember).filter(
        ChatMember.chat_id == chat_id,
        ChatMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this chat."
        )

    offset = (page - 1) * limit
    
    messages = db.query(Message).filter(
        Message.chat_id == chat_id
    ).order_by(Message.created_at.desc()).offset(offset).limit(limit).all()

    # Chat history should be rendered chronologically
    messages.reverse()
    return messages

@router.delete("/{message_id}")
async def delete_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes a message. Must be the sender. Broadcasts deletion over WebSockets.
    """
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found."
        )

    if message.sender_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own messages."
        )

    chat_id = message.chat_id
    db.delete(message)
    db.commit()

    # Broadcast message deletion to other users in the chat room
    await manager.broadcast_to_chat(
        chat_id, 
        "message_deleted", 
        {
            "message_id": message_id,
            "chat_id": chat_id
        }, 
        db
    )

    return {"message": "Message deleted successfully."}

@router.post("/seen/{chat_id}")
async def mark_messages_seen(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Marks all messages in a chat as seen. Broadcasts seen event.
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

    now = datetime.now(timezone.utc)
    
    # Query unread messages from other users
    unread = db.query(Message).filter(
        Message.chat_id == chat_id,
        Message.sender_id != current_user.id,
        Message.is_seen == False
    ).all()

    if unread:
        for msg in unread:
            msg.is_seen = True
            msg.seen_at = now
        db.commit()

        # Broadcast seen update
        await manager.broadcast_to_chat(
            chat_id,
            "messages_seen",
            {
                "chat_id": chat_id,
                "seen_by": current_user.id,
                "seen_at": now.isoformat()
            },
            db
        )

    return {"message": f"Marked {len(unread)} messages as seen."}
