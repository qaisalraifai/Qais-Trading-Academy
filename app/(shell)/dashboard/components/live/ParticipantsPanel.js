"use client";

import { Crown, ShieldCheck, MicOff, Mic, Hand, UserMinus, ShieldPlus, ShieldMinus } from "lucide-react";

export default function ParticipantsPanel({ participants, canModerate, onMute, onKick, onPromote, onDemote }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 text-xs text-text-secondary border-b border-line">
        {participants.length} مشارك متصل الآن
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {participants.map((p) => (
          <div key={p.identity} className="flex items-center justify-between gap-2 bg-surface-2 rounded-lg px-2.5 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-surface-3 flex items-center justify-center text-xs font-bold text-gold-300 shrink-0">
                {(p.name || "؟").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-sm text-text-primary truncate">
                  {p.role === "host" && <Crown size={12} className="text-gold-300 shrink-0" />}
                  {p.role === "moderator" && <ShieldCheck size={12} className="text-info shrink-0" />}
                  <span className="truncate">{p.name}</span>
                  {p.isLocal && <span className="text-text-muted text-[10px]">(أنتِ)</span>}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-text-muted">
                  {p.isMicrophoneEnabled ? <Mic size={10} /> : <MicOff size={10} className="text-loss" />}
                  {p.handRaised && <Hand size={10} className="text-gold-300" />}
                </div>
              </div>
            </div>

            {canModerate && !p.isLocal && (
              <div className="flex items-center gap-1 shrink-0">
                {p.isMicrophoneEnabled && (
                  <button onClick={() => onMute(p)} title="كتم" className="p-1.5 rounded-md bg-surface-3 hover:bg-loss/20 text-text-secondary hover:text-loss">
                    <MicOff size={13} />
                  </button>
                )}
                {p.role === "student" ? (
                  <button onClick={() => onPromote(p)} title="ترقية لمساعد" className="p-1.5 rounded-md bg-surface-3 hover:bg-info/20 text-text-secondary hover:text-info">
                    <ShieldPlus size={13} />
                  </button>
                ) : p.role === "moderator" ? (
                  <button onClick={() => onDemote(p)} title="إلغاء صلاحية المساعد" className="p-1.5 rounded-md bg-surface-3 hover:bg-warning/20 text-text-secondary hover:text-warning">
                    <ShieldMinus size={13} />
                  </button>
                ) : null}
                <button onClick={() => onKick(p)} title="إزالة من البث" className="p-1.5 rounded-md bg-surface-3 hover:bg-loss/20 text-text-secondary hover:text-loss">
                  <UserMinus size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
