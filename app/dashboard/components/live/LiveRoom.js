"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Radio } from "lucide-react";
import { Track } from "livekit-client";
import { useLiveKitRoom } from "./useLiveKitRoom";
import VideoStage from "./VideoStage";
import ControlBar from "./ControlBar";
import ConnectionBadge from "./ConnectionBadge";
import DeviceSettingsModal from "./DeviceSettingsModal";
import ReactionsLayer from "./ReactionsLayer";
import AnnouncementBanner from "./AnnouncementBanner";
import SidePanel from "./SidePanel";
import ChatPanel from "./ChatPanel";
import ParticipantsPanel from "./ParticipantsPanel";
import QnaPanel from "./QnaPanel";
import PollsPanel from "./PollsPanel";
import FilesPanel from "./FilesPanel";

export default function LiveRoom({ session, tokenInfo, onLeave }) {
  const [panel, setPanel] = useState(null); // 'chat' | 'participants' | 'qna' | 'polls' | 'files' | null
  const [showSettings, setShowSettings] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [announcement, setAnnouncement] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [polls, setPolls] = useState([]);
  const [files, setFiles] = useState([]);
  const [recordingStatus, setRecordingStatus] = useState(session.recording_status || "idle");

  const isHost = tokenInfo.role === "host";
  const isModerator = tokenInfo.role === "moderator";
  const canModerate = isHost || isModerator;

  const {
    room,
    connState,
    participants,
    micEnabled,
    camEnabled,
    screenEnabled,
    handRaised,
    error,
    devices,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    setCameraDevice,
    setMicrophoneDevice,
    setSpeakerDevice,
    sendChat,
    sendReaction,
    sendAnnouncement,
    onReaction,
    toggleHandRaise,
  } = useLiveKitRoom({
    wsUrl: tokenInfo.wsUrl,
    token: tokenInfo.token,
    onChatMessage: (msg) => setChatMessages((prev) => [...prev, msg]),
    onAnnouncement: (data) => {
      setAnnouncement(data);
      setTimeout(() => setAnnouncement((cur) => (cur?.at === data.at ? null : cur)), 8000);
    },
  });

  // تسجيل الحضور — نفس نظام الحضور الموجود أصلاً بالمنصة (المرحلة 8)
  useEffect(() => {
    fetch("/api/live/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.id }),
    }).catch(() => {});

    function markLeave() {
      navigator.sendBeacon?.(
        "/api/live/attendance",
        new Blob([JSON.stringify({ session_id: session.id, event: "leave" })], { type: "application/json" })
      );
    }
    window.addEventListener("beforeunload", markLeave);
    return () => {
      window.removeEventListener("beforeunload", markLeave);
      markLeave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // ردود الفعل الطايرة
  useEffect(() => {
    const off = onReaction((data) => {
      const id = `${Date.now()}-${Math.random()}`;
      setReactions((prev) => [...prev, { id, emoji: data.emoji, left: 10 + Math.random() * 80 }]);
      setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2700);
    });
    return off;
  }, [onReaction]);

  // تحميل تاريخ الدردشة عند الدخول
  useEffect(() => {
    fetch(`/api/live/chat?sessionId=${session.id}`)
      .then((r) => r.json())
      .then((d) => setChatMessages(d.messages || []))
      .catch(() => {});
  }, [session.id]);

  const loadQna = useCallback(() => {
    fetch(`/api/live/qna?sessionId=${session.id}`)
      .then((r) => r.json())
      .then((d) => setQuestions(d.questions || []))
      .catch(() => {});
  }, [session.id]);

  const loadPolls = useCallback(() => {
    fetch(`/api/live/polls?sessionId=${session.id}`)
      .then((r) => r.json())
      .then((d) => setPolls(d.polls || []))
      .catch(() => {});
  }, [session.id]);

  const loadFiles = useCallback(() => {
    fetch(`/api/live/files?sessionId=${session.id}`)
      .then((r) => r.json())
      .then((d) => setFiles(d.files || []))
      .catch(() => {});
  }, [session.id]);

  useEffect(() => {
    if (panel === "qna") loadQna();
    if (panel === "polls") loadPolls();
    if (panel === "files") loadFiles();
  }, [panel, loadQna, loadPolls, loadFiles]);

  function handleSendChat(body) {
    sendChat({ username: tokenInfo.username, role: tokenInfo.role, body, id: `local-${Date.now()}` });
    fetch("/api/live/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, body }),
    }).catch(() => {});
  }

  async function handleModerationAction(action, participant, extra = {}) {
    await fetch("/api/admin/live/participants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, action, identity: participant.identity, ...extra }),
    }).catch(() => {});
  }

  async function handleAsk(question) {
    const res = await fetch("/api/live/qna", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, question }),
    });
    const data = await res.json();
    if (res.ok) setQuestions((prev) => [...prev, data.question]);
  }

  async function handleUpvote(id) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, upvotes: q.upvotes + 1 } : q)));
    await fetch("/api/live/qna", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, sessionId: session.id, action: "upvote" }),
    }).catch(() => {});
  }

  async function handleMarkAnswered(id) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, is_answered: true } : q)));
    await fetch("/api/live/qna", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, sessionId: session.id, action: "answer" }),
    }).catch(() => {});
  }

  async function handleCreatePoll(question, options) {
    const res = await fetch("/api/live/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, question, options }),
    });
    if (res.ok) loadPolls();
  }

  async function handleVote(pollId, optionIndex) {
    await fetch("/api/live/polls/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollId, optionIndex }),
    });
    loadPolls();
  }

  async function handleClosePoll(pollId) {
    await fetch("/api/live/polls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollId, sessionId: session.id }),
    });
    loadPolls();
  }

  async function handleToggleRecording() {
    if (recordingStatus === "recording") {
      setRecordingStatus("processing");
      await fetch("/api/admin/live/recording", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      }).catch(() => {});
    } else {
      const res = await fetch("/api/admin/live/recording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      if (res.ok) setRecordingStatus("recording");
    }
  }

  function handleSendAnnouncement(message) {
    const data = { message, at: Date.now() };
    sendAnnouncement(data);
    setAnnouncement(data);
    setTimeout(() => setAnnouncement((cur) => (cur?.at === data.at ? null : cur)), 8000);
    fetch("/api/live/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, message }),
    }).catch(() => {});
  }

  const togglePanel = (name) => setPanel((cur) => (cur === name ? null : name));

  return (
    <div className="flex flex-col gap-3 w-full h-[85vh] min-h-[560px]">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 bg-loss text-white text-xs font-bold px-2 py-1 rounded-md">
            <Radio size={12} className="animate-pulse-soft" /> بث مباشر
          </span>
          <h2 className="text-text-primary font-bold text-base">{session.title}</h2>
          {recordingStatus === "recording" && (
            <span className="text-loss text-xs font-bold flex items-center gap-1">● يتم التسجيل</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-text-secondary text-xs">
            <Users size={13} /> {participants.length}
          </span>
          <ConnectionBadge state={connState} />
        </div>
      </div>

      {error && <p className="text-loss text-xs">{error}</p>}

      {isHost && (
        <div className="flex items-center gap-2">
          <input
            placeholder="اكتبي تنبيهًا يظهر لكل الحضور..."
            className="flex-1 bg-surface-2 border border-line rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-gold-300"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                handleSendAnnouncement(e.currentTarget.value.trim());
                e.currentTarget.value = "";
              }
            }}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 flex gap-3">
        <div className="relative flex-1 min-w-0 flex flex-col gap-3">
          <div className="relative flex-1 min-h-0">
            <VideoStage room={room} participants={participants} />
            <ReactionsLayer reactions={reactions} />
            <AnnouncementBanner announcement={announcement} onDismiss={() => setAnnouncement(null)} />
          </div>

          <ControlBar
            micEnabled={micEnabled}
            camEnabled={camEnabled}
            screenEnabled={screenEnabled}
            handRaised={handRaised}
            isHost={isHost}
            isModerator={isModerator}
            isRecording={recordingStatus === "recording"}
            onToggleMic={toggleMic}
            onToggleCam={toggleCam}
            onToggleScreen={toggleScreenShare}
            onToggleHand={toggleHandRaise}
            onReact={sendReaction}
            onOpenSettings={() => setShowSettings(true)}
            onToggleChat={() => togglePanel("chat")}
            onToggleParticipants={() => togglePanel("participants")}
            onToggleFiles={() => togglePanel("files")}
            onToggleQna={() => togglePanel("qna")}
            onTogglePolls={() => togglePanel("polls")}
            onToggleRecording={handleToggleRecording}
            onLeave={onLeave}
          />
        </div>

        {panel && (
          <div className="w-[320px] shrink-0 hidden md:block">
            {panel === "chat" && (
              <SidePanel title="الدردشة المباشرة" onClose={() => setPanel(null)}>
                <ChatPanel messages={chatMessages} onSend={handleSendChat} />
              </SidePanel>
            )}
            {panel === "participants" && (
              <SidePanel title="المشاركون" onClose={() => setPanel(null)}>
                <ParticipantsPanel
                  participants={participants}
                  canModerate={canModerate}
                  onMute={(p) => {
                    const rp = room.current?.getParticipantByIdentity?.(p.identity);
                    const trackSid = rp?.getTrackPublication?.(Track.Source.Microphone)?.trackSid;
                    if (trackSid) handleModerationAction("mute", p, { trackSid });
                  }}
                  onKick={(p) => handleModerationAction("kick", p)}
                  onPromote={(p) => handleModerationAction("promote", p)}
                  onDemote={(p) => handleModerationAction("demote", p)}
                />
              </SidePanel>
            )}
            {panel === "qna" && (
              <SidePanel title="الأسئلة" onClose={() => setPanel(null)}>
                <QnaPanel questions={questions} canAnswer={canModerate} onAsk={handleAsk} onUpvote={handleUpvote} onMarkAnswered={handleMarkAnswered} />
              </SidePanel>
            )}
            {panel === "polls" && (
              <SidePanel title="الاستطلاعات" onClose={() => setPanel(null)}>
                <PollsPanel polls={polls} canCreate={canModerate} onCreate={handleCreatePoll} onVote={handleVote} onClose={handleClosePoll} />
              </SidePanel>
            )}
            {panel === "files" && (
              <SidePanel title="الملفات المشتركة" onClose={() => setPanel(null)}>
                <FilesPanel sessionId={session.id} files={files} canUpload={canModerate} onUploaded={(f) => setFiles((p) => [f, ...p])} />
              </SidePanel>
            )}
          </div>
        )}
      </div>

      {showSettings && (
        <DeviceSettingsModal
          devices={devices}
          onSelectCamera={setCameraDevice}
          onSelectMic={setMicrophoneDevice}
          onSelectSpeaker={setSpeakerDevice}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
