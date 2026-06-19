from pydantic import BaseModel
from typing import List

class SmartRepliesResponse(BaseModel):
    suggestions: List[str]

class TranslateRequest(BaseModel):
    text: str
    target_language: str  # 'te' (Telugu), 'hi' (Hindi), 'en' (English)

class TranslateResponse(BaseModel):
    translated_text: str

class ChatSummaryResponse(BaseModel):
    summary: str
