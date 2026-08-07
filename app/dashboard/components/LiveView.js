"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, PlusCircle, Radio, RadioTower, Square, Users, Video } from "lucide-react";
import Link from "next/link";
import LiveRoom from "./live/LiveRoom";

function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("ar-JO", { hour: "2-digit", minute: "2-digit" });
}

function SessionCard({ sess, onJoin, joining, isAdmin, onEnd, ending }) {
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
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onJoin(sess)}
          disabled={joining}
          className="bg-gold-300 text-ink font-bold rounded-lg px-5 py-2.5 text-sm hover:bg-gold-200 disabled:opacity-60 inline-flex items-center gap-2 shrink-0"
        >
          {joining ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
          {joining ? "جاري الانضمام..." : "انضمام"}
        </button>
        {isAdmin && (
          <button
            onClick={() => onEnd(sess)}
            disabled={ending}
            title="إنهاء البث"
            className="bg-loss/15 border border-loss/40 text-loss font-bold rounded-lg px-3 py-2.5 text-sm hover:bg-loss/25 disabled:opacity-60 inline-flex items-center gap-2 shrink-0"
          >
            {ending ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
            {ending ? "جاري الإنهاء..." : "إنهاء"}
          </button>
        )}
      </div>
    </div>
  );
}

// لوحة تحكم الأدمن — بدء بث جديد لأي دفعة مباشرة من هاي الصفحة، من غير الحاجة
// للذهاب لصفحة الدفعة. بتظهر بس للأدمن (isAdmin).
function AdminStartPanel({ onStarted }) {
  const [open, setOpen] = useState(false);
  const [batches, setBatches] = useState(undefined);
  const [starting, setStarting] = useState(null);
  const [error, setError] = useState("");

  const loadBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/batches");
      const data = await res.json();
      if (res.ok) setBatches(data.batches || data || []);
    } catch (e) {
      // تجاهل
    }
  }, []);

  useEffect(() => {
    if (open && batches === undefined) loadBatches();
  }, [open, batches, loadBatches]);

  async function handleStart(batch) {
    setStarting(batch.id);
    setError("");
    try {
      const res = await fetch("/api/admin/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: batch.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "صار خطأ ببدء البث");
      await loadBatches();
      onStarted?.();
      setOpen(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(null);
    }
  }

  const availableBatches = (batches || []).filter((b) => !b.live_session);

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-gold-300 text-sm font-bold hover:underline"
      >
        <PlusCircle size={16} /> بدء بث جديد لدفعة
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-2 bg-surface-1 border border-line rounded-xl p-3">
          {error && <p className="text-loss text-xs mb-2">{error}</p>}
          {batches === undefined ? (
            <div className="text-text-muted text-xs py-4 text-center flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> جاري تحميل الدفعات...
            </div>
          ) : availableBatches.length === 0 ? (
            <p className="text-text-muted text-xs py-2 text-center">كل الدفعات عندها بث نشط هلأ، ما في دفعة فاضية تبدأ إلها بث جديد.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {availableBatches.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2 bg-surface-2 rounded-lg px-3 py-2">
                  <span className="text-text-primary text-xs font-semibold">{b.name}</span>
                  <button
                    onClick={() => handleStart(b)}
                    disabled={starting === b.id}
                    className="bg-gold-300 text-ink font-bold rounded-md px-3 py-1 text-[11px] hover:bg-gold-200 disabled:opacity-60 inline-flex items-center gap-1"
                  >
                    {starting === b.id ? <Loader2 size={12} className="animate-spin" /> : <Radio size={12} />}
                    {starting === b.id ? "جاري البدء..." : "ابدأ بث"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LiveView({ isAdmin = false, username = "" }) {
  const [sessions, setSessions] = useState(undefined); // undefined = تحميل
  const [joining, setJoining] = useState(null); // id الجلسة يلي عم تنضم إلها
  const [error, setError] = useState("");
  const [tokenInfo, setTokenInfo] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [ending, setEnding] = useState(null); // id الجلسة يلي عم تتنهي

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

  async function handleEndSession(sess) {
    if (!confirm(`متأكد إنك بدك تنهي بث "${sess.title}"؟`)) return;
    setEnding(sess.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/live?batch_id=${sess.batch_id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "صار خطأ بإنهاء البث");
      fetchSessions();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnding(null);
    }
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

      {!tokenInfo && isAdmin && <AdminStartPanel onStarted={fetchSessions} />}

      {sessions === undefined ? (
        <div className="text-text-muted text-sm py-12 text-center flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> جاري التحقق...
        </div>
      ) : tokenInfo && activeSession ? (
        <LiveRoom session={{ ...activeSession, recording_status: activeSession.recording_status }} tokenInfo={tokenInfo} onLeave={handleLeave} />
      ) : sessions.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-line rounded-xl">
          <div className="text-3xl mb-2"><RadioTower size={14} aria-hidden /></div>
          <p className="text-text-secondary text-sm">
            {isAdmin
              ? "ما في بث نشط. اضغطي «بدء بث جديد لدفعة» فوق لتبدئي واحد من هون مباشرة."
              : "بترجعي تشوفي هون تلقائيًا لما تبدأ الأكاديمية بث مباشر لدفعتك."}
          </p>
          {isAdmin && (
            <Link href="/admin/batches" className="inline-flex items-center gap-1.5 text-gold-300 text-sm font-bold mt-3 hover:underline">
              <Users size={14} /> أو الذهاب لإدارة الدفعات
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((sess) => (
            <SessionCard
              key={sess.id}
              sess={sess}
              onJoin={handleJoin}
              joining={joining === sess.id}
              isAdmin={isAdmin}
              onEnd={handleEndSession}
              ending={ending === sess.id}
            />
          ))}
          <p className="text-text-muted text-[11px] mt-2">
            رح يفتحلك المتصفح إذن الوصول للكاميرا والمايك — فيكِ تنضمي وتتفرجي بس بدون تفعيلهم.
          </p>
        </div>
      )}
    </div>
  );
}
