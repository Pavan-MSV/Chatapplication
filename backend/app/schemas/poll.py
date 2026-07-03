from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class PollOptionCreate(BaseModel):
    option_text: str

class PollCreate(BaseModel):
    chat_id: str
    question: str
    options: List[str]

class PollVoteCreate(BaseModel):
    option_id: str

class PollOptionResponse(BaseModel):
    id: str
    option_text: str
    vote_count: int = 0
    voted_by_me: bool = False

    class Config:
        from_attributes = True

class PollResponse(BaseModel):
    id: str
    chat_id: str
    message_id: Optional[str] = None
    creator_id: str
    creator_username: Optional[str] = None
    question: str
    is_closed: bool = False
    options: List[PollOptionResponse] = []
    total_votes: int = 0
    created_at: datetime

    class Config:
        from_attributes = True
