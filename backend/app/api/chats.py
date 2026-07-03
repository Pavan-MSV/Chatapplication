from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.chat import Chat, ChatMember
from backend.app.models.message import Message
from backend.app.models.notification import Notification
from backend.app.models.poll import Poll, PollOption, PollVote
from backend.app.models.reaction import MessageReaction
from backend.app.schemas import (
    ChatResponse,
    GroupCreate,
    GroupUpdate,
    ChatMemberResponse,
    PollCreate,
    PollVoteCreate,
    PollResponse,
)
from backend.app.core.auth import get_current_user
from backend.app.core.websocket import manager

router = APIRouter()

def format_poll_response(poll: Poll, db: Session, current_user_id: str) -> dict:
    options = db.query(PollOption).filter(PollOption.poll_id == poll.id).all()
    creator = db.query(User).filter(User.id == poll.creator_id).first()
    
    all_votes = db.query(PollVote).filter(PollVote.poll_id == poll.id).all()
    total_votes = len(all_votes)
    
    option_responses = []
    for opt in options:
        opt_votes = [v for v in all_votes if v.option_id == opt.id]
        voted_by_me = any(v.user_id == current_user_id for v in opt_votes)
        option_responses.append({
            "id": opt.id,
            "option_text": opt.option_text,
            "vote_count": len(opt_votes),
            "voted_by_me": voted_by_me
        })

    return {
        "id": poll.id,
        "chat_id": poll.chat_id,
        "message_id": poll.message_id,
        "creator_id": poll.creator_id,
        "creator_username": creator.username if creator else "User",
        "question": poll.question,
        "is_closed": poll.is_closed,
        "options": option_responses,
        "total_votes": total_votes,
        "created_at": poll.created_at
    }

@router.get("", response_model=List[ChatResponse])
def get_user_chats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_memberships = db.query(ChatMember).filter(ChatMember.user_id == current_user.id).all()
    chat_ids = [m.chat_id for m in user_memberships]
    chats = db.query(Chat).filter(Chat.id.in_(chat_ids)).all()

    response_chats = []
    for chat in chats:
        members = db.query(ChatMember).filter(ChatMember.chat_id == chat.id).all()
        
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

        last_msg = db.query(Message).filter(Message.chat_id == chat.id).order_by(Message.created_at.desc()).first()
        last_content = None
        last_time = None
        if last_msg:
            if last_msg.message_type == "text":
                last_content = last_msg.content
            else:
                last_content = f"[{last_msg.message_type.capitalize()} Attachment]"
            last_time = last_msg.created_at

        unread_count = db.query(Message).filter(
            Message.chat_id == chat.id,
            Message.sender_id != current_user.id,
            Message.is_seen == False
        ).count()

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

    admin_member = ChatMember(
        chat_id=chat.id,
        user_id=current_user.id,
        role="admin"
    )
    db.add(admin_member)

    member_ids = list(set(payload.member_ids))
    if current_user.id in member_ids:
        member_ids.remove(current_user.id)

    members_to_add = []
    for uid in member_ids:
        user = db.query(User).filter(User.id == uid).first()
        if user:
            members_to_add.append(
                ChatMember(chat_id=chat.id, user_id=uid, role="member")
            )
            
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

