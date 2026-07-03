from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import json

from backend.app.config import settings
from backend.app.database import init_db, SessionLocal
from backend.app.core.security import decode_access_token
from backend.app.core.websocket import manager
from backend.app.models.user import User
from backend.app.models.message import Message

# Import API routers
from backend.app.api.auth import router as auth_router
from backend.app.api.users import router as users_router
from backend.app.api.friends import router as friends_router
from backend.app.api.chats import router as chats_router
from backend.app.api.messages import router as messages_router
from backend.app.api.ai import router as ai_router
from backend.app.api.notifications import router as notifications_router

app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0")

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://chatapplication-0308.web.app",
        "https://chatsphere-frontend-20wo.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database tables and seed values on startup
@app.on_event("startup")
def on_startup():
    init_db()

# Mount routers
app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(users_router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(friends_router, prefix=f"{settings.API_V1_STR}/friends", tags=["friends"])
app.include_router(chats_router, prefix=f"{settings.API_V1_STR}/chats", tags=["chats"])
app.include_router(messages_router, prefix=f"{settings.API_V1_STR}/messages", tags=["messages"])
app.include_router(ai_router, prefix=f"{settings.API_V1_STR}/ai", tags=["ai"])
app.include_router(notifications_router, prefix=f"{settings.API_V1_STR}/notifications", tags=["notifications"])

@app.get("/")
def read_root():
    return {"message": "Welcome to ChatSphere AI backend server!"}

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
):
    """
    WebSocket connection endpoint. Authenticates via JWT query parameter,
    registers connection, and listens for real-time events.
    """
    # Authenticate user from JWT token
    claims = decode_access_token(token)
    user_id = claims.get("sub")
    
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Add connection
    await manager.connect(user_id, websocket)
    
    db = SessionLocal()
    try:
        # Fetch connecting user info
        user = db.query(User).filter(User.id == user_id).first()
        username = user.username if user else "User"

        # Continuous listening loop for incoming frames
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            event = payload.get("event")
            event_data = payload.get("data", {})

            if event == "typing_start":
                chat_id = event_data.get("chat_id")
                if chat_id:
                    await manager.broadcast_to_chat(
                        chat_id=chat_id,
                        event_type="typing_update",
                        data={
                            "chat_id": chat_id,
                            "user_id": user_id,
                            "username": username,
                            "is_typing": True
                        },
                        db=db
                    )

            elif event == "typing_stop":
                chat_id = event_data.get("chat_id")
                if chat_id:
                    await manager.broadcast_to_chat(
                        chat_id=chat_id,
                        event_type="typing_update",
                        data={
                            "chat_id": chat_id,
                            "user_id": user_id,
                            "username": username,
                            "is_typing": False
                        },
                        db=db
                    )

            elif event == "mark_seen":
                chat_id = event_data.get("chat_id")
                if chat_id:
                    # Mark messages as seen in DB
                    from datetime import datetime, timezone
                    now = datetime.now(timezone.utc)
                    unread = db.query(Message).filter(
                        Message.chat_id == chat_id,
                        Message.sender_id != user_id,
                        Message.is_seen == False
                    ).all()
                    
                    if unread:
                        for m in unread:
                            m.is_seen = True
                            m.seen_at = now
                        db.commit()
                        
                        await manager.broadcast_to_chat(
                            chat_id=chat_id,
                            event_type="messages_seen",
                            data={
                                "chat_id": chat_id,
                                "seen_by": user_id,
                                "seen_at": now.isoformat()
                            },
                            db=db
                        )

            elif event == "webrtc_signal":
                target_user_id = event_data.get("target_user_id")
                chat_id = event_data.get("chat_id")
                signal_payload = {
                    "sender_id": user_id,
                    "sender_username": username,
                    "chat_id": chat_id,
                    "signal_type": event_data.get("signal_type"), # offer, answer, ice_candidate, end_call, call_request
                    "sdp": event_data.get("sdp"),
                    "candidate": event_data.get("candidate"),
                    "call_type": event_data.get("call_type", "video") # video or voice
                }

                if target_user_id:
                    await manager.send_to_user(target_user_id, "webrtc_signal", signal_payload)
                elif chat_id:
                    await manager.broadcast_to_chat(chat_id, "webrtc_signal", signal_payload, db)


    except WebSocketDisconnect:
        await manager.disconnect(user_id, websocket)
    except Exception as e:
        print(f"WebSocket Error: {e}")
        await manager.disconnect(user_id, websocket)
    finally:
        db.close()
