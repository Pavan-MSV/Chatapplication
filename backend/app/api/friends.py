from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.friendship import Friendship
from backend.app.models.chat import Chat, ChatMember
from backend.app.models.notification import Notification
from backend.app.schemas import (
    FriendRequestCreate,
    FriendshipAction,
    FriendshipResponse,
    FriendshipDetailResponse,
    UserResponse,
)
from backend.app.core.auth import get_current_user
from backend.app.core.websocket import manager

router = APIRouter()

@router.post("/request", response_model=FriendshipResponse)
async def send_friend_request(
    payload: FriendRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sends a friend request to a user by username or email.
    """
    target = db.query(User).filter(
        or_(User.username == payload.receiver_username_or_email, User.email == payload.receiver_username_or_email)
    ).first()

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    if target.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot send a friend request to yourself."
        )

    # Check if a friendship already exists
    existing = db.query(Friendship).filter(
        or_(
            and_(Friendship.sender_id == current_user.id, Friendship.receiver_id == target.id),
            and_(Friendship.sender_id == target.id, Friendship.receiver_id == current_user.id)
        )
    ).first()

    if existing:
        if existing.status == "accepted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already friends."
            )
        elif existing.status == "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A friend request is already pending between you."
            )
        elif existing.status == "blocked":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Communication is blocked."
            )
        else:
            # Re-open rejected request
            existing.status = "pending"
            existing.sender_id = current_user.id
            existing.receiver_id = target.id
            db.commit()
            db.refresh(existing)
            friendship = existing
    else:
        friendship = Friendship(
            sender_id=current_user.id,
            receiver_id=target.id,
            status="pending"
        )
        db.add(friendship)
        db.commit()
        db.refresh(friendship)

    # Create notification
    notif = Notification(
        user_id=target.id,
        type="friend_request",
        title="New Friend Request",
        content=f"@{current_user.username} sent you a friend request.",
        reference_id=friendship.id
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    # Send WebSocket notification to receiver if online
    await manager.send_to_user(
        target.id, 
        "notification", 
        {
            "id": notif.id,
            "type": notif.type,
            "title": notif.title,
            "content": notif.content,
            "reference_id": notif.reference_id,
            "created_at": notif.created_at.isoformat()
        }
    )

    return friendship

@router.post("/respond", response_model=FriendshipResponse)
async def respond_to_friend_request(
    payload: FriendshipAction,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accepts, rejects, or blocks a friend request.
    """
    friendship = db.query(Friendship).filter(Friendship.id == payload.request_id).first()
    if not friendship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend request not found."
        )

    # Validate roles
    is_sender = friendship.sender_id == current_user.id
    is_receiver = friendship.receiver_id == current_user.id

    if payload.action == "accept":
        if not is_receiver:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the receiver can accept a friend request."
            )
        if friendship.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot accept friendship in status: {friendship.status}"
            )

        friendship.status = "accepted"
        db.commit()

        # Automatic DM Chat creation
        # First check if DM chat already exists
        dm_chat = db.query(Chat).filter(
            Chat.is_group == False,
            Chat.id.in_(
                db.query(ChatMember.chat_id).filter(ChatMember.user_id == current_user.id)
            ),
            Chat.id.in_(
                db.query(ChatMember.chat_id).filter(ChatMember.user_id == friendship.sender_id)
            )
        ).first()

        if not dm_chat:
            dm_chat = Chat(is_group=False)
            db.add(dm_chat)
            db.commit()
            db.refresh(dm_chat)

            member1 = ChatMember(chat_id=dm_chat.id, user_id=current_user.id, role="member")
            member2 = ChatMember(chat_id=dm_chat.id, user_id=friendship.sender_id, role="member")
            db.add_all([member1, member2])
            db.commit()

        # Notify sender
        sender = db.query(User).filter(User.id == friendship.sender_id).first()
        notif = Notification(
            user_id=friendship.sender_id,
            type="request_accepted",
            title="Friend Request Accepted",
            content=f"@{current_user.username} accepted your friend request.",
            reference_id=dm_chat.id
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)

        # Notify sender via WebSocket
        await manager.send_to_user(
            friendship.sender_id, 
            "notification", 
            {
                "id": notif.id,
                "type": notif.type,
                "title": notif.title,
                "content": notif.content,
                "reference_id": notif.reference_id,
                "created_at": notif.created_at.isoformat()
            }
        )
        
        # Trigger WS event that friendship was accepted (for active stores updates)
        await manager.send_to_user(friendship.sender_id, "request_accepted", {"friend_id": current_user.id})
        await manager.send_to_user(current_user.id, "request_accepted", {"friend_id": friendship.sender_id})

    elif payload.action == "reject":
        if not is_receiver:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the receiver can reject a friend request."
            )
        # Delete friendship row to allow requests again later
        db.delete(friendship)
        db.commit()
        return FriendshipResponse(
            id=payload.request_id,
            sender_id=friendship.sender_id,
            receiver_id=friendship.receiver_id,
            status="rejected",
            created_at=friendship.created_at,
            updated_at=friendship.updated_at
        )

    elif payload.action == "block":
        friendship.status = "blocked"
        # The one who triggered blocking is now stored as the sender to track block direction
        friendship.sender_id = current_user.id
        db.commit()

    elif payload.action == "unblock":
        if friendship.status != "blocked" or friendship.sender_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You can only unblock relationships that you blocked."
            )
        # Delete friendship row entirely to clear relationship
        db.delete(friendship)
        db.commit()
        return FriendshipResponse(
            id=payload.request_id,
            sender_id=friendship.sender_id,
            receiver_id=friendship.receiver_id,
            status="unblocked",
            created_at=friendship.created_at,
            updated_at=friendship.updated_at
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid action. Choose accept, reject, block, unblock."
        )

    db.refresh(friendship)
    return friendship

@router.get("/list", response_model=List[UserResponse])
def list_friends(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists all accepted friends.
    """
    friendships = db.query(Friendship).filter(
        ((Friendship.sender_id == current_user.id) | (Friendship.receiver_id == current_user.id)) &
        (Friendship.status == "accepted")
    ).all()

    friend_ids = []
    for f in friendships:
        if f.sender_id == current_user.id:
            friend_ids.append(f.receiver_id)
        else:
            friend_ids.append(f.sender_id)

    friends = db.query(User).filter(User.id.in_(friend_ids)).all()
    return friends

@router.get("/requests/pending", response_model=List[FriendshipDetailResponse])
def get_pending_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists all pending friend requests received by current user.
    """
    friendships = db.query(Friendship).filter(
        Friendship.receiver_id == current_user.id,
        Friendship.status == "pending"
    ).all()
    
    result = []
    for f in friendships:
        sender_user = db.query(User).filter(User.id == f.sender_id).first()
        receiver_user = db.query(User).filter(User.id == f.receiver_id).first()
        result.append(
            FriendshipDetailResponse(
                id=f.id,
                status=f.status,
                sender=UserResponse.model_validate(sender_user),
                receiver=UserResponse.model_validate(receiver_user),
                created_at=f.created_at
            )
        )
    return result
