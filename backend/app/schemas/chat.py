from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from backend.app.schemas.user import UserResponse

class ChatCreate(BaseModel):
    is_group: bool = False
    name: Optional[str] = None
    description: Optional[str] = None
    icon_url: Optional[str] = None
    member_ids: List[str]  # List of initial user IDs to add

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon_url: Optional[str] = None
    member_ids: List[str]

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon_url: Optional[str] = None

class ChatMemberResponse(BaseModel):
    id: str
    chat_id: str
    user: UserResponse
    role: str  # admin, member
    joined_at: datetime

    class Config:
        from_attributes = True

class ChatResponse(BaseModel):
    id: str
    is_group: bool
    name: Optional[str] = None
    description: Optional[str] = None
    icon_url: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    members: List[ChatMemberResponse] = []
    
    # Custom attributes for convenience
    last_message_content: Optional[str] = None
    last_message_time: Optional[datetime] = None
    unread_count: Optional[int] = 0

    class Config:
        from_attributes = True
