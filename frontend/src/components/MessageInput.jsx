import React, { useState } from "react";
import EmojiPicker from "emoji-picker-react";
import {
  Send, Paperclip, Mic, Square, Vote, Smile, Reply, X, Sparkles
} from "lucide-react";

export default function MessageInput({
  activeChatId,
  inputText,
  handleInputChange,
  handleSendMessage,
  replyingTo,
  setReplyingTo,
  smartReplies,
  fileInputRef,
  handleFileSelect,
  uploadingFile,
  isRecording,
  startRecording,
  stopRecording,
  recordingDuration,
  setIsPollModalOpen,
  darkMode,
}) {
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  const onEmojiClick = (emojiData) => {
    // Simulate input change with appended emoji
    const syntheticEvent = {
      target: { value: inputText + emojiData.emoji }
    };
    handleInputChange(syntheticEvent);
    setIsEmojiOpen(false);
  };

  return (
    <div className="shrink-0 border-t border-slate-200/60 dark:border-slate-800/60">
      {/* Reply banner */}
      {replyingTo && (
        <div className="px-4 py-2.5 bg-brand-500/5 border-b border-brand-500/10 flex items-center justify-between anim-slide-down">
          <div className="flex items-center gap-2 truncate text-xs">
            <Reply className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <span className="font-bold text-brand-600 dark:text-brand-400">Replying to @{replyingTo.sender_username}:</span>
            <span className="truncate opacity-70 text-slate-600 dark:text-slate-300">{replyingTo.content || `[${replyingTo.message_type}]`}</span>
          </div>
          <button onClick={() => setReplyingTo(null)} className="icon-btn !p-1 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Smart replies */}
      {smartReplies.length > 0 && (
        <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-200/60 dark:border-slate-800/40 flex items-center gap-2 overflow-x-auto anim-slide-up">
          <Sparkles className="w-3.5 h-3.5 text-brand-500 shrink-0" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Smart:</span>
          {smartReplies.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(suggestion)}
              className="smart-chip px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 shrink-0 cursor-pointer"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="p-3 md:p-4 glass-panel flex items-center gap-2 relative">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFile}
          className="icon-btn shrink-0"
          title="Attach image or file"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Poll button */}
        <button
          onClick={() => setIsPollModalOpen(true)}
          className="icon-btn shrink-0"
          title="Create Poll"
        >
          <Vote className="w-5 h-5" />
        </button>

        {isRecording ? (
          /* Recording state */
          <div className="flex-1 flex items-center justify-between bg-red-500/10 px-4 py-2.5 rounded-2xl border border-red-500/20 anim-scale-in">
            <div className="flex items-center gap-2 text-red-500 text-xs font-semibold animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span>Recording ({recordingDuration}s)</span>
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
            {/* Text input */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Type a message (or @AI for assistant)..."
                className="w-full input-modern px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 pr-10"
              />
            </div>

            {/* Emoji button */}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsEmojiOpen(!isEmojiOpen)}
                className="icon-btn"
                title="Emoji"
              >
                <Smile className="w-5 h-5" />
              </button>

              {/* Emoji picker popover */}
              {isEmojiOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsEmojiOpen(false)}></div>
                  <div className="emoji-picker-container absolute bottom-12 right-0 z-50">
                    <EmojiPicker
                      onEmojiClick={onEmojiClick}
                      theme={darkMode ? "dark" : "light"}
                      width={320}
                      height={400}
                      searchPlaceholder="Search emoji..."
                      lazyLoadEmojis={true}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Voice recording button */}
            <button
              onClick={startRecording}
              className="icon-btn shrink-0"
              title="Record voice note"
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* Send button */}
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim()}
              className="btn-brand p-2.5 rounded-xl disabled:opacity-30 disabled:transform-none disabled:shadow-none shrink-0 cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
