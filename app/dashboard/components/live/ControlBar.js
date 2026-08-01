"use client";

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  Hand,
  Smile,
  Settings,
  PhoneOff,
  MessageSquare,
  Users,
  Circle,
  StopCircle,
  FileText,
  HelpCircle,
  BarChart3,
  Maximize,
  Minimize,
  Loader2,
} from "lucide-react";

const REACTIONS = ["👍", "❤️", "😂", "👏", "🔥", "🎉"];

function CtrlBtn({ active, danger, onClick, children, label, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-xl border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? "bg-loss/15 border-loss/40 text-loss hover:bg-loss/25"
          : active
          ? "bg-gold-300 border-gold-300 text-ink"
          : "bg-surface-2 border-line text-text-primary hover:bg-surface-3"
      }`}
    >
      {children}
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  );
}

export default function ControlBar({
  micEnabled,
  camEnabled,
  screenEnabled,
  screenRequestPending,
  handRaised,
  isHost,
  isModerator,
  isRecording,
  onToggleMic,
  onToggleCam,
  onToggleScreen,
  onToggleHand,
  onReact,
  onOpenSettings,
  onToggleChat,
  onToggleParticipants,
  onToggleFiles,
  onToggleQna,
  onTogglePolls,
  onToggleRecording,
  onLeave,
  isFullscreen,
  onToggleFullscreen,
}) {
  return (
    <div className="flex items-center justify-between gap-2 bg-surface-1/95 backdrop-blur border border-line rounded-2xl px-3 py-2 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        <CtrlBtn active={micEnabled} onClick={onToggleMic} label={micEnabled ? "كتم" : "تفعيل المايك"}>
          {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
        </CtrlBtn>
        <CtrlBtn active={camEnabled} onClick={onToggleCam} label={camEnabled ? "إيقاف الكاميرا" : "تفعيل الكاميرا"}>
          {camEnabled ? <Video size={18} /> : <VideoOff size={18} />}
        </CtrlBtn>
        <CtrlBtn
          active={screenEnabled}
          disabled={screenRequestPending}
          onClick={onToggleScreen}
          label={screenRequestPending ? "بانتظار الموافقة" : screenEnabled ? "إيقاف المشاركة" : "مشاركة الشاشة"}
        >
          {screenRequestPending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : screenEnabled ? (
            <ScreenShareOff size={18} />
          ) : (
            <ScreenShare size={18} />
          )}
        </CtrlBtn>
        <CtrlBtn active={handRaised} onClick={onToggleHand} label={handRaised ? "خفض اليد" : "رفع اليد"}>
          <Hand size={18} />
        </CtrlBtn>

        <div className="relative group">
          <CtrlBtn label="ردود فعل" onClick={() => {}}>
            <Smile size={18} />
          </CtrlBtn>
          <div className="absolute bottom-full mb-2 right-0 hidden group-hover:flex bg-surface-2 border border-line rounded-xl p-2 gap-1 z-20">
            {REACTIONS.map((e) => (
              <button key={e} onClick={() => onReact(e)} className="text-xl hover:scale-125 transition-transform">
                {e}
              </button>
            ))}
          </div>
        </div>

        <CtrlBtn onClick={onOpenSettings} label="الإعدادات">
          <Settings size={18} />
        </CtrlBtn>

        {onToggleFullscreen && (
          <CtrlBtn active={isFullscreen} onClick={onToggleFullscreen} label={isFullscreen ? "تصغير" : "ملء الشاشة"}>
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </CtrlBtn>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <CtrlBtn onClick={onToggleChat} label="الدردشة">
          <MessageSquare size={18} />
        </CtrlBtn>
        <CtrlBtn onClick={onToggleParticipants} label="المشاركون">
          <Users size={18} />
        </CtrlBtn>
        <CtrlBtn onClick={onToggleQna} label="الأسئلة">
          <HelpCircle size={18} />
        </CtrlBtn>
        <CtrlBtn onClick={onTogglePolls} label="استطلاعات">
          <BarChart3 size={18} />
        </CtrlBtn>
        <CtrlBtn onClick={onToggleFiles} label="ملفات">
          <FileText size={18} />
        </CtrlBtn>

        {(isHost || isModerator) && (
          <CtrlBtn active={isRecording} danger={isRecording} onClick={onToggleRecording} label={isRecording ? "إيقاف التسجيل" : "تسجيل"}>
            {isRecording ? <StopCircle size={18} /> : <Circle size={18} />}
          </CtrlBtn>
        )}

        <button
          onClick={onLeave}
          title="مغادرة"
          className="flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-xl bg-loss text-white hover:bg-loss/85 transition-colors"
        >
          <PhoneOff size={18} />
          <span className="text-[10px] leading-none">مغادرة</span>
        </button>
      </div>
    </div>
  );
}
