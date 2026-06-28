"use client";
import { useState } from "react";

export default function PaymentPage() {
  const [loading, setLoading] = useState(null);

  async function handlePayment(type) {
    setLoading(type);
    const res = await fetch("/api/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setLoading(null);
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

      <div style={styles.grid}>
        {/* بطاقة التسجيل */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardIcon}>🏆</span>
            <h2 style={styles.cardTitle}>رسوم التسجيل</h2>
            <p style={styles.cardDesc}>دفعة واحدة للانضمام</p>
          </div>
          <div style={styles.priceBox}>
            <span style={styles.currency}>$</span>
            <span style={styles.amount}>300</span>
            <span style={styles.period}>مرة واحدة</span>
          </div>
          <ul style={styles.features}>
            <li style={styles.feature}><span style={styles.check}>◆</span> انضمام فوري للأكاديمية</li>
            <li style={styles.feature}><span style={styles.check}>◆</span> وصول لجميع المحاضرات</li>
            <li style={styles.feature}><span style={styles.check}>◆</span> عضوية Discord الحصرية</li>
            <li style={styles.feature}><span style={styles.check}>◆</span> دعم مباشر من المدرب</li>
          </ul>
          <button
            style={styles.btn}
            onClick={() => handlePayment("registration")}
            disabled={loading === "registration"}
          >
            {loading === "registration" ? "جاري التحويل..." : "ادفع رسوم التسجيل"}
          </button>
        </div>

        {/* بطاقة الاشتراك */}
        <div style={{ ...styles.card, ...styles.featuredCard }}>
          <div style={styles.featuredBadge}>الأكثر شيوعاً</div>
          <div style={styles.cardHeader}>
            <span style={styles.cardIcon}>👑</span>
            <h2 style={styles.cardTitle}>الاشتراك الشهري</h2>
            <p style={styles.cardDesc}>للاستمرار بعد التسجيل</p>
          </div>
          <div style={styles.priceBox}>
            <span style={styles.currency}>$</span>
            <span style={styles.amount}>100</span>
            <span style={styles.period}>/شهرياً</span>
          </div>
          <ul style={styles.features}>
            <li style={styles.feature}><span style={styles.check}>◆</span> وصول كامل ومستمر</li>
            <li style={styles.feature}><span style={styles.check}>◆</span> محتوى جديد شهرياً</li>
            <li style={styles.feature}><span style={styles.check}>◆</span> تحليلات حصرية</li>
            <li style={styles.feature}><span style={styles.check}>◆</span> إلغاء في أي وقت</li>
          </ul>
          <button
            style={{ ...styles.btn, ...styles.featuredBtn }}
            onClick={() => handlePayment("subscription")}
            disabled={loading === "subscription"}
          >
            {loading === "subscription" ? "جاري التحويل..." : "اشترك الآن"}
          </button>
        </div>
      </div>

      <p style={styles.footer}>
        🔒 جميع المدفوعات مؤمنة عبر Stripe
      </p>
    </div>
  );
}

const gold = "#D4AF37";
const darkGold = "#B8960C";
const black = "#0a0a0a";
const cardBg = "#0f0f0f";

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: black,
    color: "#fff",
    direction: "rtl",
    fontFamily: "'Georgia', serif",
    padding: "3rem 2rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  header: { textAlign: "center", marginBottom: "3rem" },
  logoText: {
    fontSize: "3rem",
    fontWeight: "bold",
    color: gold,
    letterSpacing: "8px",
    textShadow: `0 0 30px ${gold}44`,
  },
  logoSub: {
    color: "#888",
    letterSpacing: "4px",
    fontSize: "0.75rem",
    marginTop: "-0.5rem",
    marginBottom: "1.5rem",
  },
  divider: {
    width: "80px",
    height: "2px",
    backgroundColor: gold,
    margin: "0 auto 1.5rem",
  },
  title: { fontSize: "2rem", fontWeight: "bold", marginBottom: "0.5rem", color: "#fff" },
  subtitle: { color: "#666", fontSize: "1rem" },
  grid: {
    display: "flex",
    gap: "2rem",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: "2rem",
  },
  card: {
    backgroundColor: cardBg,
    border: `1px solid #222`,
    borderRadius: "4px",
    padding: "2.5rem",
    width: "300px",
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    position: "relative",
  },
  featuredCard: {
    border: `1px solid ${gold}`,
    boxShadow: `0 0 40px ${gold}22`,
  },
  featuredBadge: {
    position: "absolute",
    top: "-14px",
    right: "50%",
    transform: "translateX(50%)",
    backgroundColor: gold,
    color: "#000",
    padding: "0.25rem 1rem",
    fontSize: "0.75rem",
    fontWeight: "bold",
    letterSpacing: "1px",
  },
  cardHeader: { textAlign: "center" },
  cardIcon: { fontSize: "2rem" },
  cardTitle: { fontSize: "1.4rem", fontWeight: "bold", color: "#fff", margin: "0.5rem 0 0.25rem" },
  cardDesc: { color: "#555", fontSize: "0.85rem" },
  priceBox: {
    textAlign: "center",
    borderTop: "1px solid #1a1a1a",
    borderBottom: "1px solid #1a1a1a",
    padding: "1.5rem 0",
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: "0.25rem",
  },
  currency: { color: gold, fontSize: "1.2rem" },
  amount: { color: gold, fontSize: "3rem", fontWeight: "bold", lineHeight: 1 },
  period: { color: "#555", fontSize: "0.85rem" },
  features: { listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" },
  feature: { color: "#888", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.5rem" },
  check: { color: gold, fontSize: "0.6rem" },
  btn: {
    padding: "0.875rem",
    borderRadius: "2px",
    border: `1px solid ${gold}`,
    backgroundColor: "transparent",
    color: gold,
    fontSize: "0.9rem",
    fontWeight: "bold",
    cursor: "pointer",
    letterSpacing: "1px",
    transition: "all 0.2s",
    marginTop: "auto",
  },
  featuredBtn: {
    backgroundColor: gold,
    color: "#000",
  },
footer: { color: "#333", fontSize: "0.8rem", marginTop: "1rem" },
};
