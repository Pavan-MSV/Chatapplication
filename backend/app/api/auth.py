from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta, datetime, timezone
import uuid
import random
import os
from pydantic import BaseModel, EmailStr


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
from backend.app.core.email import send_otp_email

router = APIRouter()

class VerifyOTPPayload(BaseModel):
    email: EmailStr
    otp_code: str

class ResendOTPPayload(BaseModel):
    email: EmailStr

@router.post("/register")
def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    """
    Standard Email/Password Registration with OTP verification step.
    """
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.email == payload.email) | (User.username == payload.username)
    ).first()
    
    if existing_user:
        if existing_user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username or Email already registered."
            )
        else:
            # Reusing unverified user record
            if existing_user.username != payload.username:
                # Make sure the new username isn't taken by a verified user
                taken = db.query(User).filter(
                    User.username == payload.username,
                    User.is_verified == True
                ).first()
                if taken:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Username already taken."
                    )
                existing_user.username = payload.username
            
            existing_user.hashed_password = get_password_hash(payload.password)
            user = existing_user
    else:
        # Hash the password
        hashed_pwd = get_password_hash(payload.password)
        
        # Create new user (unverified)
        user = User(
            username=payload.username,
            email=payload.email,
            hashed_password=hashed_pwd,
            profile_photo=payload.profile_photo or f"https://api.dicebear.com/7.x/adventurer/svg?seed={payload.username}",
            status="offline",
            is_verified=False
        )
        db.add(user)

    # Generate 6-digit OTP code
    otp = str(random.randint(100000, 999999))
    user.otp_code = otp
    user.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    # Auto-verify in test or dev bypass environment
    import os
    if os.getenv("TESTING") == "True" or (settings.DEV_BYPASS_FIREBASE and os.getenv("TESTING") != "False"):
        user.is_verified = True
        user.otp_code = None
        user.otp_expires_at = None

        
    db.commit()
    db.refresh(user)

    if user.is_verified:
        # Generate access token directly for test/dev bypass
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


    # Send email containing verification OTP code
    send_otp_email(user.email, otp)
    
    return {
        "message": "Verification OTP sent. Please check your email.",
        "email": user.email,
        "is_verified": False
    }

@router.post("/verify-otp", response_model=Token)
def verify_otp(payload: VerifyOTPPayload, db: Session = Depends(get_db)):
    """
    Verifies user email using OTP, marks account as verified, and returns JWT session token.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified."
        )
    if not user.otp_code or user.otp_code != payload.otp_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code."
        )
    if not user.otp_expires_at or datetime.now(timezone.utc) > user.otp_expires_at.replace(tzinfo=timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired."
        )
        
    # Mark user as verified and clear OTP
    user.is_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()
    db.refresh(user)

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

@router.post("/resend-otp")
def resend_otp(payload: ResendOTPPayload, db: Session = Depends(get_db)):
    """
    Regenerates and resends registration verification OTP.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified."
        )
        
    otp = str(random.randint(100000, 999999))
    user.otp_code = otp
    user.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    db.commit()
    
    # Resend email containing verification OTP code
    send_otp_email(user.email, otp)
    
    return {"message": "Verification OTP resent successfully.", "email": user.email}

@router.post("/login", response_model=Token)
def login_user(payload: UserLogin, db: Session = Depends(get_db)):
    """
    Standard Email/Password Login. Rejects unverified accounts.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )
    
    # Account registered via Google — no password stored
    if not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account uses Google Sign-In. Please click 'Sign in with Google' to continue."
        )
        
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    if not user.is_verified:
        if settings.DEV_BYPASS_FIREBASE and os.getenv("TESTING") != "False":
            user.is_verified = True
            db.commit()
            db.refresh(user)
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified. Please verify your email first."
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
