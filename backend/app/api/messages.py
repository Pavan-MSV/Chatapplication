from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional
import asyncio

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.chat import ChatMember
from backend.app.models.message import Message
from backend.app.models.reaction import MessageReaction
from backend.app.models.ai import AIHistory
from backend.app.schemas import (
    MessageCreate,
    MessageResponse,
    MessageReactionResponse,
    ReplyMessageSummary,
)
from backend.app.core.auth import get_current_user
from backend.app.core.websocket import manager
from backend.app.core.gemini import GeminiService

router = APIRouter()

def build_message_response(msg: Message, db: Session, user_map: dict) -> dict:
    # Build reply summary if reply_to_id exists
    reply_summary = None
    if msg.reply_to_id:
        parent_msg = db.query(Message).filter(Message.id == msg.reply_to_id).first()
        if parent_msg:
            parent_sender_name = user_map.get(parent_msg.sender_id, "User")
            reply_summary = {
                "id": parent_msg.id,
                "sender_id": parent_msg.sender_id,
                "sender_username": parent_sender_name,
                "content": parent_msg.content,
                "message_type": parent_msg.message_type
            }

    # Fetch reactions for this message
    reactions_raw = db.query(MessageReaction).filter(MessageReaction.message_id == msg.id).all()
    reactions_list = []
    for r in reactions_raw:
        reactions_list.append({
            "id": r.id,
            "message_id": r.message_id,
            "user_id": r.user_id,
            "username": user_map.get(r.user_id, "User"),
            "emoji": r.emoji,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })

    return {
        "id": msg.id,
        "chat_id": msg.chat_id,
        "sender_id": msg.sender_id,
        "sender_username": user_map.get(msg.sender_id, "User"),
        "content": msg.content,
        "message_type": msg.message_type,
        "file_url": msg.file_url,
        "file_name": msg.file_name,
        "file_size": msg.file_size,
        "is_seen": msg.is_seen,
        "seen_at": msg.seen_at.isoformat() if msg.seen_at else None,
        "created_at": msg.created_at,
        "reply_to_id": msg.reply_to_id,
        "reply_to": reply_summary,
        "is_pinned": bool(msg.is_pinned),
        "pinned_at": msg.pinned_at.isoformat() if msg.pinned_at else None,
        "transcription": msg.transcription,
        "reactions": reactions_list
    }

async def process_ai_assistant_query(chat_id: str, query: str, user_id: str, user_username: str):
    from backend.app.database import SessionLocal
    db = SessionLocal()
    try:
        history = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at.desc()).limit(10).all()
        history.reverse()
        
        context_list = []
        for msg in history:
            sender = db.query(User).filter(User.id == msg.sender_id).first()
            sender_name = sender.username if sender else "User"
            context_list.append(f"{sender_name}: {msg.content}")

        clean_query = query.replace("@AI", "").strip()
        response_text = GeminiService.get_assistant_response(clean_query, context_list)

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

        ai_history = AIHistory(
            chat_id=chat_id,
            user_id=user_id,
            query=clean_query,
            response=response_text
        )
        db.add(ai_history)
        db.commit()

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
            "created_at": ai_message.created_at.isoformat(),
            "reply_to_id": None,
            "reply_to": None,
            "is_pinned": False,
            "pinned_at": None,
            "transcription": None,
            "reactions": []
        }

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
    membership = db.query(ChatMember).filter(
        ChatMember.chat_id == payload.chat_id,
        ChatMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this chat."
        )

    message = Message(
        chat_id=payload.chat_id,
        sender_id=current_user.id,
        content=payload.content,
        message_type=payload.message_type,
        file_url=payload.file_url,
        file_name=payload.file_name,
        file_size=payload.file_size,
        reply_to_id=payload.reply_to_id
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    # Build response dictionary & WS payload
    all_users = db.query(User).all()
    user_map = {u.id: u.username for u in all_users}
    user_map["00000000-0000-0000-0000-000000000000"] = "AI Assistant"

    msg_dict = build_message_response(message, db, user_map)
    ws_payload = dict(msg_dict)
    ws_payload["created_at"] = message.created_at.isoformat()

    await manager.broadcast_to_chat(payload.chat_id, "receive_message", ws_payload, db)

    if payload.content and payload.content.strip().startswith("@AI"):
        background_tasks.add_task(
            process_ai_assistant_query,
            payload.chat_id,
            payload.content.strip(),
            current_user.id,
            current_user.username
        )

    return msg_dict

@router.get("", response_model=List[MessageResponse])
def get_message_history(
    chat_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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

    all_users = db.query(User).all()
    user_map = {u.id: u.username for u in all_users}
    user_map["00000000-0000-0000-0000-000000000000"] = "AI Assistant"

    result = [build_message_response(m, db, user_map) for m in messages]
    result.reverse()
    return result

@router.post("/{message_id}/react")
async def toggle_message_reaction(
    message_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Toggles an emoji reaction on a message.
    """
    emoji = payload.get("emoji")
    if not emoji:
        raise HTTPException(status_code=400, detail="Emoji is required")

    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    existing = db.query(MessageReaction).filter(
        MessageReaction.message_id == message_id,
        MessageReaction.user_id == current_user.id,
        MessageReaction.emoji == emoji
    ).first()

    if existing:
        db.delete(existing)
        action = "removed"
    else:
        new_reaction = MessageReaction(
            message_id=message_id,
            user_id=current_user.id,
            emoji=emoji
        )
        db.add(new_reaction)
        action = "added"

    db.commit()

    all_users = db.query(User).all()
    user_map = {u.id: u.username for u in all_users}
    msg_dict = build_message_response(message, db, user_map)
    msg_dict["created_at"] = message.created_at.isoformat()

    await manager.broadcast_to_chat(
        message.chat_id,
        "reaction_update",
        {
            "chat_id": message.chat_id,
            "message_id": message_id,
            "reactions": msg_dict["reactions"]
        },
        db
    )

    return {"action": action, "reactions": msg_dict["reactions"]}

@router.post("/{message_id}/pin")
async def toggle_pin_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Pins or unpins a message in the chat.
    """
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    message.is_pinned = not message.is_pinned
    message.pinned_at = datetime.now(timezone.utc) if message.is_pinned else None
    db.commit()

    await manager.broadcast_to_chat(
        message.chat_id,
        "pin_update",
        {
            "chat_id": message.chat_id,
            "message_id": message_id,
            "is_pinned": message.is_pinned,
            "pinned_at": message.pinned_at.isoformat() if message.pinned_at else None
        },
        db
    )

    return {"message_id": message_id, "is_pinned": message.is_pinned}

@router.delete("/{message_id}")
async def delete_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found.")

    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages.")

    chat_id = message.chat_id
    message.message_type = "deleted"
    message.content = "This message was deleted"
    message.file_url = None
    message.file_name = None
    message.file_size = None
    db.commit()

    await manager.broadcast_to_chat(
        chat_id, 
        "message_deleted", 
        {"message_id": message_id, "chat_id": chat_id}, 
        db
    )

    return {"message": "Message deleted successfully."}

@router.post("/seen/{chat_id}")
async def mark_messages_seen(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    membership = db.query(ChatMember).filter(
        ChatMember.chat_id == chat_id,
        ChatMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this chat.")

    now = datetime.now(timezone.utc)
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
