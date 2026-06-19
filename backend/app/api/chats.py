from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.chat import Chat, ChatMember
from backend.app.models.message import Message
from backend.app.models.notification import Notification
from backend.app.schemas import (
    ChatResponse,
    GroupCreate,
    GroupUpdate,
    ChatMemberResponse,
)
from backend.app.core.auth import get_current_user
from backend.app.core.websocket import manager

router = APIRouter()

@router.get("", response_model=List[ChatResponse])
def get_user_chats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves all chats (DMs and Groups) that the current user belongs to.
    Enriches the chats with last message details and unread count.
    """
    # Fetch member associations for the current user
    user_memberships = db.query(ChatMember).filter(ChatMember.user_id == current_user.id).all()
    chat_ids = [m.chat_id for m in user_memberships]

    # Query all those chats
    chats = db.query(Chat).filter(Chat.id.in_(chat_ids)).all()

    response_chats = []
    for chat in chats:
        # Fetch members for this chat
        members = db.query(ChatMember).filter(ChatMember.chat_id == chat.id).all()
        
        # Serialize members
        member_responses = []
        other_user = None
        for member in members:
            user = db.query(User).filter(User.id == member.user_id).first()
            if not user:
                continue
            if user.id != current_user.id:
                other_user = user
                
            member_responses.append(
                ChatMemberResponse(
                    id=member.id,
                    chat_id=member.chat_id,
                    role=member.role,
                    joined_at=member.joined_at,
                    user=user
                )
            )

        # Find last message
        last_msg = db.query(Message).filter(Message.chat_id == chat.id).order_by(Message.created_at.desc()).first()
        last_content = None
        last_time = None
        if last_msg:
            if last_msg.message_type == "text":
                last_content = last_msg.content
            else:
                last_content = f"[{last_msg.message_type.capitalize()} Attachment]"
            last_time = last_msg.created_at

        # Calculate unread count
        unread_count = db.query(Message).filter(
            Message.chat_id == chat.id,
            Message.sender_id != current_user.id,
            Message.is_seen == False
        ).count()

        # Build response schema. If DM, personalize chat name & icon using the other user's info
        chat_name = chat.name
        chat_icon = chat.icon_url
        chat_description = chat.description
        
        if not chat.is_group and other_user:
            chat_name = other_user.username
            chat_icon = other_user.profile_photo
            chat_description = f"Direct Message with @{other_user.username}"

        response_chats.append(
            ChatResponse(
                id=chat.id,
                is_group=chat.is_group,
                name=chat_name,
                description=chat_description,
                icon_url=chat_icon,
                created_by=chat.created_by,
                created_at=chat.created_at,
                members=member_responses,
                last_message_content=last_content,
                last_message_time=last_time,
                unread_count=unread_count
            )
        )

    # Sort chats by last message time, or creation time if no messages
    response_chats.sort(
        key=lambda x: x.last_message_time or x.created_at, 
        reverse=True
    )
    return response_chats

@router.post("/group", response_model=ChatResponse)
async def create_group(
    payload: GroupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a new Group Chat, adds the creator as admin, and seeds initial members.
    """
    # Create main chat
    chat = Chat(
        is_group=True,
        name=payload.name,
        description=payload.description,
        icon_url=payload.icon_url or f"https://api.dicebear.com/7.x/identicon/svg?seed={payload.name}",
        created_by=current_user.id
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)

    # Add creator as admin
    admin_member = ChatMember(
        chat_id=chat.id,
        user_id=current_user.id,
        role="admin"
    )
    db.add(admin_member)

    # Clean duplicates and remove creator ID if passed in list
    member_ids = list(set(payload.member_ids))
    if current_user.id in member_ids:
        member_ids.remove(current_user.id)

    # Add other members
    members_to_add = []
    for uid in member_ids:
        # Check if user exists
        user = db.query(User).filter(User.id == uid).first()
        if user:
            members_to_add.append(
                ChatMember(chat_id=chat.id, user_id=uid, role="member")
            )
            
            # Create notification for invitation
            notif = Notification(
                user_id=uid,
                type="group_invite",
                title="Added to Group",
                content=f"You were added to group '{chat.name}' by @{current_user.username}.",
                reference_id=chat.id
            )
            db.add(notif)
            
    if members_to_add:
        db.add_all(members_to_add)
    db.commit()

    # Query all added members to form detailed response
    db.refresh(chat)
    members = db.query(ChatMember).filter(ChatMember.chat_id == chat.id).all()
    member_responses = []
    for member in members:
        user = db.query(User).filter(User.id == member.user_id).first()
        member_responses.append(
            ChatMemberResponse(
                id=member.id,
                chat_id=member.chat_id,
                role=member.role,
                joined_at=member.joined_at,
                user=user
            )
        )

        # Notify members online
        if member.user_id != current_user.id:
            await manager.send_to_user(
                member.user_id, 
                "notification", 
                {
                    "type": "group_invite",
                    "title": "Group Invitation",
                    "content": f"You were added to group '{chat.name}'",
                    "reference_id": chat.id
                }
            )

    return ChatResponse(
        id=chat.id,
        is_group=chat.is_group,
        name=chat.name,
        description=chat.description,
        icon_url=chat.icon_url,
        created_by=chat.created_by,
        created_at=chat.created_at,
        members=member_responses
    )

