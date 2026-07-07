import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useChatStore } from "../store/chatStore";
import { useNotificationStore } from "../store/notificationStore";
import { useSocket } from "../context/SocketContext";
import axios from "axios";
import {
  Pin, Sparkles, ArrowLeft, Phone, Video, Folder,
  MessageSquare
} from "lucide-react";

import { API_BASE } from "../config/api";

// Components
import Sidebar from "../components/Sidebar";
import MessageBubble from "../components/MessageBubble";
import MessageInput from "../components/MessageInput";
import EmptyState from "../components/EmptyState";
import TypingIndicator from "../components/TypingIndicator";
import MoodRing from "../components/MoodRing";

// Modals
import {
  SearchModal,
  NotificationsModal,
  ProfileModal,
  GroupModal,
  PollModal,
  CodeExplainModal,
  SummaryModal,
  MediaGalleryDrawer,
  CallOverlay,
  DeleteMessageModal,
} from "../components/Modals";

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

  // ═══════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════

  const [darkMode, setDarkMode] = useState(true);

  // Modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetMsg, setDeleteTargetMsg] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isMediaGalleryOpen, setIsMediaGalleryOpen] = useState(false);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);

  // Sidebar
  const [sidebarFilter, setSidebarFilter] = useState("");

  // Poll
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // Code explain
  const [codeExplainModal, setCodeExplainModal] = useState({ isOpen: false, code: "", explanation: "", loading: false });

  // Reactions
  const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Group
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);

  // Profile
  const [newUsername, setNewUsername] = useState(user?.username || "");
  const [newStatus, setNewStatus] = useState(user?.status || "online");
  const [newPhoto, setNewPhoto] = useState(user?.profile_photo || "");

  // AI
  const [smartReplies, setSmartReplies] = useState([]);
  const [translatedMessages, setTranslatedMessages] = useState({});
  const [translatingMessageId, setTranslatingMessageId] = useState(null);
  const [transcriptions, setTranscriptions] = useState({});
  const [chatSummary, setChatSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Audio
  const [audioSpeed, setAudioSpeed] = useState({});

  // Call
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Message input
  const [inputText, setInputText] = useState("");
  const [typingTimeoutRef, setTypingTimeoutRef] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Voice
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Refs
  const fileInputRef = useRef(null);
  const profileFileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // ═══════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // ═══════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════

  useEffect(() => {
    fetchChats();
    fetchFriends();
    fetchPendingRequests();
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (darkMode) document.body.classList.add("dark");
    else document.body.classList.remove("dark");
  }, [darkMode]);

  useEffect(() => {
    if (isProfileOpen && user) {
      setNewUsername(user.username || "");
      setNewPhoto(user.profile_photo || "");
      setNewStatus(user.status || "online");
    }
  }, [isProfileOpen, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (activeChatId && messages.length > 0) {
      fetchSmartReplies(activeChatId);
    } else {
      setSmartReplies([]);
    }
  }, [messages, activeChatId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        // Close any open modal
        if (isSearchOpen) setIsSearchOpen(false);
        else if (isNotificationsOpen) setIsNotificationsOpen(false);
        else if (isProfileOpen) setIsProfileOpen(false);
        else if (isGroupOpen) setIsGroupOpen(false);
        else if (isSummaryOpen) setIsSummaryOpen(false);
        else if (isMediaGalleryOpen) setIsMediaGalleryOpen(false);
        else if (isPollModalOpen) setIsPollModalOpen(false);
        else if (codeExplainModal.isOpen) setCodeExplainModal(prev => ({ ...prev, isOpen: false }));
        else if (isDeleteModalOpen) setIsDeleteModalOpen(false);
      }
      // Ctrl+K for search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen, isNotificationsOpen, isProfileOpen, isGroupOpen, isSummaryOpen, isMediaGalleryOpen, isPollModalOpen, codeExplainModal.isOpen, isDeleteModalOpen]);

  // ═══════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (activeChatId) {
      sendTypingStart(activeChatId);
      if (typingTimeoutRef) clearTimeout(typingTimeoutRef);
      const timeout = setTimeout(() => { sendTypingStop(activeChatId); }, 2000);
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
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
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
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(blobUrl); }, 1500);
    } catch (err) {
      console.error("Download failed:", err);
      window.open(fileUrl, "_blank");
    }
  };

  const handleProfilePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Image must be under 2MB."); return; }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => setNewPhoto(reader.result);
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
      console.error("Failed to send:", err);
    }
  };

  const fetchSmartReplies = async (chatId) => {
    try {
      const res = await axios.get(`${API_BASE}/ai/suggestions?chat_id=${chatId}`, { headers: getHeaders() });
      setSmartReplies(res.data.suggestions);
    } catch (err) { console.error("Smart replies error:", err); }
  };

  const handleTranslateMessage = async (msgId, text, targetLang) => {
    setTranslatingMessageId(msgId);
    try {
      const res = await axios.post(`${API_BASE}/ai/translate`, { text, target_language: targetLang }, { headers: getHeaders() });
      setTranslatedMessages(prev => ({ ...prev, [msgId]: res.data.translated_text }));
    } catch (err) { console.error("Translation failed:", err); }
    finally { setTranslatingMessageId(null); }
  };

  const handleTranscribeVoice = async (msgId) => {
    try {
      const res = await axios.post(`${API_BASE}/ai/transcribe?message_id=${msgId}`, {}, { headers: getHeaders() });
      setTranscriptions(prev => ({ ...prev, [msgId]: res.data.transcription }));
    } catch (err) { console.error("Transcription failed:", err); }
  };

  const handleExplainCode = async (codeSnippet) => {
    setCodeExplainModal({ isOpen: true, code: codeSnippet, explanation: "", loading: true });
    try {
      const res = await axios.post(`${API_BASE}/ai/code-explain`, { code: codeSnippet }, { headers: getHeaders() });
      setCodeExplainModal({ isOpen: true, code: codeSnippet, explanation: res.data.explanation, loading: false });
    } catch (err) {
      console.error("Code explain failed:", err);
      setCodeExplainModal({ isOpen: true, code: codeSnippet, explanation: "Failed to analyze code.", loading: false });
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
      setChatSummary("Could not generate summary.");
    } finally { setLoadingSummary(false); }
  };

  const executeSearch = async (queryText) => {
    const text = queryText || searchQuery;
    if (!text?.trim()) return;
    try {
      const res = await axios.get(`${API_BASE}/users/search?q=${encodeURIComponent(text.trim())}&page=1`, { headers: getHeaders() });
      setSearchResults(res.data);
      setHasSearched(true);
    } catch (err) { console.error("Search failed:", err); }
  };

  const handleSearchUsersSubmit = async (e) => {
    if (e) e.preventDefault();
    executeSearch(searchQuery);
  };

  const handleSendRequest = async (username) => {
    try {
      await axios.post(`${API_BASE}/friends/request`, { receiver_username_or_email: username }, { headers: getHeaders() });
      executeSearch(searchQuery);
    } catch (err) { console.error("Send request error:", err); }
  };

  const handleFriendResponse = async (requestId, action) => {
    try {
      await axios.post(`${API_BASE}/friends/respond`, { request_id: requestId, action }, { headers: getHeaders() });
      fetchPendingRequests();
      fetchFriends();
      fetchChats();
      fetchNotifications();
      if (searchQuery) executeSearch(searchQuery);
    } catch (err) { console.error("Friend response error:", err); }
  };

  const initiateDeleteMessage = (msg) => { setDeleteTargetMsg(msg); setIsDeleteModalOpen(true); };

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
    } catch (err) { console.error("Delete for everyone error:", err); }
    finally { setIsDeleteModalOpen(false); setDeleteTargetMsg(null); }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_BASE}/users/profile`, { username: newUsername, profile_photo: newPhoto, status: newStatus }, { headers: getHeaders() });
      setIsProfileOpen(false);
      window.location.reload();
    } catch (err) { console.error("Profile update error:", err); }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedGroupMembers.length === 0) return;
    try {
      const res = await axios.post(`${API_BASE}/chats/group`, { name: groupName, description: groupDesc, member_ids: selectedGroupMembers }, { headers: getHeaders() });
      setIsGroupOpen(false);
      setGroupName("");
      setGroupDesc("");
      setSelectedGroupMembers([]);
      fetchChats();
      setActiveChatId(res.data.id);
    } catch (err) { console.error("Group creation failed:", err); }
  };

  const handleCreatePollSubmit = async (e) => {
    e.preventDefault();
    const cleanOptions = pollOptions.map(o => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || cleanOptions.length < 2) { alert("Provide a question and at least 2 options."); return; }
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
        const payload = {
          chat_id: activeChatId,
          content: null,
          message_type: file.type.startsWith("image/") ? "image" : "file",
          file_url: reader.result,
          file_name: file.name,
          file_size: file.size
        };
        await axios.post(`${API_BASE}/messages`, payload, { headers: getHeaders() });
        setUploadingFile(false);
      };
    } catch (err) { console.error("Upload failed:", err); setUploadingFile(false); }
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
          const payload = {
            chat_id: activeChatId, content: null, message_type: "voice",
            file_url: reader.result, file_name: "voice_note.ogg", file_size: blob.size
          };
          await axios.post(`${API_BASE}/messages`, payload, { headers: getHeaders() });
          setAudioBlob(null);
        };
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    } catch (err) { console.error("Recording failed:", err); alert("Could not access microphone."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const startCall = (callType = "video") => {
    if (!activeChat) return;
    const targetMember = activeChat.members.find(m => m.user.id !== user?.id);
    sendWebRTCSignal({
      target_user_id: targetMember?.user.id || null,
      chat_id: activeChatId,
      signal_type: "call_request",
      call_type: callType
    });
    setActiveCall({
      isIncoming: false, callerName: activeChat.name,
      callerId: user?.id, chatId: activeChatId, callType
    });
  };

  const endCall = () => {
    if (activeChatId) sendWebRTCSignal({ chat_id: activeChatId, signal_type: "end_call" });
    setActiveCall(null);
  };

  const toggleAudioSpeed = (msgId) => {
    setAudioSpeed(prev => {
      const current = prev[msgId] || 1;
      const next = current === 1 ? 1.5 : (current === 1.5 ? 2 : 1);
      return { ...prev, [msgId]: next };
    });
  };

  // ═══════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════

  const filteredChats = chats.filter((c) => {
    if (!sidebarFilter.trim()) return true;
    const term = sidebarFilter.trim().toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.last_message_content && c.last_message_content.toLowerCase().includes(term))
    );
  });

  // Message grouping: determine first/last in consecutive same-sender groups
  const getGroupInfo = (index) => {
    const msg = messages[index];
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;

    const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id;
    const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id;

    return { isFirstInGroup, isLastInGroup };
  };

  // Typing names for active chat
  const typingNames = activeChatId && typingMembers[activeChatId]
    ? Object.values(typingMembers[activeChatId])
    : [];

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans antialiased">

      {/* ─── SIDEBAR ─── */}
      <Sidebar
        user={user}
        chats={chats}
        filteredChats={filteredChats}
        activeChatId={activeChatId}
        setActiveChatId={setActiveChatId}
        typingMembers={typingMembers}
        onlineUsers={onlineUsers}
        sidebarFilter={sidebarFilter}
        setSidebarFilter={setSidebarFilter}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        logout={logout}
        setIsSearchOpen={setIsSearchOpen}
        setIsGroupOpen={setIsGroupOpen}
        setIsNotificationsOpen={setIsNotificationsOpen}
        setIsProfileOpen={setIsProfileOpen}
        unreadCount={unreadCount}
      />

      {/* ─── MAIN CHAT AREA ─── */}
      <div className={`flex-1 h-full flex flex-col chat-mesh-bg chat-pattern-overlay ${activeChatId ? "flex" : "hidden md:flex"}`}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 glass-panel px-4 md:px-6 flex items-center justify-between shrink-0 z-10">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <button
                  onClick={() => setActiveChatId(null)}
                  className="icon-btn md:hidden mr-0.5 shrink-0"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <img
                  src={activeChat.icon_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${activeChat.name}`}
                  alt=""
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full shrink-0 border-2 border-brand-500/20"
                />
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white leading-tight">{activeChat.name}</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-md">
                    {activeChat.is_group ? activeChat.description : (
                      (onlineUsers[activeChat.members.find(m => m.user.id !== user?.id)?.user.id] === "online")
                        ? <span className="text-brand-500 font-medium">● Online</span>
                        : "Offline"
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button onClick={() => startCall("voice")} className="icon-btn" title="Voice Call">
                  <Phone className="w-4 h-4" />
                </button>
                <button onClick={() => startCall("video")} className="icon-btn" title="Video Call">
                  <Video className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { fetchMediaGallery(activeChatId); setIsMediaGalleryOpen(true); }}
                  className="icon-btn"
                  title="Shared Media"
                >
                  <Folder className="w-4 h-4" />
                </button>
                <button
                  onClick={handleGetChatSummary}
                  className="px-3 py-1.5 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 rounded-xl hover:bg-indigo-500/20 transition-all text-xs font-semibold flex items-center gap-1.5"
                  title="AI Summary"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">AI Summary</span>
                </button>
              </div>
            </div>

            {/* Mood Ring */}
            <MoodRing messages={messages} />

            {/* Pinned Messages Banner */}
            {pinnedMessages.length > 0 && (
              <div className="bg-amber-500/5 border-b border-amber-500/10 px-4 py-1.5 flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 anim-slide-down">
                <div className="flex items-center gap-2 truncate">
                  <Pin className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-semibold">Pinned:</span>
                  <span className="truncate">{pinnedMessages[0].content}</span>
                </div>
                <span className="text-[10px] font-semibold opacity-60">{pinnedMessages.length} pinned</span>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-1">
              {messages.length === 0 ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 anim-fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-3">
                    <MessageSquare className="w-7 h-7 text-brand-500 opacity-40 animate-pulse" />
                  </div>
                  <p className="font-semibold text-sm">No messages yet</p>
                  <p className="text-xs mt-1 opacity-60">Send a message to start the conversation.</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.sender_id === user?.id;
                  const isAI = msg.sender_id === "00000000-0000-0000-0000-000000000000";
                  const { isFirstInGroup, isLastInGroup } = getGroupInfo(index);

                  return (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isMe={isMe}
                      isAI={isAI}
                      user={user}
                      isFirstInGroup={isFirstInGroup}
                      isLastInGroup={isLastInGroup}
                      activeReactionMsgId={activeReactionMsgId}
                      setActiveReactionMsgId={setActiveReactionMsgId}
                      setReplyingTo={setReplyingTo}
                      togglePinMessage={togglePinMessage}
                      toggleReaction={toggleReaction}
                      handleExplainCode={handleExplainCode}
                      initiateDeleteMessage={initiateDeleteMessage}
                      handleTranslateMessage={handleTranslateMessage}
                      translatedMessages={translatedMessages}
                      translatingMessageId={translatingMessageId}
                      transcriptions={transcriptions}
                      handleTranscribeVoice={handleTranscribeVoice}
                      handleDownloadFile={handleDownloadFile}
                      audioSpeed={audioSpeed}
                      toggleAudioSpeed={toggleAudioSpeed}
                      polls={polls}
                      votePoll={votePoll}
                      activeChatId={activeChatId}
                    />
                  );
                })
              )}

              {/* Typing indicator */}
              {typingNames.length > 0 && (
                <TypingIndicator names={typingNames} />
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <MessageInput
              activeChatId={activeChatId}
              inputText={inputText}
              handleInputChange={handleInputChange}
              handleSendMessage={handleSendMessage}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              smartReplies={smartReplies}
              fileInputRef={fileInputRef}
              handleFileSelect={handleFileSelect}
              uploadingFile={uploadingFile}
              isRecording={isRecording}
              startRecording={startRecording}
              stopRecording={stopRecording}
              recordingDuration={recordingDuration}
              setIsPollModalOpen={setIsPollModalOpen}
              darkMode={darkMode}
            />
          </>
        ) : (
          <EmptyState onSearchOpen={() => setIsSearchOpen(true)} />
        )}
      </div>

      {/* ─── MODALS ─── */}

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        searchQuery={searchQuery}
        setSearchQuery={(val) => {
          setSearchQuery(val);
          if (!val.trim()) { setSearchResults([]); setHasSearched(false); }
        }}
        searchResults={searchResults}
        hasSearched={hasSearched}
        executeSearch={executeSearch}
        handleSendRequest={handleSendRequest}
        handleFriendResponse={handleFriendResponse}
        onSubmit={handleSearchUsersSubmit}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        pendingRequests={pendingRequests}
        notifications={notifications}
        handleFriendResponse={handleFriendResponse}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        newUsername={newUsername}
        setNewUsername={setNewUsername}
        newPhoto={newPhoto}
        profileFileInputRef={profileFileInputRef}
        handleProfilePhotoUpload={handleProfilePhotoUpload}
        handleUpdateProfile={handleUpdateProfile}
      />

      <GroupModal
        isOpen={isGroupOpen}
        onClose={() => setIsGroupOpen(false)}
        friends={friends}
        groupName={groupName}
        setGroupName={setGroupName}
        groupDesc={groupDesc}
        setGroupDesc={setGroupDesc}
        selectedGroupMembers={selectedGroupMembers}
        setSelectedGroupMembers={setSelectedGroupMembers}
        handleCreateGroup={handleCreateGroup}
      />

      <PollModal
        isOpen={isPollModalOpen}
        onClose={() => setIsPollModalOpen(false)}
        pollQuestion={pollQuestion}
        setPollQuestion={setPollQuestion}
        pollOptions={pollOptions}
        setPollOptions={setPollOptions}
        handleCreatePollSubmit={handleCreatePollSubmit}
      />

      <CodeExplainModal
        state={codeExplainModal}
        onClose={() => setCodeExplainModal(prev => ({ ...prev, isOpen: false }))}
      />

      <SummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        loading={loadingSummary}
        summary={chatSummary}
      />

      <MediaGalleryDrawer
        isOpen={isMediaGalleryOpen}
        onClose={() => setIsMediaGalleryOpen(false)}
        mediaGallery={mediaGallery}
        handleDownloadFile={handleDownloadFile}
      />

      <CallOverlay
        activeCall={activeCall}
        endCall={endCall}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        isVideoOff={isVideoOff}
        setIsVideoOff={setIsVideoOff}
      />

      <DeleteMessageModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDeleteForEveryone={handleDeleteForEveryone}
        onDeleteForMe={handleDeleteForMe}
      />
    </div>
  );
}
