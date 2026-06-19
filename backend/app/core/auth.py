import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
import json

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.core.security import decode_access_token

# Initialize Firebase Admin if configuration exists
firebase_app = None
if settings.FIREBASE_CREDENTIALS_PATH:
    try:
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
        firebase_app = firebase_admin.initialize_app(cred)
    except Exception as e:
        print(f"Warning: Failed to initialize Firebase Admin with credentials: {e}")

security_scheme = HTTPBearer(auto_error=False)

def verify_firebase_id_token(token: str) -> Optional[dict]:
    """
    Verifies the Firebase ID token.
    If settings.DEV_BYPASS_FIREBASE is True, it allows bypassing or parses mock values.
    """
    if settings.DEV_BYPASS_FIREBASE:
        # Mock payload format for bypass mode: "mock:uid:email:username"
        if token.startswith("mock:"):
            parts = token.split(":")
            uid = parts[1] if len(parts) > 1 else "mock_uid"
            email = parts[2] if len(parts) > 2 else "mock@example.com"
            name = parts[3] if len(parts) > 3 else "mock_user"
            return {
                "uid": uid,
                "email": email,
                "name": name,
                "picture": None,
                "email_verified": True
            }
        
        # Or parse JWT format (sometimes Firebase tokens are sent even in dev mode)
        # Just extract without verifying if dev bypass is active
        try:
            from jose import jwt
            # Decode without signature verification for development ease
            claims = jwt.get_unverified_claims(token)
            if claims:
                return {
                    "uid": claims.get("user_id", claims.get("sub", "mock_uid")),
                    "email": claims.get("email", "mock@example.com"),
                    "name": claims.get("name", "mock_user"),
                    "picture": claims.get("picture"),
                    "email_verified": claims.get("email_verified", True)
                }
        except Exception:
            pass
            
        # Return fallback
        return {
            "uid": "mock_uid",
            "email": "mock@example.com",
            "name": "Mock User",
            "picture": None,
            "email_verified": True
        }

    if not firebase_app:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Firebase Admin is not configured. Enable DEV_BYPASS_FIREBASE for local development."
        )

    try:
        decoded_token = firebase_auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Firebase ID Token: {str(e)}"
        )

def get_current_user(
    auth_header: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    FastAPI dependency to retrieve the currently logged-in user from the custom JWT session token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Try token from header
    token = None
    if auth_header:
        token = auth_header.credentials
        
    if not token:
        raise credentials_exception

    claims = decode_access_token(token)
    user_id = claims.get("sub")
    if not user_id:
        raise credentials_exception
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    return user
