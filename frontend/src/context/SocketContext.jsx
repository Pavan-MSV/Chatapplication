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
  const markMessageDeleted = useChatStore((s) => s.markMessageDeleted);
  const updateMessageReactions = useChatStore((s) => s.updateMessageReactions);
  const updateMessagePinStatus = useChatStore((s) => s.updateMessagePinStatus);
  const updatePollState = useChatStore((s) => s.updatePollState);
  const setActiveCall = useChatStore((s) => s.setActiveCall);
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
            markMessageDeleted(data.message_id, data.chat_id);
            break;

          case "reaction_update":
            updateMessageReactions(data.message_id, data.reactions);
            break;

          case "pin_update":
            updateMessagePinStatus(data.message_id, data.is_pinned);
            break;

          case "poll_created":
          case "poll_voted":
            updatePollState(data.poll);
            break;

          case "webrtc_signal":
            if (data.signal_type === "call_request") {
              setActiveCall({
                isIncoming: true,
                callerName: data.sender_username,
                callerId: data.sender_id,
                chatId: data.chat_id,
                callType: data.call_type || "video"
              });
            } else if (data.signal_type === "end_call") {
              setActiveCall(null);
            }
            break;
            
          case "typing_update":
            setTyping(data.chat_id, data.user_id, data.username, data.is_typing);
            break;
            
          case "status_update":
            setOnlineStatus(data.user_id, data.status);
            break;
            
          case "notification":
            addNotification(data);
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

  const sendWebRTCSignal = (signalData) => {
    if (socketRef.current && isConnected) {
      socketRef.current.send(
        JSON.stringify({
          event: "webrtc_signal",
          data: signalData
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
        sendMarkSeen,
        sendWebRTCSignal
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
