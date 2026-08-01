"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Crown, ShieldCheck } from "lucide-react";

function RoleIcon({ role }) {
  if (role === "host") return <Crown size={11} className="text-gold-300 inline" />;
  if (role === "moderator") return <ShieldCheck size={11} className="text-info inline" />;
  return null;
}

export default function ChatPanel({ messages, onSend }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5">
        {messages.length === 0 && <p className="text-text-muted text-xs text-center mt-6">لا توجد رسائل بعد — ابدئي الدردشة!</p>}
        {messages.map((m) => (
          <div key={m.id} className="text-sm leading-relaxed">
            <span className="font-bold text-gold-300 ml-1">
              <RoleIcon role={m.role} /> {m.username}:
            </span>
            <span className="text-text-primary break-words">{m.body}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2.5 border-t border-line">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتبي رسالة..."
          maxLength={1000}
          className="flex-1 bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-gold-300"
        />
        <button type="submit" className="bg-gold-300 text-ink rounded-lg p-2.5 hover:bg-gold-200 transition-colors">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
