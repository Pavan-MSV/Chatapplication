import { create } from "zustand";
import axios from "axios";

import { API_BASE } from "../config/api";

const getHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) => {
    const unread = notifications.filter((n) => !n.is_read).length;
    set({ notifications, unreadCount: unread });
  },

  addNotification: (notification) => {
    set((state) => {
      const exists = state.notifications.find((n) => n.id === notification.id);
      if (exists) return state;
      const updated = [notification, ...state.notifications];
      return {
        notifications: updated,
        unreadCount: state.unreadCount + (notification.is_read ? 0 : 1)
      };
    });
  },

  fetchNotifications: async () => {
    try {
      const res = await axios.get(`${API_BASE}/notifications`, { headers: getHeaders() });
      const unreadCountRes = await axios.get(`${API_BASE}/notifications/unread/count`, { headers: getHeaders() });
      set({ 
        notifications: res.data, 
        unreadCount: unreadCountRes.data.unread_count 
      });
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  },

  markAllAsRead: async () => {
    try {
      await axios.post(`${API_BASE}/notifications/read`, {}, { headers: getHeaders() });
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0
      }));
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  },

  markAsRead: async (notifId) => {
    try {
      await axios.post(`${API_BASE}/notifications/read?notification_id=${notifId}`, {}, { headers: getHeaders() });
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notifId ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  }
}));
