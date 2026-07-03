import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useChatStore } from "../store/chatStore";
import { useNotificationStore } from "../store/notificationStore";
import { useSocket } from "../context/SocketContext";
import axios from "axios";
import { 
  MessageSquare, Users, UserPlus, Bell, LogOut, Send, Paperclip, 
  Mic, Square, Play, Trash2, Moon, Sun, Search, X, Check, CheckCheck,
  Settings, Sparkles, Languages, FileText, CheckCircle, Info, ChevronRight, Camera,
  ArrowLeft, Pin, Smile, Reply, Vote, Phone, Video, PhoneOff, MicOff, VideoOff,
  Folder, Code, MoreVertical
} from "lucide-react";

import { API_BASE } from "../config/api";

const EMOJI_LIST = ["👍", "❤️", "😂", "🔥", "🎉", "😮", "🚀"];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { 
    chats, activeChatId, activeChat, messages, friends, pendingRequests, 
    typingMembers, onlineUsers, fetchChats, setActiveChatId, fetchFriends, 
    fetchPendingRequests, setOnlineStatus, deleteMessageForMe,
    replyingTo, setReplyingTo, toggleReaction, togglePinMessage,
    pinnedMessages, fetchPinnedMessages, mediaGallery, fetchMediaGallery,
    polls, fetchPolls, createPoll, votePoll, activeCall, setActiveCall
  } = useChatStore();

  const { notifications, unreadCount, fetchNotifications, markAllAsRead, markAsRead } = useNotificationStore();
  const { sendTypingStart, sendTypingStop, sendMarkSeen, sendWebRTCSignal } = useSocket();

  // Theme State
  const [darkMode, setDarkMode] = useState(true);

  // Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetMsg, setDeleteTargetMsg] = useState(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isMediaGalleryOpen, setIsMediaGalleryOpen] = useState(false);

  // Poll Modal State
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // Code Assistant Modal State
  const [codeExplainModal, setCodeExplainModal] = useState({ isOpen: false, code: "", explanation: "", loading: false });

  // Reaction Picker Popover Message ID
  const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);

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

  // AI & Translation State
  const [smartReplies, setSmartReplies] = useState([]);
  const [translatedMessages, setTranslatedMessages] = useState({});
  const [translatingMessageId, setTranslatingMessageId] = useState(null);
  const [transcriptions, setTranscriptions] = useState({});
  const [chatSummary, setChatSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Audio Playback Speed (msgId -> speed multiplier)
  const [audioSpeed, setAudioSpeed] = useState({});

  // WebRTC Call Controls State
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Message Input State
  const [inputText, setInputText] = useState("");
  const [typingTimeoutRef, setTypingTimeoutRef] = useState(null);
  
  // File upload state
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef(null);
  const profileFileInputRef = useRef(null);

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

  useEffect(() => {
    if (isProfileOpen && user) {
      setNewUsername(user.username || "");
      setNewPhoto(user.profile_photo || "");
      setNewStatus(user.status || "online");
    }
  }, [isProfileOpen, user]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (activeChatId && messages.length > 0) {
      fetchSmartReplies(activeChatId);
    } else {
      setSmartReplies([]);
    }
  }, [messages, activeChatId]);

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    
    if (activeChatId) {
      sendTypingStart(activeChatId);
      if (typingTimeoutRef) clearTimeout(typingTimeoutRef);
      
      const timeout = setTimeout(() => {
        sendTypingStop(activeChatId);
      }, 2000);
      setTypingTimeoutRef(timeout);
    }
  };

  const handleDownloadFile = async (fileUrl, fileName) => {
    if (!fileUrl) return;
    try {
      let blob;
      if (fileUrl.startsWith("data:")) {
        const parts = fileUrl.split(",");
        const mimeString = parts[0].split(":")[1].split(";")[0];
        const byteString = atob(parts[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        blob = new Blob([ab], { type: mimeString });
      } else {
        const response = await fetch(fileUrl);
        blob = await response.blob();
      }

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 1500);
    } catch (err) {
      console.error("Secure download failed, falling back to simple link open:", err);
      window.open(fileUrl, "_blank");
    }
  };

  const handleProfilePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Image size must be less than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      setNewPhoto(reader.result);
    };
  };

  const handleSendMessage = async (textToSend = null) => {
    const content = textToSend || inputText;
    if (!content.trim() && !audioBlob) return;
    
    try {
      sendTypingStop(activeChatId);
      
      const payload = {
        chat_id: activeChatId,
        content: content.trim(),
        message_type: "text",
        reply_to_id: replyingTo ? replyingTo.id : null
      };

      await axios.post(`${API_BASE}/messages`, payload, { headers: getHeaders() });
      if (!textToSend) setInputText("");
      setReplyingTo(null);
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const fetchSmartReplies = async (chatId) => {
    try {
      const res = await axios.get(`${API_BASE}/ai/suggestions?chat_id=${chatId}`, { headers: getHeaders() });
      setSmartReplies(res.data.suggestions);
    } catch (err) {
      console.error("Error loading smart replies:", err);
    }
  };

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

  const handleTranscribeVoice = async (msgId) => {
    try {
      const res = await axios.post(`${API_BASE}/ai/transcribe?message_id=${msgId}`, {}, { headers: getHeaders() });
      setTranscriptions(prev => ({
        ...prev,
        [msgId]: res.data.transcription
      }));
    } catch (err) {
      console.error("Voice transcription failed:", err);
    }
  };

  const handleExplainCode = async (codeSnippet) => {
    setCodeExplainModal({ isOpen: true, code: codeSnippet, explanation: "", loading: true });
    try {
      const res = await axios.post(`${API_BASE}/ai/code-explain`, { code: codeSnippet }, { headers: getHeaders() });
      setCodeExplainModal({ isOpen: true, code: codeSnippet, explanation: res.data.explanation, loading: false });
    } catch (err) {
      console.error("Code explain failed:", err);
      setCodeExplainModal({ isOpen: true, code: codeSnippet, explanation: "Failed to analyze code snippet.", loading: false });
    }
  };

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

  const handleSendRequest = async (username) => {
    try {
      await axios.post(`${API_BASE}/friends/request`, { receiver_username_or_email: username }, { headers: getHeaders() });
      const res = await axios.get(`${API_BASE}/users/search?q=${searchQuery}&page=${searchPage}`, { headers: getHeaders() });
      setSearchResults(res.data);
    } catch (err) {
      console.error("Error sending request:", err);
    }
  };

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

  const initiateDeleteMessage = (msg) => {
    setDeleteTargetMsg(msg);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteForMe = () => {
    if (!deleteTargetMsg) return;
    deleteMessageForMe(deleteTargetMsg.id, deleteTargetMsg.chat_id);
    setIsDeleteModalOpen(false);
    setDeleteTargetMsg(null);
  };

  const handleDeleteForEveryone = async () => {
    if (!deleteTargetMsg) return;
    try {
      await axios.delete(`${API_BASE}/messages/${deleteTargetMsg.id}`, { headers: getHeaders() });
      useChatStore.getState().markMessageDeleted(deleteTargetMsg.id, deleteTargetMsg.chat_id);
    } catch (err) {
      console.error("Delete for everyone error:", err);
    } finally {
      setIsDeleteModalOpen(false);
      setDeleteTargetMsg(null);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_BASE}/users/profile`, {
        username: newUsername,
        profile_photo: newPhoto,
        status: newStatus
      }, { headers: getHeaders() });
      setIsProfileOpen(false);
      window.location.reload();
    } catch (err) {
      console.error("Profile update error:", err);
    }
  };

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

  const handleCreatePollSubmit = async (e) => {
    e.preventDefault();
    const cleanOptions = pollOptions.map(o => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || cleanOptions.length < 2) {
      alert("Please provide a question and at least 2 valid options.");
      return;
    }
    await createPoll(activeChatId, pollQuestion.trim(), cleanOptions);
    setIsPollModalOpen(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const fileUrl = reader.result;
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
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // WebRTC Call Triggers
  const startCall = (callType = "video") => {
    if (!activeChat) return;
    const targetMember = activeChat.members.find(m => m.user.id !== user?.id);
    sendWebRTCSignal({
      target_user_id: targetMember ? targetMember.user.id : null,
      chat_id: activeChatId,
      signal_type: "call_request",
      call_type: callType
    });
    setActiveCall({
      isIncoming: false,
      callerName: activeChat.name,
      callerId: user?.id,
      chatId: activeChatId,
      callType: callType
    });
  };

  const endCall = () => {
    if (activeChatId) {
      sendWebRTCSignal({
        chat_id: activeChatId,
        signal_type: "end_call"
      });
    }
    setActiveCall(null);
  };

  const toggleAudioSpeed = (msgId) => {
    setAudioSpeed(prev => {
      const current = prev[msgId] || 1;
      const next = current === 1 ? 1.5 : (current === 1.5 ? 2 : 1);
      return { ...prev, [msgId]: next };
    });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-900 font-sans text-slate-100 antialiased">
      
      {/* 1. LEFT SIDEBAR PANEL */}
      <div className={`w-full md:w-80 lg:w-96 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 ${activeChatId ? "hidden md:flex" : "flex"}`}>
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-md shadow-brand-500/20 font-display">
              CS
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white text-base tracking-tight font-display">ChatSphere AI</h1>
              <p className="text-xxs text-slate-400 font-medium">Real-Time Workspace</p>
            </div>
          </div>
          
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
              title="Search Users"
            >
              <Search className="w-4 h-4" />
            </button>
            
            <button 
              onClick={() => setIsGroupOpen(true)}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
              title="Create Group Chat"
            >
              <Users className="w-4 h-4" />
            </button>

            <button 
              onClick={() => setIsNotificationsOpen(true)}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 relative transition-colors"
              title="Alerts"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900 animate-pulse"></span>
              )}
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
                        (onlineUsers[chat.members.find(m => m.user.id !== user?.id)?.user.id] === "online")
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

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <img 
              src={user?.profile_photo || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`} 
              alt="Avatar"
              className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 cursor-pointer hover:scale-105 transition-all shrink-0"
              onClick={() => setIsProfileOpen(true)}
            />
            <div className="min-w-0">
              <h4 className="font-semibold text-xs text-slate-800 dark:text-white truncate font-display">@{user?.username}</h4>
              <span className="text-[10px] text-brand-500 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                Active
              </span>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
            <button 
              onClick={logout}
              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-950/30 rounded-lg text-red-500 transition-colors"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN CHAT AREA */}
      <div className={`flex-1 h-full flex flex-col bg-slate-100 dark:bg-slate-950 ${activeChatId ? "flex" : "hidden md:flex"}`}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <button
                  onClick={() => setActiveChatId(null)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 md:hidden transition-colors mr-0.5 shrink-0"
                  title="Back to Chats"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <img
                  src={activeChat.icon_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${activeChat.name}`}
                  alt="Chat Icon"
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full shrink-0"
                />
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white leading-tight font-display">{activeChat.name}</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-md">
                    {activeChat.is_group ? activeChat.description : (
                      (onlineUsers[activeChat.members.find(m => m.user.id !== user?.id)?.user.id] === "online")
                        ? "Online" 
                        : "Offline"
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Voice Call */}
                <button
                  onClick={() => startCall("voice")}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                  title="Start Voice Call"
                >
                  <Phone className="w-4 h-4" />
                </button>
                {/* Video Call */}
                <button
                  onClick={() => startCall("video")}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                  title="Start Video Call"
                >
                  <Video className="w-4 h-4" />
                </button>
                {/* Media Gallery */}
                <button
                  onClick={() => {
                    fetchMediaGallery(activeChatId);
                    setIsMediaGalleryOpen(true);
                  }}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                  title="Shared Media & Files"
                >
                  <Folder className="w-4 h-4" />
                </button>
                {/* AI Chat Summary button */}
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

            {/* Pinned Messages Banner */}
            {pinnedMessages.length > 0 && (
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-between text-xs text-amber-700 dark:text-amber-400">
                <div className="flex items-center gap-2 truncate">
                  <Pin className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-semibold">Pinned:</span>
                  <span className="truncate">{pinnedMessages[0].content}</span>
                </div>
                <span className="text-xxs font-semibold opacity-75">{pinnedMessages.length} pinned</span>
              </div>
            )}

            {/* Messages List Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
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
                      <span className="text-xxs font-semibold text-slate-400 dark:text-slate-500 mb-1 px-1 tracking-wider uppercase">
                        {isAI ? "🤖 AI Assistant" : (isMe ? "You" : `@${msg.sender_username || "User"}`)}
                      </span>

                      <div className="flex items-center gap-2 max-w-lg relative">
                        
                        {/* Hover Action Toolbar */}
                        {msg.message_type !== "deleted" && (
                          <div className={`absolute top-0 -translate-y-full flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-20 ${isMe ? "right-0" : "left-0"}`}>
                            {/* Reaction button */}
                            <button
                              onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-300"
                              title="React"
                            >
                              <Smile className="w-3.5 h-3.5" />
                            </button>
                            {/* Reply button */}
                            <button
                              onClick={() => setReplyingTo(msg)}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-300"
                              title="Reply"
                            >
                              <Reply className="w-3.5 h-3.5" />
                            </button>
                            {/* Pin button */}
                            <button
                              onClick={() => togglePinMessage(msg.id)}
                              className={`p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded ${msg.is_pinned ? "text-amber-500" : "text-slate-500 dark:text-slate-300"}`}
                              title={msg.is_pinned ? "Unpin" : "Pin"}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                            {/* Code Explain if code in content */}
                            {msg.content && (msg.content.includes("def ") || msg.content.includes("function") || msg.content.includes("import ") || msg.content.includes("const ")) && (
                              <button
                                onClick={() => handleExplainCode(msg.content)}
                                className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-500 rounded"
                                title="Explain Code with AI"
                              >
                                <Code className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {/* Delete button */}
                            {isMe && (
                              <button
                                onClick={() => initiateDeleteMessage(msg)}
                                className="p-1 hover:bg-red-100 dark:hover:bg-red-950 text-red-500 rounded"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Reaction Emoji Popover */}
                        {activeReactionMsgId === msg.id && (
                          <div className={`absolute -top-10 flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-1 shadow-lg z-30 ${isMe ? "right-0" : "left-0"}`}>
                            {EMOJI_LIST.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => {
                                  toggleReaction(msg.id, emoji);
                                  setActiveReactionMsgId(null);
                                }}
                                className="hover:scale-125 transition-transform text-base p-0.5"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className={`p-4 rounded-2xl shadow-sm text-sm border relative ${
                          msg.message_type === "deleted"
                            ? "bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-900/60"
                            : (isAI 
                                ? "bg-gradient-to-tr from-indigo-900 to-indigo-950 text-indigo-50 border-indigo-850/60" 
                                : (isMe 
                                    ? "bg-brand-500 text-white border-brand-450" 
                                    : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-800"))
                        }`}>
                          
                          {/* Render Quoted Parent Message if replying */}
                          {msg.reply_to && (
                            <div className="mb-2 p-2 rounded-lg bg-black/10 dark:bg-white/10 border-l-2 border-brand-400 text-xs">
                              <span className="font-semibold text-xxs block opacity-75">@{msg.reply_to.sender_username}</span>
                              <p className="truncate opacity-90">{msg.reply_to.content || `[${msg.reply_to.message_type}]`}</p>
                            </div>
                          )}

                          {/* Message Content */}
                          {msg.message_type === "deleted" ? (
                            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 italic py-0.5">
                              <Trash2 className="w-3.5 h-3.5 opacity-55 shrink-0" />
                              <span>This message was deleted</span>
                            </div>
                          ) : (
                            <>
                              {msg.message_type === "image" && (
                                <div className="mb-2 max-w-xs overflow-hidden rounded-lg border border-black/10">
                                  <img src={msg.file_url} alt="Shared" className="w-full h-auto object-cover max-h-60" />
                                </div>
                              )}

                              {msg.message_type === "file" && (
                                <button 
                                  onClick={() => handleDownloadFile(msg.file_url, msg.file_name)}
                                  className="w-full text-left flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl text-slate-700 dark:text-slate-200 mb-2 font-medium hover:underline hover:scale-[1.01] transition-all cursor-pointer"
                                >
                                  <FileText className="w-8 h-8 text-brand-500 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold truncate leading-normal">{msg.file_name}</p>
                                    <p className="text-xxs text-slate-400 mt-0.5">{(msg.file_size / 1024).toFixed(1)} KB</p>
                                  </div>
                                </button>
                              )}

                              {/* Voice Message Bubble */}
                              {msg.message_type === "voice" && (
                                <div className="flex flex-col gap-2 py-1 mb-2 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                                  <div className="flex items-center gap-3">
                                    <Mic className="w-5 h-5 text-brand-500 shrink-0" />
                                    <audio 
                                      src={msg.file_url} 
                                      controls 
                                      className="w-48 h-8 rounded-lg outline-none"
                                      playbackRate={audioSpeed[msg.id] || 1}
                                    />
                                    <button
                                      onClick={() => toggleAudioSpeed(msg.id)}
                                      className="px-2 py-1 bg-brand-500/20 text-brand-500 font-bold text-xxs rounded hover:bg-brand-500/30"
                                    >
                                      {audioSpeed[msg.id] || 1}x
                                    </button>
                                  </div>

                                  {/* AI Transcribe Button */}
                                  <button
                                    onClick={() => handleTranscribeVoice(msg.id)}
                                    className="text-xxs text-indigo-500 font-semibold flex items-center gap-1 hover:underline self-start"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    <span>AI Transcribe</span>
                                  </button>

                                  {transcriptions[msg.id] && (
                                    <p className="text-xs italic text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-slate-800">
                                      "{transcriptions[msg.id]}"
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Poll Message Bubble */}
                              {msg.message_type === "poll" && (
                                <div className="p-3 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800/80 w-64 md:w-80">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Vote className="w-4 h-4 text-brand-500" />
                                    <span className="font-bold text-xs text-slate-800 dark:text-slate-100">Poll</span>
                                  </div>
                                  <p className="font-semibold text-sm mb-3">{msg.content?.replace("📊 Poll: ", "")}</p>
                                  
                                  {/* Render Poll Options */}
                                  {polls.find(p => p.message_id === msg.id)?.options.map((opt) => {
                                    const poll = polls.find(p => p.message_id === msg.id);
                                    const percent = poll?.total_votes ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;

                                    return (
                                      <button
                                        key={opt.id}
                                        onClick={() => votePoll(activeChatId, poll.id, opt.id)}
                                        className={`w-full text-left p-2.5 rounded-lg border mb-2 relative overflow-hidden transition-all text-xs font-medium ${
                                          opt.voted_by_me 
                                            ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400" 
                                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                                        }`}
                                      >
                                        <div 
                                          className="absolute top-0 left-0 bottom-0 bg-brand-500/20 z-0 transition-all duration-500" 
                                          style={{ width: `${percent}%` }}
                                        />
                                        <div className="relative z-10 flex items-center justify-between">
                                          <span>{opt.option_text}</span>
                                          <span className="text-xxs font-bold opacity-80">{opt.vote_count} ({percent}%)</span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Standard Text Message Content */}
                              {msg.message_type !== "poll" && msg.content && (
                                <p className="leading-relaxed break-words whitespace-pre-wrap">
                                  {translatedMessages[msg.id] || msg.content}
                                </p>
                              )}
                            </>
                          )}

                          {translatedMessages[msg.id] && msg.message_type !== "deleted" && (
                            <div className="text-xxs mt-2 pt-1 border-t border-white/20 dark:border-slate-800 text-slate-300 dark:text-slate-400 italic">
                              Translated from original content.
                            </div>
                          )}

                          {/* Reaction Pills Badges */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2 pt-1">
                              {Object.entries(
                                msg.reactions.reduce((acc, r) => {
                                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                  return acc;
                                }, {})
                              ).map(([emoji, count]) => (
                                <span key={emoji} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xxs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 shadow-2xs">
                                  <span>{emoji}</span>
                                  <span>{count}</span>
                                </span>
                              ))}
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
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Replying Banner Header above input */}
            {replyingTo && (
              <div className="px-4 py-2 bg-brand-500/10 border-t border-brand-500/20 flex items-center justify-between text-xs text-slate-700 dark:text-slate-200">
                <div className="flex items-center gap-2 truncate">
                  <Reply className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                  <span className="font-bold text-brand-600 dark:text-brand-400">Replying to @{replyingTo.sender_username}:</span>
                  <span className="truncate opacity-80">{replyingTo.content || `[${replyingTo.message_type}]`}</span>
                </div>
                <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* AI Smart Replies Suggestion Chips */}
            {smartReplies.length > 0 && (
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
                <Sparkles className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider shrink-0">Smart Replies:</span>
                {smartReplies.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(suggestion)}
                    className="px-3 py-1 bg-white dark:bg-slate-800 hover:bg-brand-500 hover:text-white border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-700 dark:text-slate-200 font-medium transition-all shrink-0 shadow-2xs"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Message Input Box */}
            <div className="p-3 md:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
              />

              {/* Attachment Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition-colors shrink-0"
                title="Attach image or file"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* Create Poll Button */}
              <button
                onClick={() => setIsPollModalOpen(true)}
                className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition-colors shrink-0"
                title="Create In-Chat Poll"
              >
                <Vote className="w-5 h-5" />
              </button>

              {/* Voice Recording Control */}
              {isRecording ? (
                <div className="flex-1 flex items-center justify-between bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/30">
                  <div className="flex items-center gap-2 text-red-500 text-xs font-semibold animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    <span>Recording Voice Note ({recordingDuration}s)</span>
                  </div>
                  <button
                    onClick={stopRecording}
                    className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Type a message (or type @AI for assistant)..."
                    className="flex-1 bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-brand-500 text-sm font-medium"
                  />

                  <button
                    onClick={startRecording}
                    className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition-colors shrink-0"
                    title="Record voice note"
                  >
                    <Mic className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim()}
                    className="p-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl shadow-md shadow-brand-500/20 transition-all shrink-0 cursor-pointer"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          /* Empty Chat Splash */
          <div className="h-full w-full flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-500">
            <div className="w-16 h-16 rounded-3xl bg-brand-500/10 flex items-center justify-center text-brand-500 mb-4 shadow-inner">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-lg text-slate-700 dark:text-slate-200 font-display">Select a conversation to start chatting</h3>
            <p className="text-xs max-w-sm mt-1">Choose an existing friend from your left sidebar or search for users to establish new chat connections.</p>
          </div>
        )}
      </div>

      {/* 3. MODALS & DRAWERS */}

      {/* Shared Media Gallery Drawer */}
      {isMediaGalleryOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full p-6 flex flex-col shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                <Folder className="w-5 h-5 text-brand-500" />
                Shared Media & Files
              </h3>
              <button onClick={() => setIsMediaGalleryOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="space-y-3 flex-1 overflow-y-auto">
              {mediaGallery.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No shared files or media in this chat yet.</p>
              ) : (
                mediaGallery.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-6 h-6 text-brand-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate text-slate-800 dark:text-slate-200">{item.file_name || item.message_type}</p>
                        <p className="text-xxs text-slate-400">By @{item.sender_username}</p>
                      </div>
                    </div>
                    {item.file_url && (
                      <button
                        onClick={() => handleDownloadFile(item.file_url, item.file_name || "file")}
                        className="px-3 py-1 bg-brand-500 text-white rounded-lg text-xs font-semibold hover:bg-brand-600"
                      >
                        Download
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* WebRTC Video / Voice Call Overlay Modal */}
      {activeCall && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col items-center shadow-2xl relative text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white mb-4 animate-pulse shadow-xl shadow-brand-500/20">
              {activeCall.callerName?.slice(0, 2).toUpperCase() || "CS"}
            </div>
            
            <h3 className="font-bold text-xl text-white font-display mb-1">{activeCall.callerName}</h3>
            <p className="text-xs text-brand-400 font-semibold uppercase tracking-wider mb-6">
              {activeCall.isIncoming ? `Incoming ${activeCall.callType} Call...` : `Active ${activeCall.callType} Call`}
            </p>

            {/* Video Streams Container (Simulated/Real canvas WebRTC placeholder) */}
            <div className="w-full h-48 bg-slate-950 rounded-2xl border border-slate-800 mb-6 flex items-center justify-center relative overflow-hidden">
              <Video className="w-12 h-12 text-slate-700 animate-bounce" />
              <span className="absolute bottom-3 left-3 text-xxs text-slate-400 font-mono">Stream Encrypted (AES-256)</span>
            </div>

            {/* Call Action Controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-4 rounded-2xl transition-colors ${isMuted ? "bg-red-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <button
                onClick={endCall}
                className="p-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition-all transform hover:scale-105"
              >
                <PhoneOff className="w-6 h-6" />
              </button>

              <button
                onClick={() => setIsVideoOff(!isVideoOff)}
                className={`p-4 rounded-2xl transition-colors ${isVideoOff ? "bg-red-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
              >
                {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Poll Creation Modal */}
      {isPollModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Vote className="w-5 h-5 text-brand-500" />
                Create In-Chat Poll
              </h3>
              <button onClick={() => setIsPollModalOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCreatePollSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Question</label>
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="e.g. What time should we meet for sprint review?"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Options</label>
                {pollOptions.map((opt, i) => (
                  <input
                    key={i}
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const updated = [...pollOptions];
                      updated[i] = e.target.value;
                      setPollOptions(updated);
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 mb-2 outline-none focus:border-brand-500"
                  />
                ))}
                {pollOptions.length < 5 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, ""])}
                    className="text-xs text-brand-500 font-semibold hover:underline"
                  >
                    + Add Option
                  </button>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPollModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 text-white text-xs font-semibold rounded-xl hover:bg-brand-600 shadow-md"
                >
                  Create Poll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Code Explain Modal */}
      {codeExplainModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Code className="w-5 h-5 text-indigo-500" />
                AI Code Assistant Explanation
              </h3>
              <button onClick={() => setCodeExplainModal({ ...codeExplainModal, isOpen: false })} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-slate-950 text-indigo-300 font-mono text-xs rounded-xl overflow-x-auto max-h-36">
              <pre>{codeExplainModal.code}</pre>
            </div>

            {codeExplainModal.loading ? (
              <p className="text-xs text-indigo-500 font-semibold animate-pulse py-4">Analyzing code structure and edge cases using Gemini AI...</p>
            ) : (
              <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {codeExplainModal.explanation}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Summary Modal */}
      {isSummaryOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                AI Conversation Summary
              </h3>
              <button onClick={() => setIsSummaryOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {loadingSummary ? (
              <div className="py-8 text-center text-xs text-indigo-500 font-semibold animate-pulse">
                Summarizing conversation logs with Gemini AI...
              </div>
            ) : (
              <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {chatSummary}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Users Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-brand-500" />
                Find Connections
              </h3>
              <button onClick={() => setIsSearchOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSearchUsers} className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search username or email..."
                className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-brand-500"
              />
              <button type="submit" className="px-4 py-2.5 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600">
                Search
              </button>
            </form>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.length === 0 && hasSearched && (
                <p className="text-xs text-slate-400 text-center py-4">No matching users found.</p>
              )}
              {searchResults.map((u) => (
                <div key={u.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img src={u.profile_photo || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username}`} className="w-8 h-8 rounded-full" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">@{u.username}</p>
                      <p className="text-xxs text-slate-400">{u.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSendRequest(u.username)}
                    className="px-3 py-1 bg-brand-500/10 text-brand-500 text-xs font-semibold rounded-lg hover:bg-brand-500 hover:text-white transition-colors"
                  >
                    Add Friend
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {isNotificationsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-brand-500" />
                Alerts & Requests
              </h3>
              <button onClick={() => setIsNotificationsOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {pendingRequests.length > 0 && (
                <div className="mb-4">
                  <span className="text-xxs font-bold text-slate-400 uppercase">Pending Friend Requests</span>
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="p-3 mt-1 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">@{req.sender_username}</span>
                      <div className="flex gap-1">
                        <button onClick={() => handleFriendResponse(req.id, "accepted")} className="px-2.5 py-1 bg-brand-500 text-white rounded-lg text-xxs font-bold">Accept</button>
                        <button onClick={() => handleFriendResponse(req.id, "rejected")} className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xxs font-bold">Decline</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <span className="text-xxs font-bold text-slate-400 uppercase">System Alerts</span>
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No alerts right now.</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{n.title}</p>
                    <p className="text-xxs text-slate-400 mt-0.5">{n.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-brand-500" />
                Profile Settings
              </h3>
              <button onClick={() => setIsProfileOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="flex flex-col items-center gap-2">
                <img src={newPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`} className="w-20 h-20 rounded-full border-2 border-brand-500" />
                <input type="file" ref={profileFileInputRef} onChange={handleProfilePhotoUpload} className="hidden" accept="image/*" />
                <button type="button" onClick={() => profileFileInputRef.current?.click()} className="text-xs text-brand-500 font-semibold hover:underline">
                  Change Photo
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsProfileOpen(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-semibold rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-500 text-white text-xs font-semibold rounded-xl hover:bg-brand-600 shadow-md">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {isGroupOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-500" />
                Create Group Channel
              </h3>
              <button onClick={() => setIsGroupOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Engineering Team"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Select Friends</label>
                <div className="space-y-1 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-2">
                  {friends.map((f) => (
                    <label key={f.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedGroupMembers.includes(f.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedGroupMembers([...selectedGroupMembers, f.id]);
                          else setSelectedGroupMembers(selectedGroupMembers.filter(id => id !== f.id));
                        }}
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">@{f.username}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsGroupOpen(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-semibold rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-500 text-white text-xs font-semibold rounded-xl hover:bg-brand-600 shadow-md">Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Message Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-center">
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2">Delete Message</h3>
            <p className="text-xs text-slate-400 mb-6">Choose whether to remove this message for only yourself or for everyone in this chat.</p>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleDeleteForEveryone}
                className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold text-xs rounded-xl shadow-md transition-colors"
              >
                Delete for Everyone
              </button>
              <button
                onClick={handleDeleteForMe}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl hover:bg-slate-200 dark:hover:bg-slate-750 transition-colors"
              >
                Delete for Me
              </button>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-full py-2 text-xs text-slate-400 font-medium hover:underline mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
