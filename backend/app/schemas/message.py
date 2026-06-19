from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class MessageCreate(BaseModel):
    chat_id: str
    content: Optional[str] = None
    message_type: str = "text"  # text, image, file, voice
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None

class MessageResponse(BaseModel):
    id: str
    chat_id: str
    sender_id: str
    content: Optional[str] = None
    message_type: str
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    is_seen: bool
    seen_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
