"use client";

import { useState } from "react";

export default function DiscordSection({ discordUsername }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/discord/invite", { method: "POST" });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "صار خطأ، حاولي مرة تانية");
      return;
    }
    window.open(data.url, "_blank");
  }

  if (!discordUsername) {
    return (
      <div style={s.box}>
        <div style={s.icon}>💬</div>
        <div style={{ flex: 1 }}>
          <div style={s.title}>مجتمع Discord</div>
          <div style={s.desc}>اربطي حساب Discord تبعك حتى تقدري تنضمي لسيرفر الأكاديمية</div>
        </div>
        <a href="/api/auth/discord/start" style={s.btnLink}>
          ربط حساب Discord
        </a>
      </div>
    );
  }

  return (
    <div style={s.box}>
      <div style={s.icon}>✅</div>
      <div style={{ flex: 1 }}>
        <div style={s.title}>مجتمع Discord</div>
        <div style={s.desc}>حسابك مربوط: <strong style={{ color: "#fff" }}>{discordUsername}</strong></div>
        {error && <div style={s.error}>{error}</div>}
      </div>
      <button onClick={handleJoin} disabled={loading} style={s.btn}>
        {loading ? "جاري إنشاء الدعوة..." : "انضمي للسيرفر"}
      </button>
    </div>
  );
}

const s = {
  box: {
    backgroundColor: "#111726",
    border: "1px solid #1B2438",
    borderRadius: "0px",
    padding: "1.25rem 1.5rem",
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  icon: { fontSize: "1.6rem" },
  title: { fontWeight: "bold", marginBottom: "0.25rem" },
  desc: { color: "#5D6880", fontSize: "0.85rem" },
  error: { color: "#E8495F", fontSize: "0.8rem", marginTop: "0.35rem" },
  btn: {
    padding: "0.65rem 1.25rem",
    backgroundColor: "#5865F2",
    color: "#fff",
    border: "none",
    borderRadius: "3px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "0.85rem",
    whiteSpace: "nowrap",
  },
  btnLink: {
    padding: "0.65rem 1.25rem",
    backgroundColor: "#5865F2",
    color: "#fff",
    borderRadius: "3px",
    textDecoration: "none",
    fontWeight: "bold",
    fontSize: "0.85rem",
    whiteSpace: "nowrap",
  },
};
