import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from backend.app.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)  # recipient
    type = Column(String, nullable=False)  # friend_request, request_accepted, new_message, group_invite
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    reference_id = Column(String, nullable=True)  # can store chat_id, message_id, friend_request_id
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
