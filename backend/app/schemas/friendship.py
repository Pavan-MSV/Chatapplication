from pydantic import BaseModel
from datetime import datetime
from backend.app.schemas.user import UserResponse

class FriendRequestCreate(BaseModel):
    receiver_username_or_email: str

class FriendshipAction(BaseModel):
    request_id: str
    action: str  # accept, reject, block, unblock

class FriendshipResponse(BaseModel):
    id: str
    sender_id: str
    receiver_id: str
    status: str  # pending, accepted, rejected, blocked
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class FriendshipDetailResponse(BaseModel):
    id: str
    status: str
    sender: UserResponse
    receiver: UserResponse
    created_at: datetime

    class Config:
        from_attributes = True
