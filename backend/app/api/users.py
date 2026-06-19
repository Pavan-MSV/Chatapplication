from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.friendship import Friendship
from backend.app.schemas import (
    UserResponse,
    UserProfileUpdate,
    UserSearchResponse,
)
from backend.app.core.auth import get_current_user

router = APIRouter()

@router.put("/profile", response_model=UserResponse)
def update_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates the authenticated user's profile info.
    """
    if payload.username is not None:
        # Check if username already taken by another user
        existing = db.query(User).filter(
            User.username == payload.username,
            User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken."
            )
        current_user.username = payload.username

    if payload.profile_photo is not None:
        current_user.profile_photo = payload.profile_photo

    if payload.status is not None:
        current_user.status = payload.status

    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("/search", response_model=List[UserSearchResponse])
def search_users(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Searches users by username or email. Supporting exact or partial matches.
    """
    offset = (page - 1) * limit
    
    # Query users matching query (excluding the current user and the AI Assistant)
    ai_user_id = "00000000-0000-0000-0000-000000000000"
    query_pattern = f"%{q}%"
    # Fetch a pool of matching users (up to 100 matches to keep performance high)
    users_pool = db.query(User).filter(
        and_(
            or_(User.username.ilike(query_pattern), User.email.ilike(query_pattern)),
            User.id != current_user.id,
            User.id != ai_user_id
        )
    ).limit(100).all()

    # Sort matching users: exact match -> starts-with -> general partial match
    def get_sort_key(u):
        u_name = u.username.lower()
        u_email = u.email.lower()
        q_lower = q.lower()
        
        if u_name == q_lower:
            return 0
        if u_email == q_lower:
            return 1
        if u_name.startswith(q_lower):
            return 2
        if u_email.startswith(q_lower):
            return 3
        return 4

    users_pool.sort(key=get_sort_key)
    users = users_pool[offset : offset + limit]

    results = []
    for user in users:
        # Check if friendship exists
        friendship = db.query(Friendship).filter(
            or_(
                and_(Friendship.sender_id == current_user.id, Friendship.receiver_id == user.id),
                and_(Friendship.sender_id == user.id, Friendship.receiver_id == current_user.id)
            )
        ).first()

        status_str = None
        if friendship:
            if friendship.status == "pending":
                if friendship.sender_id == current_user.id:
                    status_str = "sent_pending"
                else:
                    status_str = "received_pending"
            else:
                status_str = friendship.status

        results.append(
            UserSearchResponse(
                id=user.id,
                username=user.username,
                email=user.email,
                profile_photo=user.profile_photo,
                status=user.status,
                friendship_status=status_str
            )
        )

    return results

@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves user profile details by ID.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    return user
