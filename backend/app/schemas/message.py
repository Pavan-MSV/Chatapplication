from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class MessageReactionResponse(BaseModel):
    id: str
    message_id: str
    user_id: str
    username: Optional[str] = None
    emoji: str
    created_at: datetime

    class Config:
        from_attributes = True

class ReplyMessageSummary(BaseModel):
    id: str
    sender_id: str
    sender_username: Optional[str] = None
    content: Optional[str] = None
    message_type: str

    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    chat_id: str
    content: Optional[str] = None
    message_type: str = "text"  # text, image, file, voice, poll
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    reply_to_id: Optional[str] = None

class MessageResponse(BaseModel):
    id: str
    chat_id: str
    sender_id: str
    sender_username: Optional[str] = None
    content: Optional[str] = None
    message_type: str
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    is_seen: bool
    seen_at: Optional[datetime] = None
    created_at: datetime
    reply_to_id: Optional[str] = None
    reply_to: Optional[ReplyMessageSummary] = None
    is_pinned: bool = False
    pinned_at: Optional[datetime] = None
    transcription: Optional[str] = None
    reactions: List[MessageReactionResponse] = []

    class Config:
        from_attributes = True
