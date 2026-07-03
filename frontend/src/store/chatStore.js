import { create } from "zustand";
import axios from "axios";

import { API_BASE } from "../config/api";

const getHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

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
  typingMembers: {}, 
  onlineUsers: {},   

  // New Feature States
  replyingTo: null,
  pinnedMessages: [],
  mediaGallery: [],
  polls: [],
  activeCall: null,

  setChats: (chats) => set({ chats }),
  setReplyingTo: (msg) => set({ replyingTo: msg }),
  setActiveCall: (callState) => set({ activeCall: callState }),
  
  setActiveChatId: async (chatId) => {
    set({ activeChatId: chatId, replyingTo: null });
    if (chatId) {
      const chat = get().chats.find((c) => c.id === chatId);
      set({ activeChat: chat || null });
      
      await get().fetchMessages(chatId);
      get().fetchPinnedMessages(chatId);
      get().fetchPolls(chatId);
      
      set((state) => ({
        chats: state.chats.map((c) =>
          c.id === chatId ? { ...c, unread_count: 0 } : c
        ),
      }));

      try {
        await axios.post(`${API_BASE}/messages/seen/${chatId}`, {}, { headers: getHeaders() });
      } catch (err) {
        console.error("Failed to mark messages as seen:", err);
      }
    } else {
      set({ activeChat: null, messages: [], pinnedMessages: [], polls: [], mediaGallery: [] });
    }
  },

  fetchChats: async () => {
    try {
      const res = await axios.get(`${API_BASE}/chats`, { headers: getHeaders() });
      set({ chats: res.data });
      
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
    
    const userId = getUserIdFromToken();
    if (userId) {
      const deletedIds = JSON.parse(localStorage.getItem(`deletedForMe_${userId}`) || "[]");
      if (deletedIds.includes(message.id)) {
        return;
      }
    }
    
    if (message.chat_id === activeChatId) {
      if (!messages.find((m) => m.id === message.id)) {
        set({ messages: [...messages, message] });
      }
    }

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

  updateMessageReactions: (messageId, reactions) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, reactions } : m
      )
    }));
  },

  updateMessagePinStatus: (messageId, isPinned) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, is_pinned: isPinned } : m
      )
    }));
    if (get().activeChatId) {
      get().fetchPinnedMessages(get().activeChatId);
    }
  },

  toggleReaction: async (messageId, emoji) => {
    try {
      const res = await axios.post(`${API_BASE}/messages/${messageId}/react`, { emoji }, { headers: getHeaders() });
      get().updateMessageReactions(messageId, res.data.reactions);
    } catch (err) {
      console.error("Error toggling reaction:", err);
    }
  },

  togglePinMessage: async (messageId) => {
    try {
      const res = await axios.post(`${API_BASE}/messages/${messageId}/pin`, {}, { headers: getHeaders() });
      get().updateMessagePinStatus(messageId, res.data.is_pinned);
    } catch (err) {
      console.error("Error pinning message:", err);
    }
  },

  fetchPinnedMessages: async (chatId) => {
    if (!chatId) return;
    try {
      const res = await axios.get(`${API_BASE}/chats/${chatId}/pinned`, { headers: getHeaders() });
      set({ pinnedMessages: res.data });
    } catch (err) {
      console.error("Error fetching pinned messages:", err);
    }
  },

  fetchMediaGallery: async (chatId) => {
    if (!chatId) return;
    try {
      const res = await axios.get(`${API_BASE}/chats/${chatId}/media`, { headers: getHeaders() });
      set({ mediaGallery: res.data });
    } catch (err) {
      console.error("Error fetching chat media:", err);
    }
  },

  fetchPolls: async (chatId) => {
    if (!chatId) return;
    try {
      const res = await axios.get(`${API_BASE}/chats/${chatId}/polls`, { headers: getHeaders() });
      set({ polls: res.data });
    } catch (err) {
      console.error("Error fetching polls:", err);
    }
  },

  createPoll: async (chatId, question, options) => {
    try {
      const res = await axios.post(`${API_BASE}/chats/${chatId}/polls`, { question, options }, { headers: getHeaders() });
      set((state) => ({ polls: [res.data, ...state.polls] }));
      get().fetchMessages(chatId);
    } catch (err) {
      console.error("Error creating poll:", err);
    }
  },

  votePoll: async (chatId, pollId, optionId) => {
    try {
      const res = await axios.post(`${API_BASE}/chats/${chatId}/polls/${pollId}/vote`, { option_id: optionId }, { headers: getHeaders() });
      set((state) => ({
        polls: state.polls.map((p) => (p.id === pollId ? res.data : p))
      }));
    } catch (err) {
      console.error("Error voting in poll:", err);
    }
  },

  updatePollState: (pollData) => {
    set((state) => ({
      polls: state.polls.some((p) => p.id === pollData.id)
        ? state.polls.map((p) => (p.id === pollData.id ? pollData : p))
        : [pollData, ...state.polls]
    }));
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
