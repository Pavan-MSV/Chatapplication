from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str  # friend_request, request_accepted, new_message, group_invite
    title: str
    content: str
    is_read: bool
    reference_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
