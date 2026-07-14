"use client";

import { useEffect, useRef, useState } from "react";

const GOLD = "#D4AF37";

export default function LiveView({ isAdmin = false, username = "" }) {
  const [session, setSession] = useState(undefined); // undefined = جاري التحميل، null = ما في بث
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);

  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);

  async function fetchSession() {
    try {
      const res = await fetch("/api/live");
      const data = await res.json();
      if (res.ok) setSession(data.session || null);
    } catch (e) {
      // تجاهل أخطاء الشبكة العابرة بالـ polling
    }
  }

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 15000);
    return () => clearInterval(interval);
  }, []);

  // نظّفي غرفة Jitsi لو الجلسة انتهت أو المستخدم غادر
  useEffect(() => {
    if (!session && jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
      setJoined(false);
    }
  }, [session]);

  useEffect(() => {
    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, []);

  function loadJitsiScript() {
    return new Promise((resolve, reject) => {
      if (window.JitsiMeetExternalAPI) return resolve();
      const script = document.createElement("script");
      script.src = "https://meet.jit.si/external_api.js";
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("تعذّر تحميل خدمة البث"));
      document.body.appendChild(script);
    });
  }

  async function handleJoin() {
    if (!session) return;
    setError("");
    try {
      await loadJitsiScript();
      setJoined(true); // بيخلي الـ div الحاوي يترندر، وبعدين الـ useEffect تحت رح تبني غرفة Jitsi فيه
    } catch (e) {
      setError(e.message || "صار خطأ بالانضمام للبث");
    }
  }

  // نبني غرفة Jitsi بس بعد ما الـ div الحاوي (jitsiContainerRef) صار موجود فعليًا بالـ DOM
  useEffect(() => {
    if (!joined || !session || jitsiApiRef.current) return;
    if (!jitsiContainerRef.current) return;

    jitsiApiRef.current = new window.JitsiMeetExternalAPI("meet.jit.si", {
      roomName: session.room_name,
      parentNode: jitsiContainerRef.current,
      width: "100%",
      height: "100%",
      userInfo: { displayName: username || "طالب" },
      configOverwrite: {
        prejoinPageEnabled: true,
        disableDeepLinking: true,
        disableTileView: true,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        MOBILE_APP_PROMO: false,
      },
    });
  }, [joined, session, username]);

  async function handleStart() {
    setStarting(true);
    setError("");
    const res = await fetch("/api/admin/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "بث مباشر — Qais Trading Academy" }),
    });
    const data = await res.json();
    setStarting(false);
    if (!res.ok) {
      setError(data.error || "صار خطأ ببدء البث");
      return;
    }
    setSession(data.session);
  }

  async function handleEnd() {
    if (!confirm("متأكد إنك بدك تنهي البث المباشر؟")) return;
    setEnding(true);
    setError("");
    const res = await fetch("/api/admin/live", { method: "DELETE" });
    const data = await res.json();
    setEnding(false);
    if (!res.ok) {
      setError(data.error || "صار خطأ بإنهاء البث");
      return;
    }
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
    setJoined(false);
    setSession(null);
  }

  return (
    <div style={s.wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>🔴 البث المباشر</h2>
          <p style={{ margin: "6px 0 0", color: "#777", fontSize: 13 }}>
            {session ? "في بث مباشر عم يصير هلأ — انضمي وشاركي بالنقاش." : "ما في بث مباشر هلأ."}
          </p>
        </div>

        {isAdmin && (
          <div style={{ display: "flex", gap: "0.6rem" }}>
            {!session ? (
              <button onClick={handleStart} disabled={starting} style={s.startBtn}>
                {starting ? "جاري البدء..." : "🔴 ابدأ بث مباشر"}
              </button>
            ) : (
              <button onClick={handleEnd} disabled={ending} style={s.endBtn}>
                {ending ? "جاري الإنهاء..." : "⏹ إنهاء البث"}
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p style={{ color: "#ef5350", fontSize: 13, marginBottom: "0.75rem" }}>{error}</p>}

      {session === undefined ? (
        <div style={{ color: "#666", fontSize: 14, padding: "3rem 0", textAlign: "center" }}>...جاري التحقق</div>
      ) : !session ? (
        <div style={s.emptyCard}>
          <div style={{ fontSize: 36, marginBottom: "0.75rem" }}>📡</div>
          <p style={{ color: "#888", fontSize: 14, margin: 0 }}>
            {isAdmin ? 'دوسي "🔴 ابدأ بث مباشر" فوق حتى تفتحي غرفة البث للطلاب.' : "بترجع تشوفي هون تلقائيًا لما تبدأ الأكاديمية بث مباشر."}
          </p>
        </div>
      ) : !joined ? (
        <div style={s.emptyCard}>
          <div style={{ fontSize: 36, marginBottom: "0.75rem" }}>🎥</div>
          <p style={{ color: "#ccc", fontSize: 15, fontWeight: 700, margin: "0 0 0.5rem" }}>البث جاهز — دوسي انضمام</p>
          <p style={{ color: "#777", fontSize: 13, margin: "0 0 1.25rem" }}>
            رح يفتحلك متصفحك إذن الوصول للمايك والكاميرا (اختياري) — فيك تنضمي بس بالصوت أو حتى بدون مايك/كاميرا وتتفرجي وتكتبي بالشات.
          </p>
          <button onClick={handleJoin} style={s.joinBtn}>🎥 انضمام للبث</button>
        </div>
      ) : (
        <div style={{ position: "relative", width: "100%", height: "70vh", minHeight: 420, background: "#000", borderRadius: 14, overflow: "hidden", border: `1px solid ${GOLD}33` }}>
          <div ref={jitsiContainerRef} style={{ width: "100%", height: "100%" }} />
        </div>
      )}

      {session && !joined && (
        <p style={{ color: "#555", fontSize: 12, marginTop: "1rem" }}>
          💡 مشاركة الشاشة: أي طالب فيه يشاركها من شريط الأدوات، بس كمضيفة فيكي توقفي مشاركة أي حدا مباشرة من قائمة المشاركين جوا البث.
        </p>
      )}
    </div>
  );
}

const s = {
  wrap: { background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 16, padding: "1.5rem" },
  startBtn: { backgroundColor: "#F6465D", color: "#fff", border: "none", padding: "0.65rem 1.3rem", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 },
  endBtn: { backgroundColor: "#181A20", color: "#F6465D", border: "1px solid #F6465D55", padding: "0.65rem 1.3rem", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 },
  joinBtn: { backgroundColor: GOLD, color: "#000", border: "none", padding: "0.75rem 1.6rem", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 800 },
  emptyCard: { textAlign: "center", padding: "3.5rem 1.5rem", border: "1px dashed #222", borderRadius: 12 },
};
