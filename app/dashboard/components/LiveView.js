"use client";

import { useEffect, useRef, useState } from "react";

const GOLD = "#D4AF37";

// 🚧 اللايف موقوف مؤقتًا لحين ما نجهز بنية تحتية جديدة (بدون قيود مدة).
// لإعادة تفعيله لاحقًا: خليها false.
const LIVE_COMING_SOON = true;

function ComingSoonCard() {
  return (
    <div style={s.wrap}>
      <div style={{ ...s.emptyCard, padding: "4rem 1.5rem" }}>
        <div style={{ fontSize: 42, marginBottom: "1rem" }}>🚧</div>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: 20, fontWeight: 800, color: "#fff" }}>
          البث المباشر — قريبًا
        </h2>
        <p style={{ color: "#888", fontSize: 14, margin: 0 }}>
          عم نشتغل على تطوير خاصية البث المباشر حاليًا، وح تكون متاحة قريبًا بإذن الله. تابعونا!
        </p>
      </div>
    </div>
  );
}

// المرحلة 7: صار في احتمال أكثر من بث نشط بنفس الوقت (كل بث تابع لدفعة مختلفة)،
// فهاد الكومبوننت يعرض قائمة البثوث اللي يحق للمستخدم يشوفها (دفعاته فقط، أو كل الدفعات لو أدمن)
// ويخليه يختار أي وحدة ينضم إلها. بدء/إنهاء البث صار من صفحة "إدارة الدفعات" مو من هون.
function LiveViewActual({ isAdmin = false, username = "" }) {
  const [sessions, setSessions] = useState(undefined); // undefined = جاري التحميل
  const [error, setError] = useState("");
  const [activeSession, setActiveSession] = useState(null); // الجلسة اللي منضمين إلها هلأ

  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);

  async function fetchSessions() {
    try {
      const res = await fetch("/api/live");
      const data = await res.json();
      if (res.ok) setSessions(data.sessions || []);
    } catch (e) {
      // تجاهل أخطاء الشبكة العابرة بالـ polling
    }
  }

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 15000);
    return () => clearInterval(interval);
  }, []);

  // لو الجلسة اللي منضمين إلها انتهت (ما عادت موجودة بقائمة البثوث النشطة)، سكّري غرفة Jitsi
  useEffect(() => {
    if (!activeSession || !sessions) return;
    const stillActive = sessions.some((s) => s.id === activeSession.id);
    if (!stillActive) {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
      setActiveSession(null);
    }
  }, [sessions, activeSession]);

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

  async function handleJoin(session) {
    setError("");
    try {
      await loadJitsiScript();
      setActiveSession(session); // بيخلي الـ div الحاوي يترندر، وبعدين الـ useEffect تحت رح تبني غرفة Jitsi فيه
    } catch (e) {
      setError(e.message || "صار خطأ بالانضمام للبث");
    }
  }

  function handleLeave() {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
    if (activeSession) {
      fetch("/api/live/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: activeSession.id, event: "leave" }),
      }).catch(() => {});
    }
    setActiveSession(null);
  }

  // نبني غرفة Jitsi بس بعد ما الـ div الحاوي (jitsiContainerRef) صار موجود فعليًا بالـ DOM
  useEffect(() => {
    if (!activeSession || jitsiApiRef.current) return;
    if (!jitsiContainerRef.current) return;

    const api = new window.JitsiMeetExternalAPI("meet.jit.si", {
      roomName: activeSession.room_name,
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
    jitsiApiRef.current = api;

    // المرحلة 8: نسجّل الحضور فعليًا بس لما الطالب يدخل قاعة البث (بعد شاشة الـ prejoin)،
    // مو مجرد ما دوس "انضمام" — هيك الرقم دقيق وما يشمل حدا فتح الشاشة وطلع بدون ما يدخل فعليًا
    function recordAttendance(event) {
      fetch("/api/live/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: activeSession.id, event }),
      }).catch(() => {});
    }
    api.addEventListener("videoConferenceJoined", () => recordAttendance("join"));
    api.addEventListener("videoConferenceLeft", () => recordAttendance("leave"));
  }, [activeSession, username]);

  function sessionLabel(session) {
    if (session.course_title && session.batch_name) {
      return `${session.course_icon ? session.course_icon + " " : ""}${session.course_title} — ${session.batch_name}`;
    }
    return session.title || "بث مباشر";
  }

  return (
    <div style={s.wrap}>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>🔴 البث المباشر</h2>
        <p style={{ margin: "6px 0 0", color: "#777", fontSize: 13 }}>
          {isAdmin
            ? "بدء وإنهاء البث صار من صفحة \"إدارة الدفعات\" — من هون بس بتنضمي للبثوث النشطة."
            : sessions && sessions.length > 0
            ? "في بث مباشر عم يصير هلأ بدفعتك — انضمي وشاركي بالنقاش."
            : "ما في بث مباشر هلأ بأي دفعة مسجّلة فيها."}
        </p>
      </div>

      {error && <p style={{ color: "#ef5350", fontSize: 13, marginBottom: "0.75rem" }}>{error}</p>}

      {sessions === undefined ? (
        <div style={{ color: "#666", fontSize: 14, padding: "3rem 0", textAlign: "center" }}>...جاري التحقق</div>
      ) : activeSession ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ color: "#ccc", fontSize: 13, fontWeight: 700 }}>{sessionLabel(activeSession)}</span>
            <button onClick={handleLeave} style={s.leaveBtn}>مغادرة</button>
          </div>
          <div style={{ position: "relative", width: "100%", height: "70vh", minHeight: 420, background: "#000", borderRadius: 14, overflow: "hidden", border: `1px solid ${GOLD}33` }}>
            <div ref={jitsiContainerRef} style={{ width: "100%", height: "100%" }} />
          </div>
          <p style={{ color: "#555", fontSize: 12, marginTop: "1rem" }}>
            💡 مشاركة الشاشة: أي طالب فيه يشاركها من شريط الأدوات، بس كمضيفة فيكي توقفي مشاركة أي حدا مباشرة من قائمة المشاركين جوا البث.
          </p>
        </>
      ) : sessions.length === 0 ? (
        <div style={s.emptyCard}>
          <div style={{ fontSize: 36, marginBottom: "0.75rem" }}>📡</div>
          <p style={{ color: "#888", fontSize: 14, margin: 0 }}>
            {isAdmin
              ? 'ما في بث نشط حاليًا. ابدئي بث لأي دفعة من صفحة "إدارة الدفعات".'
              : "بترجعي تشوفي هون تلقائيًا لما تبدأ الأكاديمية بث مباشر بدفعتك."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {sessions.map((session) => (
            <div key={session.id} style={s.sessionRow}>
              <div>
                <p style={{ margin: 0, color: "#ccc", fontSize: 14, fontWeight: 700 }}>{sessionLabel(session)}</p>
                <p style={{ margin: "2px 0 0", color: "#666", fontSize: 12 }}>بث مباشر الآن</p>
              </div>
              <button onClick={() => handleJoin(session)} style={s.joinBtn}>🎥 انضمام</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LiveView(props) {
  if (LIVE_COMING_SOON) return <ComingSoonCard />;
  return <LiveViewActual {...props} />;
}

const s = {
  wrap: { background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 16, padding: "1.5rem" },
  joinBtn: { backgroundColor: GOLD, color: "#000", border: "none", padding: "0.6rem 1.2rem", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" },
  leaveBtn: { backgroundColor: "#181A20", color: "#F6465D", border: "1px solid #F6465D55", padding: "0.5rem 1rem", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 },
  emptyCard: { textAlign: "center", padding: "3.5rem 1.5rem", border: "1px dashed #222", borderRadius: 12 },
  sessionRow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#141414", border: "1px solid #222", borderRadius: 10, padding: "0.9rem 1.1rem" },
};
