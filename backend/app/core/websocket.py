from fastapi import WebSocket
from typing import Dict, List, Any
import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from backend.app.database import SessionLocal
from backend.app.models.user import User
from backend.app.models.chat import ChatMember
from backend.app.models.friendship import Friendship

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> List of active WebSockets (to support multiple tabs)
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        
        # Update user status to online in database
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.status = "online"
                db.commit()
                # Broadcast status change to friends
                await self.broadcast_status_to_friends(user_id, "online", db)
        except Exception as e:
            print(f"Error in connect WS: {e}")
        finally:
            db.close()

    async def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                
                # Update user status to offline/last_seen
                db = SessionLocal()
                try:
                    user = db.query(User).filter(User.id == user_id).first()
                    if user:
                        user.status = "offline"
                        user.last_seen = datetime.now(timezone.utc)
                        db.commit()
                        # Broadcast status change to friends
                        await self.broadcast_status_to_friends(
                            user_id, 
                            "offline", 
                            db, 
                            user.last_seen.isoformat()
                        )
                except Exception as e:
                    print(f"Error in disconnect WS: {e}")
                finally:
                    db.close()

    async def send_to_user(self, user_id: str, event_type: str, data: Any):
        """
        Sends a JSON event payload to all active connections of a specific user.
        """
        if user_id not in self.active_connections:
            return
            
        payload = {
            "event": event_type,
            "data": data
        }
        
        # Create a copy of connection list to prevent concurrent modifications
        sockets = list(self.active_connections[user_id])
        for ws in sockets:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                # Remove stale connection
                if ws in self.active_connections[user_id]:
                    self.active_connections[user_id].remove(ws)

    async def broadcast_to_chat(self, chat_id: str, event_type: str, data: Any, db: Session):
        """
        Sends a JSON event to all members of a chat who are currently online.
        """
        # Find all members of the chat
        members = db.query(ChatMember).filter(ChatMember.chat_id == chat_id).all()
        for member in members:
            await self.send_to_user(member.user_id, event_type, data)

    async def broadcast_status_to_friends(self, user_id: str, status: str, db: Session, last_seen: str = None):
        """
        Broadcasts status updates (online/offline) to all friends of the user.
        """
        # Get all accepted friends
        friends_query = db.query(Friendship).filter(
            ((Friendship.sender_id == user_id) | (Friendship.receiver_id == user_id)) &
            (Friendship.status == "accepted")
        ).all()
        
        friend_ids = []
        for f in friends_query:
            if f.sender_id == user_id:
                friend_ids.append(f.receiver_id)
            else:
                friend_ids.append(f.sender_id)
                
        status_data = {
            "user_id": user_id,
            "status": status,
            "last_seen": last_seen
        }
        
        for friend_id in friend_ids:
            await self.send_to_user(friend_id, "status_update", status_data)

manager = ConnectionManager()
