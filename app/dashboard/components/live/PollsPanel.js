"use client";

import { useState } from "react";
import { Plus, Lock } from "lucide-react";

export default function PollsPanel({ polls, canCreate, onCreate, onVote, onClose }) {
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  function updateOption(i, v) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));
  }

  function submit(e) {
    e.preventDefault();
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < 2) return;
    onCreate(question.trim(), cleanOptions);
    setQuestion("");
    setOptions(["", ""]);
    setCreating(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {polls.length === 0 && !creating && <p className="text-text-muted text-xs text-center mt-6">لا توجد استطلاعات بعد</p>}

        {polls.map((poll) => (
          <div key={poll.id} className="bg-surface-2 border border-line rounded-lg p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-bold text-text-primary">{poll.question}</p>
              {poll.is_closed && <Lock size={13} className="text-text-muted shrink-0" />}
            </div>
            <div className="space-y-1.5">
              {poll.options.map((opt, i) => {
                const pct = poll.totalVotes ? Math.round((poll.tally[i] / poll.totalVotes) * 100) : 0;
                const selected = poll.myVote === i;
                return (
                  <button
                    key={i}
                    disabled={poll.is_closed || poll.myVote !== null}
                    onClick={() => onVote(poll.id, i)}
                    className={`relative w-full text-right rounded-md px-2.5 py-1.5 text-xs border overflow-hidden disabled:cursor-default ${
                      selected ? "border-gold-300" : "border-line"
                    }`}
                  >
                    <div className="absolute inset-y-0 right-0 bg-gold-300/15" style={{ width: `${pct}%` }} />
                    <div className="relative flex items-center justify-between">
                      <span className="text-text-primary">{opt}</span>
                      <span className="text-text-muted">{pct}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-text-muted">{poll.totalVotes} صوت</span>
              {canCreate && !poll.is_closed && (
                <button onClick={() => onClose(poll.id)} className="text-[11px] text-loss hover:underline">
                  إقفال الاستطلاع
                </button>
              )}
            </div>
          </div>
        ))}

        {creating && (
          <form onSubmit={submit} className="bg-surface-2 border border-gold-300/40 rounded-lg p-3 space-y-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="نص السؤال"
              className="w-full bg-surface-1 border border-line rounded-md px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-gold-300"
            />
            {options.map((o, i) => (
              <input
                key={i}
                value={o}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`خيار ${i + 1}`}
                className="w-full bg-surface-1 border border-line rounded-md px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-gold-300"
              />
            ))}
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setOptions((p) => [...p, ""])} className="text-xs text-info hover:underline">
                + إضافة خيار
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setCreating(false)} className="text-xs text-text-secondary">
                  إلغاء
                </button>
                <button type="submit" className="text-xs bg-gold-300 text-ink px-3 py-1.5 rounded-md font-bold">
                  نشر
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {canCreate && !creating && (
        <button
          onClick={() => setCreating(true)}
          className="m-2.5 flex items-center justify-center gap-1.5 bg-gold-300 text-ink rounded-lg py-2 text-sm font-bold hover:bg-gold-200"
        >
          <Plus size={15} /> استطلاع جديد
        </button>
      )}
    </div>
  );
}
