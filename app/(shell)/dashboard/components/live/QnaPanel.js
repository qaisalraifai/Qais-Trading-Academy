"use client";

import { useState } from "react";
import { ThumbsUp, CheckCircle2, Send } from "lucide-react";

export default function QnaPanel({ questions, canAnswer, onAsk, onUpvote, onMarkAnswered }) {
  const [text, setText] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onAsk(text.trim());
    setText("");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {questions.length === 0 && <p className="text-text-muted text-xs text-center mt-6">لا توجد أسئلة بعد</p>}
        {questions.map((q) => (
          <div key={q.id} className={`rounded-lg p-2.5 border ${q.is_answered ? "bg-profit/5 border-profit/30" : "bg-surface-2 border-line"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-gold-300">{q.username}</span>
                <p className="text-sm text-text-primary mt-0.5">{q.question}</p>
              </div>
              {q.is_answered && <CheckCircle2 size={15} className="text-profit shrink-0" />}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <button onClick={() => onUpvote(q.id)} className="flex items-center gap-1 text-xs text-text-secondary hover:text-gold-300">
                <ThumbsUp size={12} /> {q.upvotes}
              </button>
              {canAnswer && !q.is_answered && (
                <button onClick={() => onMarkAnswered(q.id)} className="text-xs text-info hover:underline">
                  تمّت الإجابة
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex items-center gap-2 p-2.5 border-t border-line">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اسألي سؤالك..."
          className="flex-1 bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-gold-300"
        />
        <button type="submit" className="bg-gold-300 text-ink rounded-lg p-2.5 hover:bg-gold-200 transition-colors">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
