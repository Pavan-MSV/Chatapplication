import React from "react";

export default function TypingIndicator({ names = [] }) {
  const label = names.length === 1
    ? `${names[0]} is typing`
    : names.length === 2
    ? `${names[0]} and ${names[1]} are typing`
    : names.length > 2
    ? `${names[0]} and ${names.length - 1} others are typing`
    : "Someone is typing";

  return (
    <div className="flex items-center gap-3 px-4 py-2 anim-slide-up">
      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800/60 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <div className="typing-dot"></div>
        <div className="typing-dot"></div>
        <div className="typing-dot"></div>
      </div>
      <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 italic">
        {label}
      </span>
    </div>
  );
}
