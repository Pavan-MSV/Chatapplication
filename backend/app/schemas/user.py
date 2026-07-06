from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str
    firebase_uid: Optional[str] = None
    profile_photo: Optional[str] = None
    phone_number: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserFirebaseRegister(BaseModel):
    firebase_id_token: str
    username: str

class UserFirebaseLogin(BaseModel):
    firebase_id_token: str

class UserResponse(UserBase):
    id: str
    profile_photo: Optional[str] = None
    status: str
    last_seen: Optional[datetime] = None
    created_at: datetime
    phone_number: Optional[str] = None

    class Config:
        from_attributes = True

class UserProfileUpdate(BaseModel):
    username: Optional[str] = None
    profile_photo: Optional[str] = None
    status: Optional[str] = None

class UserSearchResponse(BaseModel):
    id: str
    username: str
    email: str
    profile_photo: Optional[str] = None
    status: str
    phone_number: Optional[str] = None
    friendship_status: Optional[str] = None  # pending, accepted, rejected, blocked, or None

    class Config:
        from_attributes = True
