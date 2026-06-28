"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function Reveal({ children, delay = 0, style }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0px)" : "translateY(28px)",
        transition: `opacity 0.8s ease ${delay}s, transform 0.8s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

export default function HomePage() {
  return (
    <div style={styles.page}>
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logoBlock}>
          <img src="/logo.jpg" alt="QTA" style={styles.logoImg} />
          <span style={styles.logoText}>Qais Trading Academy</span>
        </div>
        <nav style={styles.navLinks}>
          <Link href="/login" style={styles.navLink}>تسجيل الدخول</Link>
          <Link href="/payment" style={styles.navCta}>اشترك الآن</Link>
        </nav>
      </header>

      {/* Hero */}
      <section style={styles.hero}>
        <div style={styles.heroText}>
          <Reveal delay={0}>
            <img src="/logo.jpg" alt="Qais Trading Academy" style={styles.heroLogo} />
          </Reveal>
          <Reveal delay={0.05}>
            <p style={styles.heroTag}>أكاديمية تداول متكاملة</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 style={styles.heroTitle}>
              السوق يكافئ<br />من يفهمه،<br /><span style={styles.heroTitleAccent}>لا من يخمّنه</span>
            </h1>
          </Reveal>
          <Reveal delay={0.25}>
            <p style={styles.heroSubtitle}>
              منهج تداول كامل من الأساسيات حتى الاحترافية — محاضرات لايف ومسجلة،
              وتدريب عملي مستمر على حساب ديمو لمدة 6 أشهر مع Backtest حقيقي لكل استراتيجية.
            </p>
          </Reveal>
          <Reveal delay={0.4}>
            <Link href="/payment" style={styles.heroBtn}>ابدأ رحلتك الآن</Link>
          </Reveal>

          <Reveal delay={0.55}>
            <div style={styles.statsRow}>
              <div style={styles.statItem}>
                <span style={styles.statNum}>6</span>
                <span style={styles.statLabel}>أشهر تدريب ديمو</span>
              </div>
              <div style={styles.statDivider} />
              <div style={styles.statItem}>
                <span style={styles.statNum}>4</span>
                <span style={styles.statLabel}>مجالات تحليل أساسية</span>
              </div>
              <div style={styles.statDivider} />
              <div style={styles.statItem}>
                <span style={styles.statNum}>∞</span>
                <span style={styles.statLabel}>Backtest مستمر</span>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Candlestick chart */}
        <Reveal delay={0.2} style={styles.heroChart}>
          <svg viewBox="0 0 360 420" style={{ width: "100%", height: "100%" }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <line key={i} x1="0" y1={80 * i + 20} x2="360" y2={80 * i + 20} stroke="#1c1a16" strokeWidth="1" />
            ))}
            <polyline
              points="20,360 60,330 100,310 140,260 180,230 220,190 260,150 300,110 340,70"
              fill="none"
              stroke="#7C8F7A"
              strokeWidth="1.5"
              strokeDasharray="2 4"
              opacity="0.6"
            />
            {[
              { x: 20, top: 340, bottom: 380, wickTop: 320, wickBottom: 395, up: false },
              { x: 60, top: 310, bottom: 350, wickTop: 295, wickBottom: 360, up: true },
              { x: 100, top: 290, bottom: 330, wickTop: 270, wickBottom: 340, up: true },
              { x: 140, top: 245, bottom: 285, wickTop: 225, wickBottom: 295, up: true },
              { x: 180, top: 210, bottom: 250, wickTop: 195, wickBottom: 260, up: false },
              { x: 220, top: 170, bottom: 215, wickTop: 155, wickBottom: 225, up: true },
              { x: 260, top: 130, bottom: 175, wickTop: 115, wickBottom: 185, up: true },
              { x: 300, top: 90, bottom: 135, wickTop: 75, wickBottom: 145, up: true },
              { x: 340, top: 55, bottom: 95, wickTop: 40, wickBottom: 105, up: true },
            ].map((c, i) => (
              <g key={i}>
                <line x1={c.x} y1={c.wickTop} x2={c.x} y2={c.wickBottom} stroke={c.up ? "#8FA888" : "#8A6A4A"} strokeWidth="1.5" />
                <rect
                  x={c.x - 7}
                  y={c.top}
                  width="14"
                  height={c.bottom - c.top}
                  fill={c.up ? "#3B6B47" : "#6B4A30"}
                  stroke={c.up ? "#7C9F7A" : "#B8915A"}
                  strokeWidth="1"
                />
              </g>
            ))}
          </svg>
        </Reveal>
      </section>

      {/* Curriculum */}
      <section style={styles.section}>
        <Reveal>
          <p style={styles.sectionEyebrow}>وحدات المنهج</p>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 style={styles.sectionTitle}>ست ركائز تبني متداولاً كاملاً</h2>
        </Reveal>

        <div style={styles.grid}>
          {[
            { code: "FND", title: "أساسيات التداول", desc: "فهم الأسواق، أنواع الأدوات المالية، وإدارة رأس المال من الصفر." },
            { code: "FUN", title: "التحليل الأساسي", desc: "قراءة الأخبار الاقتصادية والمؤشرات وتأثيرها المباشر على حركة السعر." },
            { code: "ICT", title: "ICT", desc: "مفاهيم Inner Circle Trader لفهم سلوك السيولة وأثر المؤسسات الكبرى." },
            { code: "SK", title: "SK", desc: "منهجية SK المشتقة من التحليل الموجي (Elliott Wave) لقراءة دورات السعر وتوقع نقاط الانعكاس." },
            { code: "DEMO", title: "تدريب 6 أشهر ديمو", desc: "تطبيق عملي يومي على حساب تجريبي لصقل المهارة قبل رأس المال الحقيقي." },
            { code: "BT", title: "Backtest مستمر", desc: "اختبار كل استراتيجية على بيانات تاريخية فعلية لقياس جدواها وتطويرها." },
          ].map((item, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div style={styles.card}>
                <span style={styles.cardCode}>{item.code}</span>
                <h3 style={styles.cardTitle}>{item.title}</h3>
                <p style={styles.cardDesc}>{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Lectures */}
      <section style={styles.lecturesSection}>
        <div style={styles.lecturesInner}>
          <Reveal>
            <div>
              <p style={styles.sectionEyebrow}>طريقة التعلّم</p>
              <h2 style={{ ...styles.sectionTitle, textAlign: "right" }}>محاضرات لايف ومسجلة، منظمة بالكامل</h2>
              <p style={styles.lecturesDesc}>
                يصلك المحتوى مباشرة عبر مجتمع Discord الخاص بالأكاديمية — محاضرات حية تفاعلية
                أسبوعية، بالإضافة لمكتبة كاملة من المحاضرات المسجلة المرتبة حسب التسلسل التعليمي.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <ul style={styles.featureList}>
              <li style={styles.featureItem}><span style={styles.featureMark}>—</span> محاضرات لايف أسبوعية</li>
              <li style={styles.featureItem}><span style={styles.featureMark}>—</span> مكتبة محاضرات مسجلة منظمة</li>
              <li style={styles.featureItem}><span style={styles.featureMark}>—</span> اختبارات لقياس التقدم</li>
              <li style={styles.featureItem}><span style={styles.featureMark}>—</span> دعم مباشر من المدرب داخل Discord</li>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Pricing CTA */}
      <section style={styles.pricingSection}>
        <Reveal>
          <h2 style={styles.sectionTitle}>جاهز تبدأ؟</h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p style={styles.sectionSubtitle}>انضم الآن وابدأ رحلتك في عالم التداول الاحترافي</p>
        </Reveal>
        <Reveal delay={0.3}>
          <Link href="/payment" style={styles.heroBtn}>عرض خطط الاشتراك</Link>
        </Reveal>
      </section>

      <footer style={styles.footer}>
        © {new Date().getFullYear()} Qais Trading Academy — جميع الحقوق محفوظة
      </footer>
    </div>
  );
}

const gold = "#B8915A";
const goldBright = "#C9A24B";
const ink = "#0A0908";
const cardBg = "#121110";
const textMuted = "#8A8378";
const textSoft = "#EDE7DB";

const styles = {
  page: {
    backgroundColor: ink,
    color: textSoft,
    direction: "rtl",
    fontFamily: "'Inter', system-ui, sans-serif",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1.5rem 3rem",
    borderBottom: "1px solid #1c1a16",
  },
  logoBlock: { display: "flex", alignItems: "center", gap: "0.85rem" },
  logoImg: { height: "38px", width: "auto", borderRadius: "4px" },
  logoText: { fontFamily: "'Playfair Display', serif", fontSize: "1.05rem", color: textSoft },
  navLinks: { display: "flex", alignItems: "center", gap: "1.75rem" },
  navLink: { color: textMuted, textDecoration: "none", fontSize: "0.9rem" },
  navCta: {
    border: `1px solid ${gold}`,
    color: goldBright,
    padding: "0.55rem 1.3rem",
    borderRadius: "2px",
    textDecoration: "none",
    fontSize: "0.85rem",
    letterSpacing: "0.5px",
  },
  hero: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: "1280px",
    margin: "0 auto",
    padding: "5rem 3rem 4rem",
    gap: "3rem",
    flexWrap: "wrap",
  },
  heroText: { flex: "1 1 480px", minWidth: "320px" },
  heroLogo: { height: "90px", width: "auto", marginBottom: "1.5rem" },
  heroTag: { fontFamily: "'JetBrains Mono', monospace", color: goldBright, letterSpacing: "2px", fontSize: "0.8rem", marginBottom: "1.25rem" },
  heroTitle: { fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: "3rem", lineHeight: 1.25, marginBottom: "1.5rem" },
  heroTitleAccent: { color: goldBright, fontStyle: "italic", fontWeight: 500 },
  heroSubtitle: { color: textMuted, fontSize: "1.05rem", lineHeight: 1.85, marginBottom: "2.25rem", maxWidth: "520px" },
  heroBtn: {
    display: "inline-block",
    backgroundColor: goldBright,
    color: "#100D08",
    padding: "1rem 2.4rem",
    borderRadius: "2px",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: "1rem",
    letterSpacing: "0.5px",
  },
  statsRow: { display: "flex", alignItems: "center", gap: "1.75rem", marginTop: "3rem" },
  statItem: { display: "flex", flexDirection: "column", gap: "0.25rem" },
  statNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: "1.6rem", color: textSoft },
  statLabel: { color: textMuted, fontSize: "0.78rem" },
  statDivider: { width: "1px", height: "32px", backgroundColor: "#2a2722" },
  heroChart: { flex: "1 1 320px", minWidth: "280px", maxWidth: "400px" },
  section: {
    padding: "5rem 3rem",
    maxWidth: "1280px",
    margin: "0 auto",
  },
  sectionEyebrow: { fontFamily: "'JetBrains Mono', monospace", color: goldBright, letterSpacing: "2px", fontSize: "0.78rem", marginBottom: "0.75rem", textAlign: "center" },
  sectionTitle: { fontFamily: "'Playfair Display', serif", fontSize: "2.1rem", fontWeight: 600, textAlign: "center", marginBottom: "3rem" },
  sectionSubtitle: { color: textMuted, textAlign: "center", marginBottom: "2.5rem" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "1px",
    backgroundColor: "#1c1a16",
    border: "1px solid #1c1a16",
  },
  card: {
    backgroundColor: cardBg,
    padding: "2.25rem 2rem",
    textAlign: "right",
  },
  cardCode: { fontFamily: "'JetBrains Mono', monospace", color: textMuted, fontSize: "0.78rem", letterSpacing: "1px" },
  cardTitle: { fontFamily: "'Playfair Display', serif", fontSize: "1.25rem", color: goldBright, margin: "0.75rem 0 0.75rem", fontWeight: 600 },
  cardDesc: { color: textMuted, fontSize: "0.92rem", lineHeight: 1.75 },
  lecturesSection: { backgroundColor: "#0d0c0a", padding: "5rem 3rem", borderTop: "1px solid #1c1a16", borderBottom: "1px solid #1c1a16" },
  lecturesInner: {
    maxWidth: "1100px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: "3rem",
    alignItems: "center",
  },
  lecturesDesc: { color: textMuted, fontSize: "1rem", lineHeight: 1.9, textAlign: "right" },
  featureList: { listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "1.1rem" },
  featureItem: { color: textSoft, fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" },
  featureMark: { color: goldBright },
  pricingSection: { padding: "5rem 3rem 6rem", textAlign: "center" },
  footer: {
    textAlign: "center",
    padding: "2rem",
    color: "#3a3631",
    fontSize: "0.82rem",
    fontFamily: "'JetBrains Mono', monospace",
    borderTop: "1px solid #1c1a16",
  },
};
