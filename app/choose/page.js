"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export default function ChoosePage() {
  const [logoY, setLogoY] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let frame;
    let start = null;
    const animate = (ts) => {
      if (!start) start = ts;
      setLogoY(Math.sin((ts - start) / 1000) * 8);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Orbs */}
      <div style={{ ...s.orb, width: "500px", height: "500px", top: "-150px", left: "-150px", background: "radial-gradient(circle, #B8915A18 0%, transparent 70%)" }} />
      <div style={{ ...s.orb, width: "400px", height: "400px", bottom: "-100px", right: "-100px", background: "radial-gradient(circle, #C9A24B14 0%, transparent 70%)" }} />

      {/* Header */}
      <header style={s.header}>
        <div style={s.logoBlock}>
          <img src="/logo.jpg" alt="QTA" style={s.logoImg} />
          <span style={s.logoText}>Qais Trading Academy</span>
        </div>
        <button onClick={handleLogout} style={s.logoutBtn}>تسجيل الخروج</button>
      </header>

      {/* Content */}
      <div style={s.content}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
          <img
            src="/logo.jpg"
            alt="QTA"
            style={{ ...s.heroLogo, transform: `translateY(${logoY}px)` }}
          />
        </div>

        <p style={s.eyebrow}>QAIS TRADING ACADEMY</p>
        <h1 style={s.title}>اختر وجهتك</h1>
        <p style={s.sub}>من أين تبدأ جلستك اليوم؟</p>

        <div style={s.cards}>
          {/* المحاضرات */}
          <div style={s.card} onClick={() => router.push("/dashboard")}>
            <div style={s.cardIcon}>🎓</div>
            <h2 style={s.cardTitle}>المحاضرات</h2>
            <p style={s.cardDesc}>
              وصول كامل لمكتبة المحاضرات المسجلة، الكورسات المرتبة، والاختبارات.
            </p>
            <div style={s.cardBtn}>ابدأ التعلم ←</div>
          </div>

          {/* Backtest */}
          <div style={s.card} onClick={() => router.push("/backtest")("https://qaisalraifai.github.io/backtest-qta/", "_blank")}>
            <div style={s.cardIcon}>📊</div>
            <h2 style={s.cardTitle}>Backtest</h2>
            <p style={s.cardDesc}>
              اختبر استراتيجياتك على بيانات تاريخية حقيقية وقِس أداءك بدقة.
            </p>
            <div style={s.cardBtn}>افتح البرنامج ←</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const gold = "#C9A24B";
const s = {
  page: { backgroundColor: "#050505", minHeight: "100vh", direction: "rtl", fontFamily: "'Inter', sans-serif", color: "#E8E0D0", overflowX: "hidden", position: "relative" },
  orb: { position: "fixed", borderRadius: "50%", pointerEvents: "none", filter: "blur(80px)", zIndex: 0 },

  header: { position: "relative", zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.5rem 3rem", borderBottom: "1px solid #141414" },
  logoBlock: { display: "flex", alignItems: "center", gap: "0.75rem" },
  logoImg: { height: "34px", borderRadius: "4px" },
  logoText: { fontSize: "0.95rem", fontWeight: 500, color: "#E8E0D0" },
  logoutBtn: { background: "none", border: "1px solid #222", color: "#555", padding: "0.5rem 1.2rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" },

  content: { position: "relative", zIndex: 1, maxWidth: "800px", margin: "0 auto", padding: "4rem 2rem", textAlign: "center" },
  heroLogo: { width: "90px", height: "90px", objectFit: "cover", borderRadius: "50%", border: `2px solid ${gold}44`, boxShadow: `0 0 40px ${gold}33`, transition: "transform 0.1s ease-out" },
  eyebrow: { fontFamily: "'JetBrains Mono', monospace", color: gold, fontSize: "0.72rem", letterSpacing: "3px", marginBottom: "1rem" },
  title: { fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 900, lineHeight: 1.2, marginBottom: "0.75rem", letterSpacing: "-0.5px" },
  sub: { color: "#555", fontSize: "1rem", marginBottom: "3rem" },

  cards: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" },
  card: {
    backgroundColor: "#0d0d0d",
    border: "1px solid #1a1a1a",
    borderRadius: "8px",
    padding: "2.5rem 2rem",
    cursor: "pointer",
    textAlign: "right",
    transition: "border-color 0.3s, box-shadow 0.3s",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  cardIcon: { fontSize: "2.5rem" },
  cardTitle: { fontSize: "1.4rem", fontWeight: 800, color: "#E8E0D0" },
  cardDesc: { color: "#555", fontSize: "0.9rem", lineHeight: 1.75, flex: 1 },
  cardBtn: { color: gold, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.82rem", letterSpacing: "1px", marginTop: "0.5rem" },
};
