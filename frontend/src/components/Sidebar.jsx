import React from "react";
import {
  MessageSquare, Users, Bell, Search, Sun, Moon, LogOut, X
} from "lucide-react";

export default function Sidebar({
  user,
  chats,
  filteredChats,
  activeChatId,
  setActiveChatId,
  typingMembers,
  onlineUsers,
  sidebarFilter,
  setSidebarFilter,
  darkMode,
  setDarkMode,
  logout,
  setIsSearchOpen,
  setIsGroupOpen,
  setIsNotificationsOpen,
  setIsProfileOpen,
  unreadCount,
}) {
  return (
    <div className={`w-full md:w-[380px] lg:w-[420px] xl:w-[460px] flex-col glass-panel shrink-0 ${
      activeChatId ? "hidden md:flex" : "flex"
    }`}>
      
      {/* ── Header ── */}
      <div className="p-4 border-b border-slate-200/50 dark:border-slate-800/50 sidebar-header-gradient">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Animated logo */}
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-brand-500/20 font-display">
                CS
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-brand-400 border-2 border-white dark:border-slate-900 animate-pulse"></div>
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white text-base tracking-tight font-display">
                ChatSphere AI
              </h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">
                Real-Time Workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="icon-btn"
              title="Find Connections"
            >
              <Search className="w-4 h-4 text-brand-500" />
            </button>
            <button
              onClick={() => setIsGroupOpen(true)}
              className="icon-btn"
              title="Create Group"
            >
              <Users className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="icon-btn relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full unread-badge"></span>
              )}
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="mt-3 relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={sidebarFilter}
            onChange={(e) => setSidebarFilter(e.target.value)}
            placeholder="Filter conversations..."
            className="w-full input-modern pl-9 pr-8 py-2 text-xs font-medium"
          />
          {sidebarFilter && (
            <button
              onClick={() => setSidebarFilter("")}
              className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Chat List ── */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <div className="px-3 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center justify-between">
          <span>Conversations</span>
          <span className="text-[9px] font-semibold bg-slate-200/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-full">{filteredChats.length}</span>
        </div>

        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center anim-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-3">
              <MessageSquare className="w-7 h-7 text-brand-500 opacity-40" />
            </div>
            <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">No conversations found</p>
            <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">Search for users to start chatting.</p>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="mt-3 btn-brand px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Users</span>
            </button>
          </div>
        ) : (
          filteredChats.map((chat, index) => {
            const isActive = chat.id === activeChatId;
            const isTyping = typingMembers[chat.id] && Object.keys(typingMembers[chat.id]).length > 0;
            const otherMember = chat.members.find(m => m.user.id !== user?.id);
            const isOnline = !chat.is_group && otherMember && onlineUsers[otherMember.user.id] === "online";

            return (
              <div
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`sidebar-chat-item flex items-center gap-3 p-3 cursor-pointer anim-slide-left ${
                  isActive ? "active" : ""
                } stagger-${Math.min(index + 1, 8)}`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <img
                    src={chat.icon_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${chat.name}`}
                    alt=""
                    className={`w-11 h-11 rounded-full object-cover border-2 transition-all ${
                      isActive
                        ? "border-brand-500 shadow-md shadow-brand-500/15"
                        : "border-transparent"
                    }`}
                  />
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-brand-500 border-2 border-white dark:border-slate-900 animate-pulse"></span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h5 className="font-semibold text-sm truncate text-slate-900 dark:text-slate-100">
                      {chat.name}
                    </h5>
                    {chat.last_message_time && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 ml-2 font-medium">
                        {new Date(chat.last_message_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-0.5">
                    {isTyping ? (
                      <div className="flex items-center gap-1.5">
                        <div className="flex gap-0.5">
                          <div className="typing-dot !w-[5px] !h-[5px]"></div>
                          <div className="typing-dot !w-[5px] !h-[5px]"></div>
                          <div className="typing-dot !w-[5px] !h-[5px]"></div>
                        </div>
                        <span className="text-xs text-brand-500 font-medium">typing</span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate pr-2">
                        {chat.last_message_content || "No messages yet"}
                      </p>
                    )}

                    {chat.unread_count > 0 && (
                      <span className="unread-badge w-5 h-5 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">
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

      {/* ── Footer ── */}
      <div className="p-3 border-t border-slate-200/50 dark:border-slate-800/50 glass-panel flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative cursor-pointer" onClick={() => setIsProfileOpen(true)}>
            <img
              src={user?.profile_photo || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`}
              alt="Avatar"
              className="w-9 h-9 rounded-full border-2 border-brand-500/30 hover:border-brand-500 hover:scale-105 transition-all shrink-0"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-brand-500 border-2 border-white dark:border-slate-900"></span>
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-xs text-slate-800 dark:text-white truncate">@{user?.username}</h4>
            <span className="text-[10px] text-brand-500 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
              Online
            </span>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="icon-btn"
            title="Toggle Theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={logout}
            className="icon-btn !text-red-400 hover:!text-red-300 hover:!bg-red-500/10"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
