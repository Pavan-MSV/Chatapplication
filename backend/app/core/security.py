from datetime import datetime, timedelta, timezone
from typing import Any, Union
from jose import jwt
import bcrypt
from backend.app.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain text password against its bcrypt hashed counterpart.
    """
    if not hashed_password:
        return False
    try:
        # bcrypt requires bytes for both arguments
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), 
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """
    Generates a bcrypt hash of a plain text password.
    """
    # Generate salt and compute hash
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def create_access_token(
    subject: Union[str, Any], 
    email: str,
    expires_delta: timedelta = None
) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {
        "exp": expire, 
        "sub": str(subject), 
        "email": email
    }
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.JWT_SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    try:
        decoded_token = jwt.decode(
            token, 
            settings.JWT_SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        return decoded_token
    except jwt.JWTError:
        return {}
        
def get_user_from_token_claims(token: str) -> dict:
    claims = decode_access_token(token)
    if not claims:
        return {}
    return {
        "user_id": claims.get("sub"),
        "email": claims.get("email")
    }
