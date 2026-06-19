import { create } from "zustand";
import axios from "axios";

import { API_BASE } from "../config/api";

// Helper to get headers
const getHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Helper to decode user ID from token
const getUserIdFromToken = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub;
  } catch (e) {
    return null;
  }
};

export const useChatStore = create((set, get) => ({
  chats: [],
  activeChatId: null,
  activeChat: null,
  messages: [],
  friends: [],
  pendingRequests: [],
  typingMembers: {}, // chat_id -> { user_id: username }
  onlineUsers: {},   // user_id -> status ('online' | 'offline' | 'away')

  setChats: (chats) => set({ chats }),
  
  setActiveChatId: async (chatId) => {
    set({ activeChatId: chatId });
    if (chatId) {
      // Find the chat object
      const chat = get().chats.find((c) => c.id === chatId);
      set({ activeChat: chat || null });
      
      // Fetch message history
      await get().fetchMessages(chatId);
      
      // Reset unread count for this chat locally
      set((state) => ({
        chats: state.chats.map((c) =>
          c.id === chatId ? { ...c, unread_count: 0 } : c
        ),
      }));

      // Trigger read receipt in backend
      try {
        await axios.post(`${API_BASE}/messages/seen/${chatId}`, {}, { headers: getHeaders() });
      } catch (err) {
        console.error("Failed to mark messages as seen:", err);
      }
    } else {
      set({ activeChat: null, messages: [] });
    }
  },

  fetchChats: async () => {
    try {
      const res = await axios.get(`${API_BASE}/chats`, { headers: getHeaders() });
      set({ chats: res.data });
      
      // Sync online statuses from chat members
      const statuses = { ...get().onlineUsers };
      res.data.forEach((chat) => {
        chat.members.forEach((m) => {
          statuses[m.user.id] = m.user.status;
        });
      });
      set({ onlineUsers: statuses });
    } catch (err) {
      console.error("Error fetching chats:", err);
    }
  },

  fetchMessages: async (chatId) => {
    try {
      const res = await axios.get(`${API_BASE}/messages?chat_id=${chatId}`, { headers: getHeaders() });
      
      const userId = getUserIdFromToken();
      let messages = res.data;
      if (userId) {
        const deletedIds = JSON.parse(localStorage.getItem(`deletedForMe_${userId}`) || "[]");
        if (deletedIds.length > 0) {
          messages = messages.filter((m) => !deletedIds.includes(m.id));
        }
      }
      
      set({ messages });
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  },

  addMessage: (message) => {
    const { messages, activeChatId, chats } = get();
    
    // Check if deleted for me
    const userId = getUserIdFromToken();
    if (userId) {
      const deletedIds = JSON.parse(localStorage.getItem(`deletedForMe_${userId}`) || "[]");
      if (deletedIds.includes(message.id)) {
        return;
      }
    }
    
    // If message belongs to active chat, append it
    if (message.chat_id === activeChatId) {
      // Avoid duplicates
      if (!messages.find((m) => m.id === message.id)) {
        set({ messages: [...messages, message] });
      }
    }

    // Update last message in the chat list and increment unread if not active chat
    set({
      chats: chats.map((c) => {
        if (c.id === message.chat_id) {
          return {
            ...c,
            last_message_content: message.message_type === "deleted"
              ? "This message was deleted"
              : (message.content || `[${message.message_type.toUpperCase()}]`),
            last_message_time: message.created_at,
            unread_count: message.chat_id !== activeChatId ? (c.unread_count || 0) + 1 : 0
          };
        }
        return c;
      })
    });
  },

  removeMessage: (messageId, chatId) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId)
    }));
  },

  markMessageDeleted: (messageId, chatId) => {
    set((state) => {
      const updatedMessages = state.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              message_type: "deleted",
              content: "This message was deleted",
              file_url: null,
              file_name: null,
              file_size: null,
            }
          : m
      );

      const lastMsgInChat = updatedMessages.filter((m) => m.chat_id === chatId).slice(-1)[0];

      return {
        messages: updatedMessages,
        chats: state.chats.map((c) => {
          if (c.id === chatId && lastMsgInChat && lastMsgInChat.id === messageId) {
            return {
              ...c,
              last_message_content: "This message was deleted",
            };
          }
          return c;
        })
      };
    });
  },

  deleteMessageForMe: (messageId, chatId) => {
    const userId = getUserIdFromToken();
    if (userId) {
      const deletedIds = JSON.parse(localStorage.getItem(`deletedForMe_${userId}`) || "[]");
      if (!deletedIds.includes(messageId)) {
        deletedIds.push(messageId);
        localStorage.setItem(`deletedForMe_${userId}`, JSON.stringify(deletedIds));
      }
    }

    set((state) => {
      const filteredMessages = state.messages.filter((m) => m.id !== messageId);
      const remainingMessagesInChat = filteredMessages.filter((m) => m.chat_id === chatId);
      const lastMsgInChat = remainingMessagesInChat.slice(-1)[0];

      return {
        messages: filteredMessages,
        chats: state.chats.map((c) => {
          if (c.id === chatId) {
            return {
              ...c,
              last_message_content: lastMsgInChat
                ? (lastMsgInChat.message_type === "deleted"
                    ? "This message was deleted"
                    : (lastMsgInChat.content || `[${lastMsgInChat.message_type.toUpperCase()}]`))
                : "No messages in this chat",
              last_message_time: lastMsgInChat ? lastMsgInChat.created_at : null
            };
          }
          return c;
        })
      };
    });
  },

  fetchFriends: async () => {
    try {
      const res = await axios.get(`${API_BASE}/friends/list`, { headers: getHeaders() });
      set({ friends: res.data });
      
      // Update online status mapping
      const statuses = { ...get().onlineUsers };
      res.data.forEach((f) => {
        statuses[f.id] = f.status;
      });
      set({ onlineUsers: statuses });
    } catch (err) {
      console.error("Error fetching friends:", err);
    }
  },

  fetchPendingRequests: async () => {
    try {
      const res = await axios.get(`${API_BASE}/friends/requests/pending`, { headers: getHeaders() });
      set({ pendingRequests: res.data });
    } catch (err) {
      console.error("Error fetching pending requests:", err);
    }
  },

  setOnlineStatus: (userId, status) => {
    set((state) => ({
      onlineUsers: {
        ...state.onlineUsers,
        [userId]: status
      }
    }));
  },

  setTyping: (chatId, userId, username, isTyping) => {
    set((state) => {
      const chatTyping = { ...state.typingMembers[chatId] } || {};
      if (isTyping) {
        chatTyping[userId] = username;
      } else {
        delete chatTyping[userId];
      }
      return {
        typingMembers: {
          ...state.typingMembers,
          [chatId]: chatTyping
        }
      };
    });
  }
}));
