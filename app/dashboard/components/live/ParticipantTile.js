"use client";

import { useEffect, useRef } from "react";
import { Track } from "livekit-client";
import { MicOff, Hand, ShieldCheck, Crown, Wifi, WifiOff, SignalMedium } from "lucide-react";

function QualityIcon({ quality }) {
  if (quality === "excellent") return <Wifi size={13} className="text-profit" />;
  if (quality === "good") return <SignalMedium size={13} className="text-warning" />;
  if (quality === "poor") return <WifiOff size={13} className="text-loss" />;
  return null;
}

function RoleBadge({ role }) {
  if (role === "host") return <Crown size={12} className="text-gold-300" />;
  if (role === "moderator") return <ShieldCheck size={12} className="text-info" />;
  return null;
}

export default function ParticipantTile({ room, participant, big = false, source = Track.Source.Camera }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  const rp = participant.isLocal
    ? room.current?.localParticipant
    : room.current?.getParticipantByIdentity?.(participant.identity);

  const videoTrack = rp?.getTrackPublication?.(source)?.track || null;
  const audioTrack = !participant.isLocal ? rp?.getTrackPublication?.(Track.Source.Microphone)?.track || null : null;
  const hasVideo = source === Track.Source.Camera ? participant.isCameraEnabled : participant.isScreenShareEnabled;

  // نربط الفيديو بس لما المسار (track) يتغيّر فعليًا أو لما عنصر الفيديو يترسم/يتشال
  // من الصفحة (تشغيل/تعطيل الكاميرا) — مش بكل مرة الشاشة تتحدّث عمومًا
  useEffect(() => {
    const el = videoRef.current;
    if (videoTrack && el) videoTrack.attach(el);
    return () => {
      if (el) videoTrack?.detach(el); // فك الربط عن هالعنصر بالذات بس، مش عن كل العناصر
    };
  }, [videoTrack, hasVideo]);

  // نفس الشي بالصوت — وهاد بالتحديد كان سبب الصدى وتكرار الصوت: كان الصوت
  // ينربط بعنصر <audio> جديد من غير ما ينفك من القديم صح، فصار الصوت يتشغّل
  // من مكانين بنفس الوقت (خصوصًا وقت الحكي، لأنه وقتها الشاشة بتتحدّث كتير)
  useEffect(() => {
    if (participant.isLocal) return;
    const el = audioRef.current;
    if (audioTrack && el) audioTrack.attach(el);
    return () => {
      if (el) audioTrack?.detach(el);
    };
  }, [audioTrack, participant.isLocal]);

  const isSpeaking = participant.isSpeaking && source === Track.Source.Camera;

  return (
    <div
      className={`relative w-full h-full rounded-xl overflow-hidden bg-surface-1 border transition-shadow ${
        isSpeaking ? "border-gold-300 shadow-glow-sm" : "border-line"
      }`}
    >
      {hasVideo ? (
        <video ref={videoRef} autoPlay playsInline muted={participant.isLocal} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface-2 to-surface-0">
          <div
            className={`rounded-full bg-surface-3 border border-line flex items-center justify-center font-bold text-gold-300 ${
              big ? "w-20 h-20 text-2xl" : "w-10 h-10 text-sm"
            }`}
          >
            {(participant.name || "؟").trim().charAt(0).toUpperCase()}
          </div>
          {big && <span className="text-text-secondary text-xs">الكاميرا مقفلة</span>}
        </div>
      )}

      {!participant.isLocal && <audio ref={audioRef} autoPlay />}

      <div className="absolute bottom-1.5 right-1.5 left-1.5 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded-md max-w-[75%]">
          <RoleBadge role={participant.role} />
          <span className="text-[11px] text-text-primary truncate">{participant.name}</span>
          {!participant.isMicrophoneEnabled && <MicOff size={11} className="text-loss shrink-0" />}
        </div>
        <div className="flex items-center gap-1">
          {participant.handRaised && (
            <span className="bg-gold-300 text-ink rounded-md p-0.5">
              <Hand size={11} />
            </span>
          )}
          <span className="bg-black/60 backdrop-blur rounded-md p-0.5">
            <QualityIcon quality={participant.connectionQuality} />
          </span>
        </div>
      </div>
    </div>
  );
}
