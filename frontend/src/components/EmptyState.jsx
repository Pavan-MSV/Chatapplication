import React from "react";
import { MessageSquare, Search, Users, Sparkles, Mic, FileText, Shield } from "lucide-react";

const FEATURES = [
  { icon: Sparkles, label: "AI Smart Replies", desc: "Get intelligent reply suggestions" },
  { icon: Mic, label: "Voice Notes", desc: "Record & transcribe voice messages" },
  { icon: Users, label: "Group Chats", desc: "Create channels for your team" },
  { icon: Shield, label: "End-to-End", desc: "Private & secure messaging" },
];

export default function EmptyState({ onSearchOpen }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center relative overflow-hidden select-none">
      {/* Floating gradient orbs */}
      <div className="empty-orb empty-orb-1"></div>
      <div className="empty-orb empty-orb-2"></div>
      <div className="empty-orb empty-orb-3"></div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center max-w-md px-6">
        {/* Animated logo icon */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500/20 to-indigo-500/20 flex items-center justify-center border border-brand-500/10 anim-scale-in">
            <MessageSquare className="w-9 h-9 text-brand-500" />
          </div>
          {/* Orbiting dot */}
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 anim-float shadow-lg shadow-indigo-500/30"></div>
        </div>

        {/* Heading with gradient text */}
        <h2 className="text-2xl md:text-3xl font-bold mb-3 anim-slide-up" style={{ animationDelay: "0.1s" }}>
          <span className="gradient-text">Welcome to ChatSphere</span>
        </h2>
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-8 leading-relaxed anim-slide-up" style={{ animationDelay: "0.15s" }}>
          Select a conversation from the sidebar to start chatting, or search for new connections to add.
        </p>

        {/* Feature cards grid */}
        <div className="grid grid-cols-2 gap-3 w-full mb-8">
          {FEATURES.map((feat, i) => (
            <div
              key={feat.label}
              className="glass-card rounded-2xl p-4 text-left anim-slide-up hover:scale-[1.02] transition-transform cursor-default"
              style={{ animationDelay: `${0.2 + i * 0.05}s` }}
            >
              <feat.icon className="w-5 h-5 text-brand-500 mb-2" />
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-0.5">{feat.label}</h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={onSearchOpen}
          className="btn-brand px-6 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 anim-slide-up"
          style={{ animationDelay: "0.4s" }}
        >
          <Search className="w-4 h-4" />
          <span>Find & Connect</span>
        </button>
      </div>
    </div>
  );
}
