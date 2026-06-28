"use client";
import { useState } from "react";
import Link from "next/link";

export default function PaymentPage() {
  const [loading, setLoading] = useState(false);

  async function handlePayment() {
    setLoading(true);
    const res = await fetch("/api/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "registration" }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setLoading(false);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.logoText}>QTA</div>
        <p style={styles.logoSub}>QAIS TRADING ACADEMY</p>
        <div style={styles.divider} />
        <h1 style={styles.title}>انضم للأكاديمية</h1>
        <p style={styles.subtitle}>استثمر في نفسك وابدأ رحلتك في عالم التداول</p>
      </div>

      <div style={styles.card}>
        <div style={styles.cardIcon}>👑</div>
        <h2 style={styles.cardTitle}>عضوية Qais Trading Academy</h2>
        <div style={styles.priceBox}>
          <span style={styles.currency}>$</span>
          <span style={styles.amount}>300</span>
          <span style={styles.period}>دفعة التسجيل</span>
        </div>
        <ul style={styles.features}>
          <li style={styles.feature}><span style={styles.check}>◆</span> وصول فوري لجميع المحاضرات</li>
          <li style={styles.feature}><span style={styles.check}>◆</span> عضوية Discord الحصرية</li>
          <li style={styles.feature}><span style={styles.check}>◆</span> دعم مباشر من المدرب</li>
          <li style={styles.feature}><span style={styles.check}>◆</span> تحليلات وتوصيات حصرية</li>
        </ul>
        <button style={styles.btn} onClick={handlePayment} disabled={loading}>
          {loading ? "جاري التحويل..." : "ادفع $300 والانضم الآن"}
        </button>
        <p style={styles.note}>
          * التجديد الشهري بعد انتهاء الفترة الأولى: <strong style={{ color: "#D4AF37" }}>$100 / شهرياً</strong>
        </p>
      </div>

      <p style={styles.footer}>🔒 جميع المدفوعات مؤمنة عبر Stripe</p>

      {/* رابط الأدمن المخفي */}
      <Link href="/admin" style={styles.adminLink}>⚙</Link>
    </div>
  );
}

const gold = "#D4AF37";

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0a0a0a",
    color: "#fff",
    direction: "rtl",
    fontFamily: "'Georgia', serif",
    padding: "3rem 2rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  header: { textAlign: "center", marginBottom: "3rem" },
  logoText: { fontSize: "3rem", fontWeight: "bold", color: gold, letterSpacing: "8px", textShadow: `0 0 30px ${gold}44` },
  logoSub: { color: "#888", letterSpacing: "4px", fontSize: "0.75rem", marginTop: "-0.5rem", marginBottom: "1.5rem" },
  divider: { width: "80px", height: "2px", backgroundColor: gold, margin: "0 auto 1.5rem" },
  title: { fontSize: "2rem", fontWeight: "bold", marginBottom: "0.5rem" },
  subtitle: { color: "#666", fontSize: "1rem" },
  card: {
    backgroundColor: "#0f0f0f",
    border: `1px solid ${gold}`,
    borderRadius: "4px",
    padding: "3rem",
    width: "100%",
    maxWidth: "420px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.5rem",
    boxShadow: `0 0 60px ${gold}22`,
  },
  cardIcon: { fontSize: "3rem" },
  cardTitle: { fontSize: "1.4rem", fontWeight: "bold", textAlign: "center", color: "#fff" },
  priceBox: {
    textAlign: "center",
    borderTop: "1px solid #1a1a1a",
    borderBottom: "1px solid #1a1a1a",
    padding: "1.5rem 0",
    width: "100%",
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: "0.25rem",
  },
  currency: { color: gold, fontSize: "1.5rem" },
  amount: { color: gold, fontSize: "4rem", fontWeight: "bold", lineHeight: 1 },
  period: { color: "#555", fontSize: "0.85rem" },
  features: { listStyle: "none", padding: 0, width: "100%", display: "flex", flexDirection: "column", gap: "0.75rem" },
  feature: { color: "#888", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.5rem" },
  check: { color: gold, fontSize: "0.6rem" },
  btn: {
    width: "100%",
    padding: "1rem",
    borderRadius: "2px",
    border: "none",
    backgroundColor: gold,
    color: "#000",
    fontSize: "1rem",
    fontWeight: "bold",
    cursor: "pointer",
    letterSpacing: "1px",
  },
  note: { color: "#555", fontSize: "0.8rem", textAlign: "center", lineHeight: 1.6 },
  footer: { color: "#333", fontSize: "0.8rem", marginTop: "1.5rem" },
  adminLink: {
    position: "fixed",
    bottom: "1rem",
    left: "1rem",
    color: "#1a1a1a",
    fontSize: "1rem",
    textDecoration: "none",
    opacity: 0.3,
    transition: "opacity 0.3s",
  },
};
