import React from "react";
import {
  Smile, Reply, Pin, Code, Trash2, Languages, Sparkles,
  Check, CheckCheck, FileText, Mic, Vote, Download
} from "lucide-react";

const EMOJI_LIST = ["👍", "❤️", "😂", "🔥", "🎉", "😮", "🚀"];

export default function MessageBubble({
  msg,
  isMe,
  isAI,
  user,
  isFirstInGroup,
  isLastInGroup,
  // Reaction state
  activeReactionMsgId,
  setActiveReactionMsgId,
  // Actions
  setReplyingTo,
  togglePinMessage,
  toggleReaction,
  handleExplainCode,
  initiateDeleteMessage,
  handleTranslateMessage,
  translatedMessages,
  translatingMessageId,
  transcriptions,
  handleTranscribeVoice,
  handleDownloadFile,
  audioSpeed,
  toggleAudioSpeed,
  polls,
  votePoll,
  activeChatId,
}) {
  const avatarUrl = isAI
    ? null
    : (isMe
      ? (user?.profile_photo || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`)
      : `https://api.dicebear.com/7.x/adventurer/svg?seed=${msg.sender_username || "user"}`);

  const isDeleted = msg.message_type === "deleted";
  const isCode = msg.content && (msg.content.includes("def ") || msg.content.includes("function") || msg.content.includes("import ") || msg.content.includes("const "));

  // Bubble style class
  const bubbleClass = isDeleted
    ? "msg-bubble-deleted"
    : isAI
    ? "msg-bubble-ai"
    : isMe
    ? "msg-bubble-mine"
    : "msg-bubble-other";

  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"} msg-wrapper group`}>
      <div className={`flex gap-2.5 max-w-[70%] md:max-w-[60%] ${isMe ? "flex-row-reverse" : "flex-row"}`}>
        
        {/* Avatar - only show for first message in group */}
        <div className="w-8 h-8 shrink-0 mt-1">
          {isFirstInGroup && !isAI ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700/50"
            />
          ) : isFirstInGroup && isAI ? (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-[11px] font-bold text-white shadow-md shadow-indigo-500/20">
              🤖
            </div>
          ) : (
            <div className="w-8 h-8"></div> /* Spacer for grouped messages */
          )}
        </div>

        {/* Message content */}
        <div className="flex flex-col min-w-0">
          {/* Sender name - only for first in group */}
          {isFirstInGroup && (
            <span className={`text-[10px] font-semibold mb-1 px-1 tracking-wide uppercase ${
              isAI ? "text-indigo-400" : isMe ? "text-brand-500 text-right" : "text-slate-400 dark:text-slate-500"
            }`}>
              {isAI ? "AI Assistant" : isMe ? "You" : `@${msg.sender_username || "User"}`}
            </span>
          )}

          {/* Bubble */}
          <div className="relative">
            {/* Hover action toolbar */}
            {!isDeleted && (
              <div className={`msg-actions absolute -top-9 z-20 flex items-center gap-0.5 glass-card rounded-xl p-1 shadow-lg ${
                isMe ? "right-0" : "left-0"
              }`}>
                <button
                  onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)}
                  className="icon-btn !p-1.5 !rounded-lg"
                  title="React"
                >
                  <Smile className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setReplyingTo(msg)}
                  className="icon-btn !p-1.5 !rounded-lg"
                  title="Reply"
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => togglePinMessage(msg.id)}
                  className={`icon-btn !p-1.5 !rounded-lg ${msg.is_pinned ? "!text-amber-500" : ""}`}
                  title={msg.is_pinned ? "Unpin" : "Pin"}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
                {/* Translate button */}
                {msg.content && msg.message_type === "text" && (
                  <button
                    onClick={() => handleTranslateMessage(msg.id, msg.content, "en")}
                    className="icon-btn !p-1.5 !rounded-lg"
                    title="Translate"
                    disabled={translatingMessageId === msg.id}
                  >
                    <Languages className={`w-3.5 h-3.5 ${translatingMessageId === msg.id ? "animate-spin" : ""}`} />
                  </button>
                )}
                {isCode && (
                  <button
                    onClick={() => handleExplainCode(msg.content)}
                    className="icon-btn !p-1.5 !rounded-lg !text-indigo-400 hover:!text-indigo-300"
                    title="Explain Code with AI"
                  >
                    <Code className="w-3.5 h-3.5" />
                  </button>
                )}
                {isMe && (
                  <button
                    onClick={() => initiateDeleteMessage(msg)}
                    className="icon-btn !p-1.5 !rounded-lg !text-red-400 hover:!text-red-300"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Reaction emoji picker */}
            {activeReactionMsgId === msg.id && (
              <div className={`reaction-picker absolute -top-16 z-30 flex items-center gap-1 glass-card rounded-full px-2.5 py-1.5 shadow-xl ${
                isMe ? "right-0" : "left-0"
              }`}>
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      toggleReaction(msg.id, emoji);
                      setActiveReactionMsgId(null);
                    }}
                    className="hover:scale-125 transition-transform text-lg p-0.5"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* The bubble itself */}
            <div className={`msg-bubble ${bubbleClass} px-4 py-3 text-sm ${
              isFirstInGroup
                ? (isMe ? "rounded-2xl rounded-tr-md" : "rounded-2xl rounded-tl-md")
                : (isMe ? "rounded-2xl rounded-r-md" : "rounded-2xl rounded-l-md")
            }`}>
              {/* Reply preview */}
              {msg.reply_to && (
                <div className="mb-2 p-2 rounded-lg bg-black/10 dark:bg-white/10 border-l-2 border-brand-400 text-xs">
                  <span className="font-semibold text-[10px] block opacity-75">@{msg.reply_to.sender_username}</span>
                  <p className="truncate opacity-90">{msg.reply_to.content || `[${msg.reply_to.message_type}]`}</p>
                </div>
              )}

              {/* Deleted message */}
              {isDeleted ? (
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 italic py-0.5 text-xs">
                  <Trash2 className="w-3.5 h-3.5 opacity-50 shrink-0" />
                  <span>This message was deleted</span>
                </div>
              ) : (
                <>
                  {/* Image */}
                  {msg.message_type === "image" && (
                    <div className="mb-2 overflow-hidden rounded-xl border border-black/10 max-w-xs">
                      <img src={msg.file_url} alt="Shared" className="w-full h-auto object-cover max-h-60 hover:scale-105 transition-transform duration-300 cursor-pointer" />
                    </div>
                  )}

                  {/* File */}
                  {msg.message_type === "file" && (
                    <button
                      onClick={() => handleDownloadFile(msg.file_url, msg.file_name)}
                      className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-white/10 dark:bg-black/15 border border-white/10 mb-2 hover:bg-white/20 dark:hover:bg-black/25 transition-all cursor-pointer group/file"
                    >
                      <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-brand-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate leading-normal">{msg.file_name}</p>
                        <p className="text-[10px] opacity-60 mt-0.5">{(msg.file_size / 1024).toFixed(1)} KB</p>
                      </div>
                      <Download className="w-4 h-4 opacity-0 group-hover/file:opacity-60 transition-opacity shrink-0" />
                    </button>
                  )}

                  {/* Voice */}
                  {msg.message_type === "voice" && (
                    <div className="flex flex-col gap-2 py-1 mb-2 p-3 rounded-xl bg-white/10 dark:bg-black/15 border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-500/15 flex items-center justify-center shrink-0">
                          <Mic className="w-4 h-4 text-brand-500" />
                        </div>
                        <audio
                          src={msg.file_url}
                          controls
                          className="w-48 h-8 rounded-lg outline-none"
                          playbackRate={audioSpeed[msg.id] || 1}
                        />
                        <button
                          onClick={() => toggleAudioSpeed(msg.id)}
                          className="px-2 py-1 bg-brand-500/20 text-brand-400 font-bold text-[10px] rounded-lg hover:bg-brand-500/30 transition-colors"
                        >
                          {audioSpeed[msg.id] || 1}x
                        </button>
                      </div>

                      <button
                        onClick={() => handleTranscribeVoice(msg.id)}
                        className="text-[10px] text-indigo-400 font-semibold flex items-center gap-1 hover:underline self-start"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>AI Transcribe</span>
                      </button>

                      {transcriptions[msg.id] && (
                        <p className="text-xs italic text-slate-500 dark:text-slate-400 pt-1 border-t border-white/10">
                          "{transcriptions[msg.id]}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Poll */}
                  {msg.message_type === "poll" && (
                    <div className="p-3 rounded-xl bg-white/10 dark:bg-black/15 border border-white/10 w-64 md:w-80">
                      <div className="flex items-center gap-2 mb-2">
                        <Vote className="w-4 h-4 text-brand-500" />
                        <span className="font-bold text-xs">Poll</span>
                      </div>
                      <p className="font-semibold text-sm mb-3">{msg.content?.replace("📊 Poll: ", "")}</p>

                      {polls.find(p => p.message_id === msg.id)?.options.map((opt) => {
                        const poll = polls.find(p => p.message_id === msg.id);
                        const percent = poll?.total_votes ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;

                        return (
                          <button
                            key={opt.id}
                            onClick={() => votePoll(activeChatId, poll.id, opt.id)}
                            className={`w-full text-left p-2.5 rounded-xl border mb-2 relative overflow-hidden transition-all text-xs font-medium ${
                              opt.voted_by_me
                                ? "border-brand-500 bg-brand-500/15 text-brand-400"
                                : "border-white/10 bg-white/5 hover:bg-white/10"
                            }`}
                          >
                            <div
                              className="absolute top-0 left-0 bottom-0 bg-brand-500/15 z-0 transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                            <div className="relative z-10 flex items-center justify-between">
                              <span>{opt.option_text}</span>
                              <span className="text-[10px] font-bold opacity-80">{opt.vote_count} ({percent}%)</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Text content */}
                  {msg.message_type !== "poll" && msg.content && (
                    <p className="leading-relaxed break-words whitespace-pre-wrap">
                      {translatedMessages[msg.id] || msg.content}
                    </p>
                  )}
                </>
              )}

              {/* Translation indicator */}
              {translatedMessages[msg.id] && !isDeleted && (
                <div className="text-[10px] mt-2 pt-1 border-t border-white/15 opacity-60 italic flex items-center gap-1">
                  <Languages className="w-3 h-3" />
                  Translated from original
                </div>
              )}

              {/* Reactions display */}
              {msg.reactions && msg.reactions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-1">
                  {Object.entries(
                    msg.reactions.reduce((acc, r) => {
                      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([emoji, count]) => (
                    <span key={emoji} className="px-2 py-0.5 rounded-full bg-white/10 dark:bg-white/5 border border-white/10 text-[10px] font-semibold flex items-center gap-1">
                      <span>{emoji}</span>
                      <span>{count}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Timestamp + read receipt */}
              {isLastInGroup && (
                <div className={`flex items-center gap-1.5 mt-2 text-[10px] ${
                  isMe ? "justify-end" : "justify-start"
                } ${isDeleted ? "opacity-40" : "opacity-60"}`}>
                  <span>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {isMe && !isDeleted && (
                    msg.is_seen ? (
                      <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
