"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export default function PaymentSuccessPage() {
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
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
          <img
            src="/logo.jpg"
            alt="QTA"
            style={{ ...s.heroLogo, transform: `translateY(${logoY}px)` }}
          />
        </div>

        <p style={s.eyebrow}>QAIS TRADING ACADEMY</p>
        <h1 style={s.title}>🎉 مرحباً بك في الأكاديمية!</h1>
        <p style={s.sub}>تم تفعيل اشتراكك بنجاح — اختر من أين تبدأ</p>

        {/* Cards */}
        <div style={s.cards}>
          {/* المحاضرات */}
          <div style={s.card} onClick={() => router.push("/dashboard")}>
            <div style={s.cardIconWrap}>
              <span style={s.cardIcon}>🎓</span>
            </div>
            <h2 style={s.cardTitle}>المحاضرات</h2>
            <p style={s.cardDesc}>
              وصول كامل لمكتبة المحاضرات المسجلة، الكورسات المرتبة، والاختبارات التفاعلية.
            </p>
            <ul style={s.cardFeatures}>
              <li><span style={s.dot}>◆</span> محاضرات لايف أسبوعية</li>
              <li><span style={s.dot}>◆</span> مكتبة محاضرات مسجلة</li>
              <li><span style={s.dot}>◆</span> اختبارات لقياس التقدم</li>
            </ul>
            <div style={s.cardBtn}>ابدأ التعلم ←</div>
          </div>

          {/* Backtest */}
          <div style={s.card} onClick={() => window.open("https://qaisalraifai.github.io/backtest-qta/", "_blank")}>
            <div style={s.cardIconWrap}>
              <span style={s.cardIcon}>📊</span>
            </div>
            <h2 style={s.cardTitle}>برنامج Backtest</h2>
            <p style={s.cardDesc}>
              اختبر استراتيجياتك على بيانات تاريخية حقيقية وقِس أداءك بدقة احترافية.
            </p>
            <ul style={s.cardFeatures}>
              <li><span style={s.dot}>◆</span> بيانات تاريخية حقيقية</li>
              <li><span style={s.dot}>◆</span> قياس دقيق للأداء</li>
              <li><span style={s.dot}>◆</span> تطوير الاستراتيجيات</li>
            </ul>
            <div style={s.cardBtn}>افتح البرنامج ←</div>
          </div>
        </div>

        {/* Stats */}
        <div style={s.stats}>
          {[
            { num: "6", label: "أشهر تدريب ديمو" },
            { num: "4", label: "منهجيات تحليل" },
            { num: "∞", label: "Backtest مستمر" },
          ].map((s2, i) => (
            <div key={i} style={s.statItem}>
              <span style={s.statNum}>{s2.num}</span>
              <span style={s.statLabel}>{s2.label}</span>
            </div>
          ))}
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

  content: { position: "relative", zIndex: 1, maxWidth: "900px", margin: "0 auto", padding: "4rem 2rem", textAlign: "center" },
  heroLogo: { width: "90px", height: "90px", objectFit: "cover", borderRadius: "50%", border: `2px solid ${gold}44`, boxShadow: `0 0 40px ${gold}33`, transition: "transform 0.1s ease-out" },
  eyebrow: { fontFamily: "'JetBrains Mono', monospace", color: gold, fontSize: "0.72rem", letterSpacing: "3px", marginBottom: "1rem" },
  title: { fontSize: "clamp(1.8rem, 4vw, 2.5rem)", fontWeight: 900, lineHeight: 1.2, marginBottom: "0.75rem" },
  sub: { color: "#555", fontSize: "1rem", marginBottom: "3rem" },

  cards: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "3rem" },
  card: { backgroundColor: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "2.5rem 2rem", cursor: "pointer", textAlign: "right", display: "flex", flexDirection: "column", gap: "1rem", transition: "border-color 0.3s" },
  cardIconWrap: { width: "56px", height: "56px", backgroundColor: "#141414", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${gold}22` },
  cardIcon: { fontSize: "1.75rem" },
  cardTitle: { fontSize: "1.4rem", fontWeight: 800, color: "#E8E0D0" },
  cardDesc: { color: "#555", fontSize: "0.9rem", lineHeight: 1.75 },
  cardFeatures: { listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" },
  dot: { color: gold, fontSize: "0.5rem", marginLeft: "0.5rem" },
  cardBtn: { color: gold, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.82rem", letterSpacing: "1px", marginTop: "auto", paddingTop: "1rem", borderTop: "1px solid #1a1a1a" },

  stats: { display: "flex", justifyContent: "center", gap: "3rem", padding: "2rem 0", borderTop: "1px solid #111" },
  statItem: { display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "center" },
  statNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: "2rem", color: gold, fontWeight: 500 },
  statLabel: { color: "#444", fontSize: "0.75rem" },
};
