import React from "react";
import {
  Search, X, Bell, Settings, Users, Vote, Code, Sparkles,
  Folder, FileText, Camera, Video, Phone, PhoneOff, Mic, MicOff,
  VideoOff, Check, Trash2
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   SHARED MODAL WRAPPER
   ═══════════════════════════════════════════════════════════════ */

function ModalOverlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-backdrop" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="modal-content">
        {children}
      </div>
    </div>
  );
}

function DrawerOverlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm z-50 flex justify-end modal-backdrop" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="drawer-content">
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ icon: Icon, title, onClose, iconColor = "text-brand-500" }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-4 mb-5">
      <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${iconColor === "text-brand-500" ? "from-brand-500/15 to-brand-500/5" : "from-indigo-500/15 to-indigo-500/5"} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        {title}
      </h3>
      <button onClick={onClose} className="icon-btn hover:!bg-red-500/10 hover:!text-red-400">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SEARCH USERS MODAL
   ═══════════════════════════════════════════════════════════════ */

export function SearchModal({
  isOpen, onClose, searchQuery, setSearchQuery, searchResults,
  hasSearched, executeSearch, handleSendRequest, handleFriendResponse, onSubmit
}) {
  if (!isOpen) return null;
  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-md glass-modal rounded-3xl p-6">
        <ModalHeader icon={Search} title="Find Connections" onClose={onClose} />

        <form onSubmit={onSubmit} className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (val.trim()) executeSearch(val.trim());
              else { /* parent handles reset */ }
            }}
            placeholder="Search by username or email..."
            className="flex-1 input-modern p-2.5 text-xs font-medium text-slate-800 dark:text-slate-100"
          />
          <button type="submit" className="btn-brand px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer">
            Search
          </button>
        </form>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {searchResults.length === 0 && hasSearched && (
            <p className="text-xs text-slate-400 text-center py-6">No matching users found.</p>
          )}
          {searchResults.map((u) => (
            <div key={u.id} className="p-3 glass-card rounded-xl flex items-center justify-between anim-slide-up">
              <div className="flex items-center gap-2.5 min-w-0">
                <img src={u.profile_photo || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username}`} className="w-9 h-9 rounded-full shrink-0 border border-slate-200 dark:border-slate-700" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">@{u.username}</p>
                  <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                </div>
              </div>
              <div className="shrink-0 ml-2">
                {u.friendship_status === "accepted" ? (
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-semibold rounded-lg">Friends</span>
                ) : u.friendship_status === "sent_pending" ? (
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-semibold rounded-lg">Sent</span>
                ) : u.friendship_status === "received_pending" ? (
                  <button onClick={() => handleFriendResponse(u.id, "accepted")} className="btn-brand px-3 py-1 rounded-lg text-[10px] font-semibold cursor-pointer">Accept</button>
                ) : (
                  <button onClick={() => handleSendRequest(u.username)} className="btn-ghost px-3 py-1 rounded-lg text-[10px] font-semibold cursor-pointer hover:!bg-brand-500 hover:!text-white hover:!border-brand-500">Add</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ModalOverlay>
  );
}

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATIONS MODAL
   ═══════════════════════════════════════════════════════════════ */

export function NotificationsModal({
  isOpen, onClose, pendingRequests, notifications, handleFriendResponse
}) {
  if (!isOpen) return null;
  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-md glass-modal rounded-3xl p-6">
        <ModalHeader icon={Bell} title="Alerts & Requests" onClose={onClose} />

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {pendingRequests.length > 0 && (
            <div className="mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Requests</span>
              {pendingRequests.map((req) => (
                <div key={req.id} className="p-3 mt-1.5 glass-card rounded-xl flex items-center justify-between anim-slide-up">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">@{req.sender_username}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleFriendResponse(req.id, "accepted")} className="btn-brand px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer">Accept</button>
                    <button onClick={() => handleFriendResponse(req.id, "rejected")} className="btn-ghost px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Alerts</span>
          {notifications.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No alerts right now.</p>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="p-3 glass-card rounded-xl anim-slide-up">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{n.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{n.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROFILE SETTINGS MODAL
   ═══════════════════════════════════════════════════════════════ */

export function ProfileModal({
  isOpen, onClose, user, newUsername, setNewUsername, newPhoto,
  profileFileInputRef, handleProfilePhotoUpload, handleUpdateProfile
}) {
  if (!isOpen) return null;
  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-md glass-modal rounded-3xl p-6">
        <ModalHeader icon={Settings} title="Profile Settings" onClose={onClose} />

        <form onSubmit={handleUpdateProfile} className="space-y-5">
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <img
                src={newPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`}
                className="w-24 h-24 rounded-full border-4 border-brand-500/20 group-hover:border-brand-500/40 transition-all shadow-lg"
              />
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                onClick={() => profileFileInputRef.current?.click()}
              >
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            <input type="file" ref={profileFileInputRef} onChange={handleProfilePhotoUpload} className="hidden" accept="image/*" />
            <button type="button" onClick={() => profileFileInputRef.current?.click()} className="text-xs text-brand-500 font-semibold hover:underline">
              Change Photo
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Username</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full input-modern p-2.5 text-xs text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer">Cancel</button>
            <button type="submit" className="btn-brand px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer">Save Changes</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CREATE GROUP MODAL
   ═══════════════════════════════════════════════════════════════ */

export function GroupModal({
  isOpen, onClose, friends, groupName, setGroupName, groupDesc, setGroupDesc,
  selectedGroupMembers, setSelectedGroupMembers, handleCreateGroup
}) {
  if (!isOpen) return null;
  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-md glass-modal rounded-3xl p-6">
        <ModalHeader icon={Users} title="Create Group" onClose={onClose} />

        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Engineering Team"
              className="w-full input-modern p-2.5 text-xs text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Select Friends</label>
            <div className="space-y-1 max-h-40 overflow-y-auto glass-card rounded-xl p-2">
              {friends.map((f) => (
                <label key={f.id} className="flex items-center gap-2.5 p-2 hover:bg-brand-500/5 rounded-xl cursor-pointer text-xs transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedGroupMembers.includes(f.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedGroupMembers([...selectedGroupMembers, f.id]);
                      else setSelectedGroupMembers(selectedGroupMembers.filter(id => id !== f.id));
                    }}
                    className="accent-brand-500"
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">@{f.username}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer">Cancel</button>
            <button type="submit" className="btn-brand px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer">Create Group</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

/* ═══════════════════════════════════════════════════════════════
   POLL CREATION MODAL
   ═══════════════════════════════════════════════════════════════ */

export function PollModal({
  isOpen, onClose, pollQuestion, setPollQuestion,
  pollOptions, setPollOptions, handleCreatePollSubmit
}) {
  if (!isOpen) return null;
  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-md glass-modal rounded-3xl p-6">
        <ModalHeader icon={Vote} title="Create Poll" onClose={onClose} />

        <form onSubmit={handleCreatePollSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Question</label>
            <input
              type="text"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="e.g. What time for sprint review?"
              className="w-full input-modern p-3 text-xs text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Options</label>
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
                className="w-full input-modern p-2.5 text-xs text-slate-800 dark:text-slate-100 mb-2"
              />
            ))}
            {pollOptions.length < 5 && (
              <button type="button" onClick={() => setPollOptions([...pollOptions, ""])} className="text-xs text-brand-500 font-semibold hover:underline">+ Add Option</button>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer">Cancel</button>
            <button type="submit" className="btn-brand px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer">Create Poll</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CODE EXPLAIN MODAL
   ═══════════════════════════════════════════════════════════════ */

export function CodeExplainModal({ state, onClose }) {
  if (!state.isOpen) return null;
  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-xl glass-modal rounded-3xl p-6">
        <ModalHeader icon={Code} title="AI Code Explanation" onClose={onClose} iconColor="text-indigo-500" />

        <div className="mb-4 p-4 bg-slate-950 text-indigo-300 font-mono text-xs rounded-2xl overflow-x-auto max-h-36 border border-indigo-500/10">
          <pre>{state.code}</pre>
        </div>

        {state.loading ? (
          <div className="py-6 text-center">
            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-indigo-400 font-semibold">Analyzing with Gemini AI...</p>
          </div>
        ) : (
          <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
            {state.explanation}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AI SUMMARY MODAL
   ═══════════════════════════════════════════════════════════════ */

export function SummaryModal({ isOpen, onClose, loading, summary }) {
  if (!isOpen) return null;
  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-lg glass-modal rounded-3xl p-6">
        <ModalHeader icon={Sparkles} title="AI Conversation Summary" onClose={onClose} iconColor="text-indigo-500" />

        {loading ? (
          <div className="py-8 text-center">
            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-indigo-400 font-semibold">Summarizing with Gemini AI...</p>
          </div>
        ) : (
          <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
            {summary}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MEDIA GALLERY DRAWER
   ═══════════════════════════════════════════════════════════════ */

export function MediaGalleryDrawer({ isOpen, onClose, mediaGallery, handleDownloadFile }) {
  if (!isOpen) return null;
  return (
    <DrawerOverlay onClose={onClose}>
      <div className="w-full max-w-md glass-modal h-full p-6 flex flex-col overflow-y-auto">
        <ModalHeader icon={Folder} title="Shared Media & Files" onClose={onClose} />

        <div className="space-y-3 flex-1 overflow-y-auto">
          {mediaGallery.length === 0 ? (
            <div className="text-center py-12">
              <Folder className="w-10 h-10 text-slate-400/30 mx-auto mb-3" />
              <p className="text-xs text-slate-400">No shared files or media yet.</p>
            </div>
          ) : (
            mediaGallery.map((item) => (
              <div key={item.id} className="p-3 glass-card rounded-xl flex items-center justify-between anim-slide-up">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-brand-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate text-slate-800 dark:text-slate-200">{item.file_name || item.message_type}</p>
                    <p className="text-[10px] text-slate-400">By @{item.sender_username}</p>
                  </div>
                </div>
                {item.file_url && (
                  <button onClick={() => handleDownloadFile(item.file_url, item.file_name || "file")} className="btn-brand px-3 py-1 rounded-lg text-[10px] font-semibold cursor-pointer">
                    Download
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </DrawerOverlay>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CALL OVERLAY
   ═══════════════════════════════════════════════════════════════ */

export function CallOverlay({ activeCall, endCall, isMuted, setIsMuted, isVideoOff, setIsVideoOff }) {
  if (!activeCall) return null;
  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-lg z-50 flex items-center justify-center p-4 modal-backdrop">
      <div className="w-full max-w-lg glass-modal rounded-3xl p-8 flex flex-col items-center text-center modal-content">
        {/* Avatar with animated ring */}
        <div className="relative mb-6">
          <div className="call-avatar-ring w-28 h-28 rounded-full p-1">
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white">
              {activeCall.callerName?.slice(0, 2).toUpperCase() || "CS"}
            </div>
          </div>
        </div>

        <h3 className="font-bold text-xl text-white mb-1">{activeCall.callerName}</h3>
        <p className="text-xs text-brand-400 font-semibold uppercase tracking-wider mb-8">
          {activeCall.isIncoming ? `Incoming ${activeCall.callType} Call...` : `Active ${activeCall.callType} Call`}
        </p>

        {/* Stream placeholder */}
        <div className="w-full h-48 glass-card rounded-2xl mb-8 flex items-center justify-center relative overflow-hidden">
          <Video className="w-12 h-12 text-slate-700/30 animate-bounce" />
          <span className="absolute bottom-3 left-3 text-[10px] text-slate-500 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
            Encrypted Stream (AES-256)
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-4 rounded-2xl transition-all ${isMuted ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "glass-card hover:bg-slate-800"}`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6 text-slate-300" />}
          </button>
          <button
            onClick={endCall}
            className="p-5 rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white shadow-xl shadow-red-600/30 hover:scale-105 transition-all"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
          <button
            onClick={() => setIsVideoOff(!isVideoOff)}
            className={`p-4 rounded-2xl transition-all ${isVideoOff ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "glass-card hover:bg-slate-800"}`}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6 text-slate-300" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DELETE MESSAGE MODAL
   ═══════════════════════════════════════════════════════════════ */

export function DeleteMessageModal({ isOpen, onClose, onDeleteForEveryone, onDeleteForMe }) {
  if (!isOpen) return null;
  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-sm glass-modal rounded-3xl p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-7 h-7 text-red-500" />
        </div>
        <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2">Delete Message</h3>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">Choose whether to remove this message for yourself or for everyone.</p>

        <div className="flex flex-col gap-2">
          <button onClick={onDeleteForEveryone} className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer">
            Delete for Everyone
          </button>
          <button onClick={onDeleteForMe} className="w-full py-2.5 glass-card text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            Delete for Me
          </button>
          <button onClick={onClose} className="w-full py-2 text-xs text-slate-400 font-medium hover:underline mt-1 cursor-pointer">
            Cancel
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