@router.get("/{chat_id}", response_model=ChatResponse)
def get_chat_details(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves details of a single chat channel. Validates membership.
    """
    membership = db.query(ChatMember).filter(
        ChatMember.chat_id == chat_id,
        ChatMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this chat."
        )

    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found."
        )

    members = db.query(ChatMember).filter(ChatMember.chat_id == chat_id).all()
    member_responses = []
    other_user = None
    for member in members:
        user = db.query(User).filter(User.id == member.user_id).first()
        if user.id != current_user.id:
            other_user = user
        member_responses.append(
            ChatMemberResponse(
                id=member.id,
                chat_id=member.chat_id,
                role=member.role,
                joined_at=member.joined_at,
                user=user
            )
        )

    chat_name = chat.name
    chat_icon = chat.icon_url
    chat_description = chat.description
    
    if not chat.is_group and other_user:
        chat_name = other_user.username
        chat_icon = other_user.profile_photo
        chat_description = f"Direct Message with @{other_user.username}"

    return ChatResponse(
        id=chat.id,
        is_group=chat.is_group,
        name=chat_name,
        description=chat_description,
        icon_url=chat_icon,
        created_by=chat.created_by,
        created_at=chat.created_at,
        members=member_responses
    )

@router.post("/group/{chat_id}/members")
async def add_group_member(
    chat_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Adds a user to a group chat. Requires admin rights for group modifier.
    """
    # Verify current user is admin of group
    admin_check = db.query(ChatMember).filter(
        ChatMember.chat_id == chat_id,
        ChatMember.user_id == current_user.id,
        ChatMember.role == "admin"
    ).first()
    
    if not admin_check:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admins can add members."
        )

    # Verify chat is group
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.is_group == True).first()
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target chat is not a group."
        )

    # Check if target user already a member
    exists = db.query(ChatMember).filter(
        ChatMember.chat_id == chat_id,
        ChatMember.user_id == user_id
    ).first()
    
    if exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this group."
        )

    new_member = ChatMember(chat_id=chat_id, user_id=user_id, role="member")
    db.add(new_member)
    
    # Notify target user
    notif = Notification(
        user_id=user_id,
        type="group_invite",
        title="Added to Group",
        content=f"You were added to group '{chat.name}' by @{current_user.username}.",
        reference_id=chat_id
    )
    db.add(notif)
    db.commit()

    await manager.send_to_user(
        user_id, 
        "notification", 
        {
            "type": "group_invite",
            "title": "Group Invitation",
            "content": f"You were added to group '{chat.name}'",
            "reference_id": chat_id
        }
    )

    return {"message": "Member added successfully."}

@router.delete("/group/{chat_id}/members/{user_id}")
def remove_group_member(
    chat_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Removes a member from a group. Requires admin rights (unless user is leaving).
    """
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.is_group == True).first()
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target chat is not a group."
        )

    # Check target member
    target_member = db.query(ChatMember).filter(
        ChatMember.chat_id == chat_id,
        ChatMember.user_id == user_id
    ).first()
    
    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this group."
        )

    # Verify authorization (is admin or leaving themselves)
    is_leaving_self = (user_id == current_user.id)
    
    if not is_leaving_self:
        admin_check = db.query(ChatMember).filter(
            ChatMember.chat_id == chat_id,
            ChatMember.user_id == current_user.id,
            ChatMember.role == "admin"
        ).first()
        if not admin_check:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only group admins can remove members."
            )

    db.delete(target_member)
    db.commit()
    return {"message": "Member removed successfully."}

@router.put("/group/{chat_id}", response_model=ChatResponse)
def update_group(
    chat_id: str,
    payload: GroupUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates group details (name, description, icon). Requires admin role.
    """
    admin_check = db.query(ChatMember).filter(
        ChatMember.chat_id == chat_id,
        ChatMember.user_id == current_user.id,
        ChatMember.role == "admin"
    ).first()
    
    if not admin_check:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admins can edit group settings."
        )

    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.is_group == True).first()
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found."
        )

    if payload.name is not None:
        chat.name = payload.name
    if payload.description is not None:
        chat.description = payload.description
    if payload.icon_url is not None:
        chat.icon_url = payload.icon_url

    db.commit()
    db.refresh(chat)

    members = db.query(ChatMember).filter(ChatMember.chat_id == chat_id).all()
    member_responses = []
    for member in members:
        user = db.query(User).filter(User.id == member.user_id).first()
        member_responses.append(
            ChatMemberResponse(
                id=member.id,
                chat_id=member.chat_id,
                role=member.role,
                joined_at=member.joined_at,
                user=user
            )
        )

    return ChatResponse(
        id=chat.id,
        is_group=chat.is_group,
        name=chat.name,
        description=chat.description,
        icon_url=chat.icon_url,
        created_by=chat.created_by,
        created_at=chat.created_at,
        members=member_responses
    )
