from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
import uuid

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.schemas import (
    UserCreate,
    UserLogin,
    UserFirebaseLogin,
    UserResponse,
    Token,
)
from backend.app.core.security import get_password_hash, verify_password, create_access_token
from backend.app.core.auth import verify_firebase_id_token, get_current_user
from backend.app.config import settings

router = APIRouter()

@router.post("/register", response_model=Token)
def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    """
    Standard Email/Password Registration.
    """
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.email == payload.email) | (User.username == payload.username)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or Email already registered."
        )

    # Hash the password
    hashed_pwd = get_password_hash(payload.password)
    
    # Create new user
    new_user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hashed_pwd,
        profile_photo=payload.profile_photo or f"https://api.dicebear.com/7.x/adventurer/svg?seed={payload.username}",
        status="offline"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate access token
    access_token = create_access_token(
        subject=new_user.id,
        email=new_user.email
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        profile_photo=new_user.profile_photo
    )

@router.post("/login", response_model=Token)
def login_user(payload: UserLogin, db: Session = Depends(get_db)):
    """
    Standard Email/Password Login.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )
        
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    # Generate access token
    access_token = create_access_token(
        subject=user.id,
        email=user.email
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        username=user.username,
        email=user.email,
        profile_photo=user.profile_photo
    )

@router.post("/verify", response_model=Token)
def verify_firebase(payload: UserFirebaseLogin, db: Session = Depends(get_db)):
    """
    Verifies Firebase Token, creates user if they don't exist, and returns custom session JWT.
    """
    firebase_claims = verify_firebase_id_token(payload.firebase_id_token)
    if not firebase_claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase token validation failed."
        )
        
    firebase_uid = firebase_claims.get("uid")
    email = firebase_claims.get("email")
    display_name = firebase_claims.get("name") or email.split("@")[0]
    picture = firebase_claims.get("picture")

    # Check if user exists by Firebase UID or Email
    user = db.query(User).filter(
        (User.firebase_uid == firebase_uid) | (User.email == email)
    ).first()
    
    if not user:
        # Generate a unique username if username is taken
        username = display_name.replace(" ", "_").lower()
        idx = 1
        base_username = username
        while db.query(User).filter(User.username == username).first() is not None:
            username = f"{base_username}_{idx}"
            idx += 1
            
        user = User(
            firebase_uid=firebase_uid,
            username=username,
            email=email,
            profile_photo=picture or f"https://api.dicebear.com/7.x/adventurer/svg?seed={username}",
            status="offline"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.firebase_uid:
        # Link existing email-registered user to Firebase UID
        user.firebase_uid = firebase_uid
        if picture and not user.profile_photo:
            user.profile_photo = picture
        db.commit()
        db.refresh(user)

    # Generate backend access token
    access_token = create_access_token(
        subject=user.id,
        email=user.email
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        username=user.username,
        email=user.email,
        profile_photo=user.profile_photo
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Retrieves the currently authenticated user's profile.
    """
    return current_user
