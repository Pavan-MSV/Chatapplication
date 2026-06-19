import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useChatStore } from "../store/chatStore";
import { useNotificationStore } from "../store/notificationStore";
import { useSocket } from "../context/SocketContext";
import axios from "axios";
import { 
  MessageSquare, Users, UserPlus, Bell, LogOut, Send, Paperclip, 
  Mic, Square, Play, Trash2, Moon, Sun, Search, X, Check, CheckCheck,
  Settings, Sparkles, Languages, FileText, CheckCircle, Info, ChevronRight
} from "lucide-react";

import { API_BASE } from "../config/api";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { 
    chats, activeChatId, activeChat, messages, friends, pendingRequests, 
    typingMembers, onlineUsers, fetchChats, setActiveChatId, fetchFriends, 
    fetchPendingRequests, setOnlineStatus 
  } = useChatStore();
  const { notifications, unreadCount, fetchNotifications, markAllAsRead, markAsRead } = useNotificationStore();
  const { sendTypingStart, sendTypingStop, sendMarkSeen } = useSocket();

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(true);

  // Search, Profile, Group Modals State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // Search Logic
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchPage, setSearchPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);

  // Group Creation State
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);

  // Profile Settings State
  const [newUsername, setNewUsername] = useState(user?.username || "");
  const [newStatus, setNewStatus] = useState(user?.status || "online");
  const [newPhoto, setNewPhoto] = useState(user?.profile_photo || "");

  // Translation & AI Suggestions State
  const [smartReplies, setSmartReplies] = useState([]);
  const [translatedMessages, setTranslatedMessages] = useState({}); // messageId -> translatedText
  const [translatingMessageId, setTranslatingMessageId] = useState(null);
  const [chatSummary, setChatSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Message Input State
  const [inputText, setInputText] = useState("");
  const [typingTimeoutRef, setTypingTimeoutRef] = useState(null);
  
  // File upload state
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);

  // Auto-scroll reference
  const messagesEndRef = useRef(null);

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Sync state on mount
  useEffect(() => {
    fetchChats();
    fetchFriends();
    fetchPendingRequests();
    fetchNotifications();
  }, []);

  // Set dark mode body class
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [darkMode]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    
    // Fetch smart replies whenever active messages list updates
    if (activeChatId && messages.length > 0) {
      fetchSmartReplies(activeChatId);
    } else {
      setSmartReplies([]);
    }
  }, [messages, activeChatId]);

  // Handle typing input triggers
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    
    if (activeChatId) {
      sendTypingStart(activeChatId);
      
      if (typingTimeoutRef) {
        clearTimeout(typingTimeoutRef);
      }
      
      const timeout = setTimeout(() => {
        sendTypingStop(activeChatId);
      }, 2000);
      
      setTypingTimeoutRef(timeout);
    }
  };

  // Send text message
  const handleSendMessage = async (textToSend = null) => {
    const content = textToSend || inputText;
    if (!content.trim() && !audioBlob) return;
    
    try {
      sendTypingStop(activeChatId);
      
      const payload = {
        chat_id: activeChatId,
        content: content.trim(),
        message_type: "text"
      };

      await axios.post(`${API_BASE}/messages`, payload, { headers: getHeaders() });
      if (!textToSend) setInputText("");
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // Fetch AI smart replies
  const fetchSmartReplies = async (chatId) => {
    try {
      const res = await axios.get(`${API_BASE}/ai/suggestions?chat_id=${chatId}`, { headers: getHeaders() });
      setSmartReplies(res.data.suggestions);
    } catch (err) {
      console.error("Error loading smart replies:", err);
    }
  };

  // Translate specific message
  const handleTranslateMessage = async (msgId, text, targetLang) => {
    setTranslatingMessageId(msgId);
    try {
      const res = await axios.post(`${API_BASE}/ai/translate`, {
        text,
        target_language: targetLang
      }, { headers: getHeaders() });
      
      setTranslatedMessages(prev => ({
        ...prev,
        [msgId]: res.data.translated_text
      }));
    } catch (err) {
      console.error("Translation failed:", err);
    } finally {
      setTranslatingMessageId(null);
    }
  };

  // Fetch AI Chat Summary
  const handleGetChatSummary = async () => {
    if (!activeChatId) return;
    setLoadingSummary(true);
    setIsSummaryOpen(true);
    try {
      const res = await axios.get(`${API_BASE}/ai/summary?chat_id=${activeChatId}`, { headers: getHeaders() });
      setChatSummary(res.data.summary);
    } catch (err) {
      console.error("Summary failed:", err);
      setChatSummary("Could not generate chat summary at this time.");
    } finally {
      setLoadingSummary(false);
    }
  };

  // Search Logic
  const handleSearchUsers = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    try {
      const res = await axios.get(`${API_BASE}/users/search?q=${searchQuery}&page=${searchPage}`, {
        headers: getHeaders()
      });
      setSearchResults(res.data);
      setHasSearched(true);
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  // Send Friend Request
  const handleSendRequest = async (username) => {
    try {
      await axios.post(`${API_BASE}/friends/request`, { receiver_username_or_email: username }, { headers: getHeaders() });
      // Re-trigger query
      const res = await axios.get(`${API_BASE}/users/search?q=${searchQuery}&page=${searchPage}`, { headers: getHeaders() });
      setSearchResults(res.data);
    } catch (err) {
      console.error("Error sending request:", err);
    }
  };

  // Accept/Reject request
  const handleFriendResponse = async (requestId, action) => {
    try {
      await axios.post(`${API_BASE}/friends/respond`, { request_id: requestId, action }, { headers: getHeaders() });
      fetchPendingRequests();
      fetchFriends();
      fetchChats();
      fetchNotifications();
    } catch (err) {
      console.error("Friend response error:", err);
    }
  };

  // Delete message
  const handleDeleteMessage = async (msgId) => {
    try {
      await axios.delete(`${API_BASE}/messages/${msgId}`, { headers: getHeaders() });
    } catch (err) {
      console.error("Delete message error:", err);
    }
  };

  // Update profile setting
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_BASE}/users/profile`, {
        username: newUsername,
        profile_photo: newPhoto,
        status: newStatus
      }, { headers: getHeaders() });
      
      // Update local storage / auth state
      setIsProfileOpen(false);
      window.location.reload();
    } catch (err) {
      console.error("Profile update error:", err);
    }
  };

  // Create Group Chat
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedGroupMembers.length === 0) return;

    try {
      const res = await axios.post(`${API_BASE}/chats/group`, {
        name: groupName,
        description: groupDesc,
        member_ids: selectedGroupMembers
      }, { headers: getHeaders() });

      setIsGroupOpen(false);
      setGroupName("");
      setGroupDesc("");
      setSelectedGroupMembers([]);
      fetchChats();
      setActiveChatId(res.data.id);
    } catch (err) {
      console.error("Group creation failed:", err);
    }
  };

  // File Upload Handlers
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      // In production, we upload directly to Firebase Storage using the Client SDK
      // For this portfolio code base, we mock file upload mapping by converting to base64
      // or creating an ObjectURL, or using placeholder file URLs so that they are instantly playable.
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const fileUrl = reader.result; // Data URL acts as mock Firebase Storage URL
        
        const payload = {
          chat_id: activeChatId,
          content: null,
          message_type: file.type.startsWith("image/") ? "image" : "file",
          file_url: fileUrl,
          file_name: file.name,
          file_size: file.size
        };

        await axios.post(`${API_BASE}/messages`, payload, { headers: getHeaders() });
        setUploadingFile(false);
      };
    } catch (err) {
      console.error("File upload failed:", err);
      setUploadingFile(false);
    }
  };

  // Voice recording triggers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
        setAudioBlob(blob);
        
        // Convert to dataURL to mock file upload
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const fileUrl = reader.result;
          
          const payload = {
            chat_id: activeChatId,
            content: null,
            message_type: "voice",
            file_url: fileUrl,
            file_name: "voice_note.ogg",
            file_size: blob.size
          };

          await axios.post(`${API_BASE}/messages`, payload, { headers: getHeaders() });
          setAudioBlob(null);
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error("Audio recording failed:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioBlob(null);
      clearInterval(timerRef.current);
    }
  };

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Compute typing list string
  const getTypingString = () => {
    if (!activeChatId || !typingMembers[activeChatId]) return "";
    const users = Object.values(typingMembers[activeChatId]);
    if (users.length === 0) return "";
    if (users.length === 1) return `@${users[0]} is typing...`;
    return `${users.map(u => `@${u}`).join(", ")} are typing...`;
  };

  return (
    <div className={`h-screen w-full flex overflow-hidden font-sans ${darkMode ? "dark bg-slate-950" : "bg-slate-50"}`}>
      
      {/* 1. SIDEBAR / CHATS PANEL */}
      <div className="w-80 h-full flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        
        {/* Sidebar Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <img 
              src={user?.profile_photo || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`} 
              alt="Avatar"
              className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 cursor-pointer hover:scale-105 transition-all"
              onClick={() => setIsProfileOpen(true)}
            />
            <div>
              <h4 className="font-semibold text-slate-800 dark:text-white leading-tight font-display">@{user?.username}</h4>
              <span className="text-xs text-brand-500 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                Active
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Search icon */}
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
              title="Search Users"
            >
              <Search className="w-4 h-4" />
            </button>
            
            {/* Create Group icon */}
            <button 
              onClick={() => setIsGroupOpen(true)}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
              title="Create Group Chat"
            >
              <Users className="w-4 h-4" />
            </button>

            {/* Notification Bell */}
            <button 
              onClick={() => setIsNotificationsOpen(true)}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 relative transition-colors"
              title="Alerts"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white dark:border-slate-900 animate-pulse"></span>
              )}
            </button>

            {/* Theme Toggle */}
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Log out */}
            <button 
              onClick={logout}
              className="p-2 hover:bg-red-100 dark:hover:bg-red-950/30 rounded-lg text-red-500 transition-colors"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chats List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2 space-y-1">
          <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Conversations</div>
          
          {chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500">
              <MessageSquare className="w-10 h-10 mb-2 opacity-30 text-brand-500" />
              <p className="text-sm font-medium">No active chats</p>
              <p className="text-xs mt-1">Search for friends and start chat requests to enable messaging.</p>
            </div>
          ) : (
            chats.map((chat) => {
              const isActive = chat.id === activeChatId;
              // Check if anyone in chat is typing
              const isTyping = typingMembers[chat.id] && Object.keys(typingMembers[chat.id]).length > 0;
              
              return (
                <div
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:scale-[1.01] ${
                    isActive 
                      ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-l-4 border-brand-500" 
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <div className="relative">
                    <img
                      src={chat.icon_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${chat.name}`}
                      alt="Chat Icon"
                      className="w-11 h-11 rounded-full border border-slate-200 dark:border-slate-750"
                    />
                    {!chat.is_group && (
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                        // We find the other user's presence state
                        chat.members.find(m => m.user.id !== user?.id)?.user.status === "online" 
                          ? "bg-brand-500" 
                          : "bg-slate-400"
                      }`}></span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h5 className="font-semibold text-sm truncate text-slate-900 dark:text-slate-100">{chat.name}</h5>
                      {chat.last_message_time && (
                        <span className="text-xxs text-slate-400 dark:text-slate-500">
                          {new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      {isTyping ? (
                        <span className="text-xs text-brand-500 dark:text-brand-400 font-medium animate-pulse">typing...</span>
                      ) : (
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate pr-2">
                          {chat.last_message_content || "No messages yet"}
                        </p>
                      )}
                      
                      {chat.unread_count > 0 && (
                        <span className="w-5 h-5 bg-brand-500 text-white rounded-full flex items-center justify-center text-xxs font-bold animate-bounce">
                          {chat.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. MAIN CHAT AREA */}
      <div className="flex-1 h-full flex flex-col bg-slate-100 dark:bg-slate-950">
        {activeChat ? (
          <>
            {/* Chat Room Header */}
            <div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
              <div className="flex items-center gap-3">
                <img
                  src={activeChat.icon_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${activeChat.name}`}
                  alt="Chat Icon"
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white leading-tight font-display">{activeChat.name}</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-md">
                    {activeChat.is_group ? activeChat.description : (
                      activeChat.members.find(m => m.user.id !== user?.id)?.user.status === "online" 
                        ? "Online" 
                        : "Offline"
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* AI Chat Summary icon */}
                <button
                  onClick={handleGetChatSummary}
                  className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/60 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  title="Generate Summary"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Summary</span>
                </button>
              </div>
            </div>

            {/* Messages List Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                  <MessageSquare className="w-12 h-12 mb-3 opacity-20 text-brand-500 animate-pulse" />
                  <p className="font-semibold text-sm">No messages in this chat room</p>
                  <p className="text-xs mt-1">Send a text, file, or voice message below to start chatting.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  const isAI = msg.sender_id === "00000000-0000-0000-0000-000000000000";
                  
                  return (
                    <div 
                      key={msg.id}
                      className={`flex flex-col group ${isMe ? "items-end" : "items-start"}`}
                    >
                      {/* Sender details */}
                      <span className="text-xxs font-semibold text-slate-400 dark:text-slate-500 mb-1 px-1 tracking-wider uppercase">
                        {isAI ? "🤖 AI Assistant" : (isMe ? "You" : `@${msg.sender_username || "User"}`)}
                      </span>

                      {/* Message Bubble Card */}
                      <div className="flex items-center gap-2 max-w-lg">
                        
                        {/* Right click/Hover delete icon for user's own messages */}
                        {isMe && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 dark:hover:bg-red-950/30 text-red-500 rounded-lg transition-all"
                            title="Delete message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <div className={`p-4 rounded-2xl shadow-sm text-sm border relative ${
                          isAI 
                            ? "bg-gradient-to-tr from-indigo-900 to-indigo-950 text-indigo-50 border-indigo-850/60" 
                            : (isMe 
                                ? "bg-brand-500 text-white border-brand-450" 
                                : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-800")
                        }`}>
                          
                          {/* File Attachment Bubble */}
                          {msg.message_type === "image" && (
                            <div className="mb-2 max-w-xs overflow-hidden rounded-lg border border-black/10">
                              <img src={msg.file_url} alt="Shared" className="w-full h-auto object-cover max-h-60" />
                            </div>
                          )}

                          {msg.message_type === "file" && (
                            <a 
                              href={msg.file_url} 
                              download={msg.file_name} 
                              className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl text-slate-700 dark:text-slate-200 mb-2 font-medium hover:underline hover:scale-[1.01] transition-all"
                            >
                              <FileText className="w-8 h-8 text-brand-500" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold truncate leading-normal">{msg.file_name}</p>
                                <p className="text-xxs text-slate-400 mt-0.5">{(msg.file_size / 1024).toFixed(1)} KB</p>
                              </div>
                            </a>
                          )}

                          {/* Voice Message Bubble */}
                          {msg.message_type === "voice" && (
                            <div className="flex items-center gap-3 py-1 mb-2 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                              <Mic className="w-5 h-5 text-brand-500 shrink-0" />
                              <audio src={msg.file_url} controls className="w-48 h-8 rounded-lg outline-none" />
                            </div>
                          )}

                          {/* Text Message Content */}
                          {msg.content && (
                            <p className="leading-relaxed break-words whitespace-pre-wrap">
                              {translatedMessages[msg.id] || msg.content}
                            </p>
                          )}

                          {/* Render Translation note if overlay active */}
                          {translatedMessages[msg.id] && (
                            <div className="text-xxs mt-2 pt-1 border-t border-white/20 dark:border-slate-800 text-slate-300 dark:text-slate-400 italic">
                              Translated from original content.
                            </div>
                          )}

                          {/* Timestamp & Status receipts */}
                          <div className="flex items-center justify-end gap-1.5 mt-2 text-xxs opacity-70">
                            <span>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && (
                              msg.is_seen ? (
                                <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-slate-300" />
                              )
                            )}
                          </div>
                        </div>

                        {/* Translation options popover for other's messages */}
                        {!isMe && !isAI && (
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1 shadow-md transition-all">
                            <button
                              onClick={() => handleTranslateMessage(msg.id, msg.content, "te")}
                              disabled={translatingMessageId === msg.id}
                              className="px-1.5 py-1 text-xxs hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-semibold transition-colors"
                              title="Translate to Telugu"
                            >
                              TEL
                            </button>
                            <button
                              onClick={() => handleTranslateMessage(msg.id, msg.content, "hi")}
                              disabled={translatingMessageId === msg.id}
                              className="px-1.5 py-1 text-xxs hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-semibold transition-colors"
                              title="Translate to Hindi"
                            >
                              HIN
                            </button>
                            {translatedMessages[msg.id] && (
                              <button
                                onClick={() => {
                                  const updated = { ...translatedMessages };
                                  delete updated[msg.id];
                                  setTranslatedMessages(updated);
                                }}
                                className="px-1 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 rounded transition-colors"
                                title="Reset Translation"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Live Typing Status Bar */}
            {getTypingString() && (
              <div className="px-6 py-1 text-xs text-brand-500 font-medium bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200/55 dark:border-slate-800/40 italic">
                {getTypingString()}
              </div>
            )}

            {/* Dynamic AI Smart Reply Suggester row */}
            {smartReplies.length > 0 && (
              <div className="px-6 py-2.5 flex items-center gap-2 overflow-x-auto bg-slate-50 dark:bg-slate-900/30 border-t border-slate-250/60 dark:border-slate-850/50">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 animate-pulse" />
                <span className="text-xxs font-bold text-indigo-400 uppercase tracking-wider shrink-0 mr-1.5">Smart Replies:</span>
                {smartReplies.map((reply, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(reply)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 hover:bg-brand-500 dark:hover:bg-brand-500 text-slate-700 dark:text-slate-300 hover:text-white dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:border-brand-500 dark:hover:border-brand-500 rounded-full shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all whitespace-nowrap"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* Chat Input Dock Area */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shrink-0">
              {/* Attachment selector */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-xl transition-colors shrink-0"
                title="Share image or file"
              >
                {uploadingFile ? (
                  <span className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin block"></span>
                ) : (
                  <Paperclip className="w-5 h-5" />
                )}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
                accept="image/*,application/pdf,.doc,.docx,.zip" 
              />

              {/* Main text box */}
              <input
                type="text"
                className="flex-1 bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                placeholder="Type a message... (Prefix with '@AI' to query assistant)"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                disabled={isRecording}
              />

              {/* Voice Message Recorder Panel */}
              <div className="flex items-center gap-1">
                {isRecording ? (
                  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 px-3 py-1.5 rounded-xl">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                    <span className="text-xs text-red-600 dark:text-red-400 font-semibold">{formatDuration(recordingDuration)}</span>
                    
                    <button 
                      onClick={stopRecording} 
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded"
                      title="Send Voice Note"
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </button>
                    <button 
                      onClick={cancelRecording} 
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 rounded"
                      title="Cancel Recording"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startRecording}
                    className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-xl transition-colors shrink-0"
                    title="Record voice message"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                )}

                {/* Send Button */}
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim()}
                  className="p-3 bg-brand-500 text-white rounded-xl shadow-md hover:bg-brand-400 disabled:opacity-50 disabled:pointer-events-none transition-all hover:scale-105 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 w-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 px-6 text-center">
            <div className="w-20 h-20 bg-gradient-to-tr from-brand-500 to-indigo-500 rounded-3xl flex items-center justify-center text-white mb-6 shadow-xl animate-pulse">
              <MessageSquare className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white font-display">Welcome to ChatSphere AI</h3>
            <p className="text-sm mt-2 max-w-sm leading-relaxed">
              Select an active conversation from the sidebar or click the search icon to query profiles, send friend requests, and start exchanging messages.
            </p>
            <div className="mt-8 flex items-center gap-4 text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Gemini API Enabled
              </span>
              <span className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg">
                <CheckCircle className="w-3.5 h-3.5 text-brand-500" />
                WebSockets Connected
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. MODALS AND SLIDE-OVER DRAWER OVERLAYS */}

      {/* Search Drawer Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex justify-start bg-slate-950/40 backdrop-blur-sm transition-all animate-fadeIn">
          <div className="w-80 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-850 p-6 flex flex-col justify-between shadow-2xl relative">
            <div>
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-bold text-slate-800 dark:text-white font-display flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-brand-500" />
                  Find Contacts
                </h4>
                <button onClick={() => { setIsSearchOpen(false); setSearchResults([]); setSearchQuery(""); setHasSearched(false); }} className="p-1.5 hover:bg-slate-150 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Form */}
              <form onSubmit={handleSearchUsers} className="relative mb-6">
                <input
                  type="text"
                  className="w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                  placeholder="Username or email... (e.g. @pavan)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </form>

              {/* Search Result Items */}
              <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-180px)] pr-1">
                {!hasSearched ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6 italic">Enter keyword and hit search to find contacts.</p>
                ) : searchResults.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6 italic">No users found.</p>
                ) : (
                  searchResults.map((userItem) => (
                    <div key={userItem.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-855 rounded-xl">
                      <div className="flex items-center gap-3">
                        <img
                          src={userItem.profile_photo || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userItem.username}`}
                          alt="Avatar"
                          className="w-9 h-9 rounded-full"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate text-slate-900 dark:text-white">@{userItem.username}</p>
                          <p className="text-xxs text-slate-400 truncate max-w-[120px]">{userItem.email}</p>
                        </div>
                      </div>

                      {/* Friend request buttons */}
                      {userItem.friendship_status === null && (
                        <button
                          onClick={() => handleSendRequest(userItem.username)}
                          className="px-2.5 py-1 bg-brand-500 text-white rounded-md text-xxs font-bold hover:bg-brand-400"
                        >
                          Add
                        </button>
                      )}
                      {userItem.friendship_status === "sent_pending" && (
                        <span className="text-xxs text-slate-450 dark:text-slate-500 font-semibold italic bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">Sent</span>
                      )}
                      {userItem.friendship_status === "received_pending" && (
                        <span className="text-xxs text-yellow-500 font-semibold italic bg-yellow-500/10 px-2 py-1 rounded">Received</span>
                      )}
                      {userItem.friendship_status === "accepted" && (
                        <span className="text-xxs text-brand-500 font-semibold bg-brand-500/10 px-2 py-1 rounded flex items-center gap-1"><Check className="w-3 h-3" /> Friend</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Drawer Modal */}
      {isNotificationsOpen && (
        <div className="fixed inset-0 z-50 flex justify-start bg-slate-950/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-80 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-850 p-6 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-lg font-bold text-slate-800 dark:text-white font-display flex items-center gap-2">
                <Bell className="w-5 h-5 text-brand-500" />
                Workspace Alerts
              </h4>
              <button onClick={() => setIsNotificationsOpen(false)} className="p-1.5 hover:bg-slate-150 dark:hover:bg-slate-800 text-slate-400 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {notifications.length > 0 && (
              <button 
                onClick={markAllAsRead}
                className="w-full text-center py-2 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-350 rounded-xl mb-4 transition-all"
              >
                Clear All Notifications
              </button>
            )}

            <div className="flex-1 overflow-y-auto space-y-3">
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8 italic">No notifications found.</p>
              ) : (
                notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    onClick={() => markAsRead(notif.id)}
                    className={`p-3 rounded-xl border relative transition-all ${
                      notif.is_read 
                        ? "bg-slate-50 dark:bg-slate-950/20 border-slate-100 dark:border-slate-850/60 opacity-60" 
                        : "bg-brand-500/5 dark:bg-brand-500/5 border-brand-500/20 shadow-sm"
                    }`}
                  >
                    <h5 className="font-semibold text-xs text-slate-900 dark:text-slate-100">{notif.title}</h5>
                    <p className="text-xxs text-slate-450 dark:text-slate-400 mt-1">{notif.content}</p>
                    
                    {/* If friend request notification, offer action buttons */}
                    {notif.type === "friend_request" && !notif.is_read && (
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => handleFriendResponse(notif.reference_id, "accept")}
                          className="px-2 py-1 bg-brand-500 text-white rounded text-xxs font-bold hover:bg-brand-400"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleFriendResponse(notif.reference_id, "reject")}
                          className="px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xxs font-bold hover:bg-slate-300 dark:hover:bg-slate-700"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    <span className="absolute top-3 right-3 text-xxs text-slate-400 dark:text-slate-500">
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl relative mx-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-slate-800 dark:text-white font-display flex items-center gap-2">
                <Settings className="w-5 h-5 text-brand-500" />
                Profile Settings
              </h4>
              <button onClick={() => setIsProfileOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="flex flex-col items-center py-2">
                <img
                  src={newPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`}
                  alt="Avatar Preview"
                  className="w-16 h-16 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xxs font-bold text-slate-400 uppercase tracking-wider mb-1">Username</label>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl px-4 py-2 text-sm focus:outline-none"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xxs font-bold text-slate-400 uppercase tracking-wider mb-1">Photo URL</label>
                <input
                  type="text"
                  className="w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl px-4 py-2 text-sm focus:outline-none"
                  value={newPhoto}
                  onChange={(e) => setNewPhoto(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xxs font-bold text-slate-400 uppercase tracking-wider mb-1">Status Message</label>
                <input
                  type="text"
                  className="w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl px-4 py-2 text-sm focus:outline-none"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-semibold text-sm shadow-md transition-all mt-2"
              >
                Save Profile
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {isGroupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl relative mx-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-slate-800 dark:text-white font-display">Create Group</h4>
              <button onClick={() => { setIsGroupOpen(false); setSelectedGroupMembers([]); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xxs font-bold text-slate-400 uppercase tracking-wider mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="Design Unit"
                  className="w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xxs font-bold text-slate-400 uppercase tracking-wider mb-1">Group Description</label>
                <textarea
                  placeholder="Group for assets sync"
                  className="w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none h-16 resize-none"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xxs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Friends to Add</label>
                <div className="max-h-32 overflow-y-auto space-y-2 border border-slate-150 dark:border-slate-800 p-2.5 rounded-xl">
                  {friends.length === 0 ? (
                    <p className="text-xxs text-slate-400 dark:text-slate-500 italic text-center py-4">Add friends before building groups.</p>
                  ) : (
                    friends.map((friend) => {
                      const isSelected = selectedGroupMembers.includes(friend.id);
                      return (
                        <div 
                          key={friend.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedGroupMembers(prev => prev.filter(id => id !== friend.id));
                            } else {
                              setSelectedGroupMembers(prev => [...prev, friend.id]);
                            }
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected ? "bg-brand-500/10 text-brand-600 dark:text-brand-400" : "hover:bg-slate-50 dark:hover:bg-slate-950/40"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <img src={friend.profile_photo} alt="" className="w-6 h-6 rounded-full" />
                            <span className="text-xs font-semibold">@{friend.username}</span>
                          </div>
                          <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                            isSelected ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 dark:border-slate-700"
                          }`}>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={friends.length === 0 || !groupName.trim() || selectedGroupMembers.length === 0}
                className="w-full py-2.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl font-semibold text-sm shadow-md transition-all mt-2"
              >
                Create Group Chat
              </button>
            </form>
          </div>
        </div>
      )}

      {/* AI Summary Modal */}
      {isSummaryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl relative mx-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-slate-800 dark:text-white font-display flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                Gemini Conversation Summary
              </h4>
              <button onClick={() => setIsSummaryOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 p-4 rounded-xl text-sm leading-relaxed max-h-80 overflow-y-auto">
              {loadingSummary ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <span className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></span>
                  <span className="text-xs text-slate-400 font-semibold animate-pulse">Consulting Gemini models...</span>
                </div>
              ) : (
                <div className="prose prose-slate dark:prose-invert text-slate-700 dark:text-slate-350 text-xs whitespace-pre-wrap">
                  {chatSummary}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setIsSummaryOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
