import { create } from "zustand";
import axios from "axios";

const API_BASE = "http://localhost:8000/api";

// Helper to get headers
const getHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
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
      set({ messages: res.data });
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  },

  addMessage: (message) => {
    const { messages, activeChatId, chats } = get();
    
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
            last_message_content: message.content || `[${message.message_type.toUpperCase()}]`,
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
