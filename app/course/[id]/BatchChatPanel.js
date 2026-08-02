"use client";

import { useEffect, useRef, useState } from "react";

// المرحلة 12: دردشة دفعة الطالب لهاي الدورة — كومبوننت مستقل بيجيب بياناته لحاله،
// ما بيأثر على منطق المحاضرات أو الملفات أو الواجبات إطلاقًا.
// الرسائل بتتحدّث كل 3 ثواني تلقائيًا بدون أي تحديث للصفحة (استقصاء دوري خفيف،
// بديل بسيط وموثوق عن Realtime، ومنسجم مع باقي طريقة الموقع بجلب البيانات).
const POLL_MS = 3000;

function formatTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

export default function BatchChatPanel({ courseId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(undefined); // undefined = جاري التحميل الأول
  const [batchId, setBatchId] = useState(null);
  const [myUserId, setMyUserId] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const listRef = useRef(null);
  const knownIds = useRef(new Set());

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }

  async function load(isFirstLoad) {
    try {
      const res = await fetch(`/api/batches/chat?course_id=${courseId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;

      setBatchId(data.batch_id || null);
      setMyUserId(data.my_user_id || null);

      const incoming = data.messages || [];
      const isNew = incoming.some((m) => !knownIds.current.has(m.id));
      incoming.forEach((m) => knownIds.current.add(m.id));

      setMessages(incoming);
      if (isFirstLoad || isNew) scrollToBottom();
    } catch {
      if (isFirstLoad) setMessages([]);
    }
  }

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(false), POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    setErr("");

    const res = await fetch("/api/batches/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: courseId, message: trimmed }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);

    if (!res.ok) {
      setErr(data.error || "صار خطأ، حاولي مرة ثانية");
      return;
    }

    knownIds.current.add(data.message.id);
    setMessages((prev) => [...(prev || []), data.message]);
    setText("");
    scrollToBottom();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ما منعرض القسم قبل ما نعرف إذا الطالب أصلاً مسجّل بدفعة لهاي الدورة
  if (messages === undefined) return null;
  if (!batchId) return null;

  return (
    <div
      style={{
        background: "#111108",
        border: "1px solid #E8B86D33",
        borderRadius: 12,
        marginBottom: "1.5rem",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "none",
          border: "none",
          color: "#fff",
          padding: "0.9rem 1.1rem",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 800 }}>💬 دردشة الدفعة</span>
        <span style={{ color: "#E8B86D", fontSize: 12 }}>{open ? "إخفاء ▲" : "إظهار ▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 1.1rem 1rem" }}>
          <div
            ref={listRef}
            style={{
              maxHeight: 260,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "0.5rem 0",
            }}
          >
            {messages.length === 0 && (
              <p style={{ color: "#666", fontSize: 12.5, textAlign: "center", margin: "1rem 0" }}>
                ما في رسائل بعد، ابدئي الدردشة مع دفعتك ومدربك.
              </p>
            )}
            {messages.map((m) => {
              const mine = m.user_id === myUserId;
              const isInstructor = m.sender_role === "admin";
              return (
                <div
                  key={m.id}
                  style={{
                    background: mine ? "#E8B86D22" : "#0D0E10",
                    border: "1px solid " + (isInstructor ? "#E8B86D66" : "#26282C"),
                    borderRadius: 10,
                    padding: "0.5rem 0.75rem",
                    maxWidth: "85%",
                    alignSelf: mine ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 800,
                        color: isInstructor ? "#E8B86D" : "#9aa",
                      }}
                    >
                      {isInstructor ? `👨‍🏫 ${m.sender_name}` : m.sender_name}
                    </span>
                    <span style={{ fontSize: 10.5, color: "#666" }}>{formatTime(m.created_at)}</span>
                  </div>
                  <div style={{ color: "#eee", fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {m.message}
                  </div>
                </div>
              );
            })}
          </div>

          {err && <div style={{ color: "#f66", fontSize: 12, marginTop: 4 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتبي رسالتك..."
              rows={1}
              style={{
                flex: 1,
                background: "#0D0E10",
                border: "1px solid #E8B86D33",
                borderRadius: 8,
                color: "#eee",
                padding: "0.5rem 0.7rem",
                fontSize: 13,
                fontFamily: "inherit",
                resize: "none",
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !text.trim()}
              style={{
                background: "#E8B86D",
                color: "#111",
                border: "none",
                borderRadius: 8,
                padding: "0.5rem 1.1rem",
                fontWeight: 800,
                fontSize: 13,
                cursor: sending || !text.trim() ? "not-allowed" : "pointer",
                opacity: sending || !text.trim() ? 0.6 : 1,
              }}
            >
              إرسال
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
