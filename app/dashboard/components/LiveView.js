"use client";

import { useEffect, useState } from "react";
import { Radio, Loader2, Video, Users } from "lucide-react";
import Link from "next/link";
import LiveRoom from "./live/LiveRoom";

function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("ar-JO", { hour: "2-digit", minute: "2-digit" });
}

function SessionCard({ sess, onJoin, joining }) {
  const courseTitle = sess.batches?.courses?.title;
  return (
    <div className="bg-surface-1 border border-line rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="flex items-center gap-1 bg-loss text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            <Radio size={10} /> مباشر الآن
          </span>
          <h3 className="text-text-primary font-bold text-base">{sess.title}</h3>
        </div>
        <p className="text-text-secondary text-xs">
          {sess.batches?.name && `دفعة: ${sess.batches.name}`} {courseTitle && `— ${courseTitle}`}
        </p>
        <p className="text-text-muted text-[11px] mt-0.5">بدأ الساعة {fmtTime(sess.started_at)}</p>
      </div>
      <button
        onClick={() => onJoin(sess)}
        disabled={joining}
        className="bg-gold-300 text-ink font-bold rounded-lg px-5 py-2.5 text-sm hover:bg-gold-200 disabled:opacity-60 inline-flex items-center gap-2 shrink-0"
      >
        {joining ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
        {joining ? "جاري الانضمام..." : "انضمام"}
      </button>
    </div>
  );
}

export default function LiveView({ isAdmin = false, username = "" }) {
  const [sessions, setSessions] = useState(undefined); // undefined = تحميل
  const [joining, setJoining] = useState(null); // id الجلسة يلي عم تنضم إلها
  const [error, setError] = useState("");
  const [tokenInfo, setTokenInfo] = useState(null);
  const [activeSession, setActiveSession] = useState(null);

  async function fetchSessions() {
    try {
      const res = await fetch("/api/live");
      const data = await res.json();
      if (res.ok) setSessions(data.sessions || []);
    } catch (e) {
      // تجاهل أخطاء الشبكة العابرة أثناء الـ polling
    }
  }

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(() => {
      if (!tokenInfo) fetchSessions(); // ما نعمل polling وإحنا جوا البث
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenInfo]);

  async function handleJoin(sess) {
    setJoining(sess.id);
    setError("");
    try {
      const res = await fetch("/api/live/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sess.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر الانضمام للبث");
      setActiveSession(sess);
      setTokenInfo(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setJoining(null);
    }
  }

  function handleLeave() {
    setTokenInfo(null);
    setActiveSession(null);
    fetchSessions();
  }

  return (
    <div className="bg-surface-0 border border-line rounded-2xl p-4 sm:p-6">
      {!tokenInfo && (
        <div className="mb-4">
          <h2 className="text-text-primary font-bold text-xl flex items-center gap-2">
            <Radio size={20} className="text-loss" /> البث المباشر
          </h2>
          <p className="text-text-secondary text-sm mt-1">
            {sessions?.length
              ? "في بث مباشر عم يصير هلأ لدفعتك — انضمي وشاركي بالنقاش."
              : "ما في بث مباشر هلأ."}
          </p>
        </div>
      )}

      {error && !tokenInfo && <p className="text-loss text-sm mb-3">{error}</p>}

      {sessions === undefined ? (
        <div className="text-text-muted text-sm py-12 text-center flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> جاري التحقق...
        </div>
      ) : tokenInfo && activeSession ? (
        <LiveRoom session={{ ...activeSession, recording_status: activeSession.recording_status }} tokenInfo={tokenInfo} onLeave={handleLeave} />
      ) : sessions.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-line rounded-xl">
          <div className="text-3xl mb-2">📡</div>
          <p className="text-text-secondary text-sm">
            {isAdmin
              ? "ما في بث نشط. ابدئي بث من صفحة الدفعة (تبويب «البث والحضور»)."
              : "بترجعي تشوفي هون تلقائيًا لما تبدأ الأكاديمية بث مباشر لدفعتك."}
          </p>
          {isAdmin && (
            <Link href="/admin/batches" className="inline-flex items-center gap-1.5 text-gold-300 text-sm font-bold mt-3 hover:underline">
              <Users size={14} /> الذهاب لإدارة الدفعات
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((sess) => (
            <SessionCard key={sess.id} sess={sess} onJoin={handleJoin} joining={joining === sess.id} />
          ))}
          <p className="text-text-muted text-[11px] mt-2">
            رح يفتحلك المتصفح إذن الوصول للكاميرا والمايك — فيكِ تنضمي وتتفرجي بس بدون تفعيلهم.
          </p>
        </div>
      )}
    </div>
  );
}
