import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/chatStore";
import { useNotificationStore } from "../store/notificationStore";
import { getWsUrl } from "../config/api";

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const addMessage = useChatStore((s) => s.addMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const setTyping = useChatStore((s) => s.setTyping);
  const setOnlineStatus = useChatStore((s) => s.setOnlineStatus);
  const fetchFriends = useChatStore((s) => s.fetchFriends);
  const fetchPendingRequests = useChatStore((s) => s.fetchPendingRequests);
  const fetchChats = useChatStore((s) => s.fetchChats);
  
  const addNotification = useNotificationStore((s) => s.addNotification);

  const connectSocket = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      if (socketRef.current) {
        socketRef.current.close();
      }
      return;
    }

    // Close existing connection if any
    if (socketRef.current) {
      socketRef.current.close();
    }

    const wsUrl = getWsUrl(token);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected successfully.");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { event: eventType, data } = payload;

        console.log(`WebSocket received event: ${eventType}`, data);

        switch (eventType) {
          case "receive_message":
            addMessage(data);
            break;
            
          case "message_deleted":
            removeMessage(data.message_id, data.chat_id);
            break;
            
          case "typing_update":
            setTyping(data.chat_id, data.user_id, data.username, data.is_typing);
            break;
            
          case "status_update":
            setOnlineStatus(data.user_id, data.status);
            break;
            
          case "notification":
            addNotification(data);
            // Refresh lists depending on notification actions
            if (data.type === "friend_request") {
              fetchPendingRequests();
            } else if (data.type === "request_accepted" || data.type === "group_invite") {
              fetchFriends();
              fetchChats();
            }
            break;
            
          case "request_accepted":
            fetchFriends();
            fetchChats();
            break;
            
          case "messages_seen":
            // Optional: trigger state updates for seen receipts
            break;

          default:
            console.log("Unhandled WebSocket event type:", eventType);
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed. Reconnecting in 3 seconds...");
      setIsConnected(false);
      socketRef.current = null;
      // Reconnect loop if user is still logged in
      setTimeout(() => {
        if (localStorage.getItem("token")) {
          connectSocket();
        }
      }, 3000);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      ws.close();
    };

    socketRef.current = ws;
  };

  useEffect(() => {
    connectSocket();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  // Event emitters
  const sendTypingStart = (chatId) => {
    if (socketRef.current && isConnected) {
      socketRef.current.send(
        JSON.stringify({
          event: "typing_start",
          data: { chat_id: chatId }
        })
      );
    }
  };

  const sendTypingStop = (chatId) => {
    if (socketRef.current && isConnected) {
      socketRef.current.send(
        JSON.stringify({
          event: "typing_stop",
          data: { chat_id: chatId }
        })
      );
    }
  };

  const sendMarkSeen = (chatId) => {
    if (socketRef.current && isConnected) {
      socketRef.current.send(
        JSON.stringify({
          event: "mark_seen",
          data: { chat_id: chatId }
        })
      );
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        connectSocket,
        sendTypingStart,
        sendTypingStop,
        sendMarkSeen
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