@router.get("/{chat_id}/pinned")
def get_pinned_messages(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetches all pinned messages in a chat.
    """
    membership = db.query(ChatMember).filter(
        ChatMember.chat_id == chat_id,
        ChatMember.user_id == current_user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a chat member.")

    pinned = db.query(Message).filter(
        Message.chat_id == chat_id,
        Message.is_pinned == True
    ).order_by(Message.pinned_at.desc()).all()

    all_users = db.query(User).all()
    user_map = {u.id: u.username for u in all_users}

    return [{
        "id": m.id,
        "chat_id": m.chat_id,
        "sender_id": m.sender_id,
        "sender_username": user_map.get(m.sender_id, "User"),
        "content": m.content,
        "message_type": m.message_type,
        "pinned_at": m.pinned_at.isoformat() if m.pinned_at else None
    } for m in pinned]

@router.get("/{chat_id}/media")
def get_chat_media(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetches all image, file, and voice messages in a chat for the Shared Media Gallery.
    """
    membership = db.query(ChatMember).filter(
        ChatMember.chat_id == chat_id,
        ChatMember.user_id == current_user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a chat member.")

    media_messages = db.query(Message).filter(
        Message.chat_id == chat_id,
        Message.message_type.in_(["image", "file", "voice"])
    ).order_by(Message.created_at.desc()).all()

    all_users = db.query(User).all()
    user_map = {u.id: u.username for u in all_users}

    return [{
        "id": m.id,
        "chat_id": m.chat_id,
        "sender_id": m.sender_id,
        "sender_username": user_map.get(m.sender_id, "User"),
        "content": m.content,
        "message_type": m.message_type,
        "file_url": m.file_url,
        "file_name": m.file_name,
        "file_size": m.file_size,
        "created_at": m.created_at.isoformat() if m.created_at else None
    } for m in media_messages]

@router.post("/{chat_id}/polls")
async def create_poll(
    chat_id: str,
    payload: PollCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates an in-chat interactive Poll and sends a poll message to the channel.
    """
    membership = db.query(ChatMember).filter(
        ChatMember.chat_id == chat_id,
        ChatMember.user_id == current_user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a chat member.")

    if len(payload.options) < 2:
        raise HTTPException(status_code=400, detail="Poll must have at least 2 options.")

    # Create message entry for poll
    msg = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        content=f"📊 Poll: {payload.question}",
        message_type="poll"
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Create Poll
    poll = Poll(
        chat_id=chat_id,
        message_id=msg.id,
        creator_id=current_user.id,
        question=payload.question
    )
    db.add(poll)
    db.commit()
    db.refresh(poll)

    # Create Poll Options
    for opt_text in payload.options:
        opt = PollOption(poll_id=poll.id, option_text=opt_text)
        db.add(opt)
    db.commit()

    poll_data = format_poll_response(poll, db, current_user.id)

    # Broadcast websocket event
    await manager.broadcast_to_chat(
        chat_id,
        "poll_created",
        {"chat_id": chat_id, "poll": poll_data},
        db
    )

    return poll_data

@router.get("/{chat_id}/polls")
def get_polls(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetches all active/closed polls in a chat channel.
    """
    membership = db.query(ChatMember).filter(
        ChatMember.chat_id == chat_id,
        ChatMember.user_id == current_user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a chat member.")

    polls = db.query(Poll).filter(Poll.chat_id == chat_id).order_by(Poll.created_at.desc()).all()
    return [format_poll_response(p, db, current_user.id) for p in polls]

@router.post("/{chat_id}/polls/{poll_id}/vote")
async def vote_poll(
    chat_id: str,
    poll_id: str,
    payload: PollVoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Votes on a poll option or updates an existing vote.
    """
    poll = db.query(Poll).filter(Poll.id == poll_id, Poll.chat_id == chat_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found.")

    if poll.is_closed:
        raise HTTPException(status_code=400, detail="Poll is closed.")

    existing_vote = db.query(PollVote).filter(
        PollVote.poll_id == poll_id,
        PollVote.user_id == current_user.id
    ).first()

    if existing_vote:
        existing_vote.option_id = payload.option_id
    else:
        new_vote = PollVote(
            poll_id=poll_id,
            option_id=payload.option_id,
            user_id=current_user.id
        )
        db.add(new_vote)

    db.commit()

    poll_data = format_poll_response(poll, db, current_user.id)

    await manager.broadcast_to_chat(
        chat_id,
        "poll_voted",
        {"chat_id": chat_id, "poll": poll_data},
        db
    )

    return poll_data

@router.put("/group/{chat_id}/members/{user_id}/role")
def update_member_role(
    chat_id: str,
    user_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates a group member's role (admin, moderator, member). Requires admin rights.
    """
    admin_check = db.query(ChatMember).filter(
        ChatMember.chat_id == chat_id,
        ChatMember.user_id == current_user.id,
        ChatMember.role == "admin"
    ).first()
    if not admin_check:
        raise HTTPException(status_code=403, detail="Only group admins can update member roles.")

    target_member = db.query(ChatMember).filter(
        ChatMember.chat_id == chat_id,
        ChatMember.user_id == user_id
    ).first()
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found.")

    new_role = payload.get("role", "member")
    if new_role not in ["admin", "moderator", "member"]:
        raise HTTPException(status_code=400, detail="Invalid role specified.")

    target_member.role = new_role
    db.commit()

    return {"message": "Role updated successfully.", "role": new_role}

@router.post("/group/{chat_id}/members")
async def add_group_member(
    chat_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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

    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.is_group == True).first()
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target chat is not a group."
        )

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
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.is_group == True).first()
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target chat is not a group."
        )

    target_member = db.query(ChatMember).filter(
        ChatMember.chat_id == chat_id,
        ChatMember.user_id == user_id
    ).first()
    
    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this group."
        )

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
