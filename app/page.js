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
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ ...style, opacity: visible ? 1 : 0, transform: visible ? "translateY(0px)" : "translateY(32px)", transition: `opacity 0.9s ease ${delay}s, transform 0.9s ease ${delay}s` }}>
      {children}
    </div>
  );
}

function GlowOrb({ size, color, blur, top, left, right, opacity = 0.18 }) {
  return (
    <div style={{
      position: "absolute", top, left, right,
      width: size, height: size, borderRadius: "50%",
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      filter: `blur(${blur})`, opacity, pointerEvents: "none",
    }} />
  );
}

export default function HomePage() {
  return (
    <div style={styles.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logoBlock}>
          <img src="/logo.jpg" alt="QTA" style={styles.logoImg} />
          <span style={styles.logoText}>Qais Trading Academy</span>
        </div>
        <nav style={styles.navLinks}>
          <Link href="/login" style={styles.navLink}>تسجيل الدخول</Link>
          <Link href="/signup" style={styles.navCta}>اشترك الآن</Link>
        </nav>
      </header>

      {/* Hero */}
      <section style={styles.hero}>
        {/* Glow orbs */}
        <GlowOrb size="600px" color="#B8915A" blur="120px" top="-100px" left="-200px" opacity={0.12} />
        <GlowOrb size="400px" color="#C9A24B" blur="80px" top="200px" right="-100px" opacity={0.1} />
        <GlowOrb size="300px" color="#8B6914" blur="60px" top="400px" left="40%" opacity={0.08} />

        <div style={styles.heroInner}>
          <Reveal delay={0}>
            <div style={styles.badge}>
              <span style={styles.badgeDot} />
              أكاديمية تداول متكاملة
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <h1 style={styles.heroTitle}>
              السوق يكافئ<br />
              <span style={styles.heroTitleGold}>من يفهمه</span>
            </h1>
          </Reveal>

          <Reveal delay={0.25}>
            <p style={styles.heroSubtitle}>
              منهج تداول كامل من الأساسيات حتى الاحترافية — محاضرات مباشرة ومسجلة،
              وتدريب عملي مستمر على حساب ديمو لمدة 6 أشهر.
            </p>
          </Reveal>

          <Reveal delay={0.4}>
            <div style={styles.heroBtns}>
              <Link href="/signup" style={styles.btnPrimary}>ابدأ رحلتك الآن</Link>
              <Link href="/login" style={styles.btnSecondary}>تسجيل الدخول</Link>
            </div>
          </Reveal>

          <Reveal delay={0.55}>
            <div style={styles.statsRow}>
              {[
                { num: "6", label: "أشهر تدريب ديمو" },
                { num: "4", label: "منهجيات تحليل" },
                { num: "∞", label: "Backtest مستمر" },
              ].map((s, i) => (
                <div key={i} style={styles.statItem}>
                  <span style={styles.statNum}>{s.num}</span>
                  <span style={styles.statLabel}>{s.label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Visual orbs */}
        <Reveal delay={0.3} style={styles.orbsWrap}>
          <div style={styles.orbsGrid}>
            {[
              { label: "ICT", sub: "Inner Circle Trader" },
              { label: "SK", sub: "Elliott Wave" },
              { label: "FND", sub: "أساسيات التداول" },
              { label: "DEMO", sub: "تدريب ديمو" },
            ].map((o, i) => (
              <div key={i} style={styles.orbCard}>
                <div style={styles.orbRing}>
                  <div style={styles.orbInner}>
                    <span style={styles.orbLabel}>{o.label}</span>
                  </div>
                </div>
                <p style={styles.orbSub}>{o.sub}</p>
              </div>
            ))}
          </div>
          <p style={styles.orbsCaption}>UNLOCK YOUR TRADING POTENTIAL</p>
        </Reveal>
      </section>

      {/* Curriculum */}
      <section style={styles.section}>
        <Reveal><p style={styles.eyebrow}>وحدات المنهج</p></Reveal>
        <Reveal delay={0.1}><h2 style={styles.sectionTitle}>ست ركائز تبني متداولاً كاملاً</h2></Reveal>

        <div style={styles.grid}>
          {[
            { code: "FND", title: "أساسيات التداول", desc: "فهم الأسواق، أنواع الأدوات المالية، وإدارة رأس المال من الصفر." },
            { code: "FUN", title: "التحليل الأساسي", desc: "قراءة الأخبار الاقتصادية والمؤشرات وتأثيرها المباشر على حركة السعر." },
            { code: "ICT", title: "ICT", desc: "مفاهيم Inner Circle Trader لفهم سلوك السيولة وأثر المؤسسات الكبرى." },
            { code: "SK", title: "SK", desc: "منهجية SK المشتقة من التحليل الموجي (Elliott Wave) لقراءة دورات السعر." },
            { code: "DEMO", title: "تدريب 6 أشهر ديمو", desc: "تطبيق عملي يومي على حساب تجريبي لصقل المهارة قبل رأس المال الحقيقي." },
            { code: "BT", title: "Backtest مستمر", desc: "اختبار كل استراتيجية على بيانات تاريخية فعلية لقياس جدواها وتطويرها." },
          ].map((item, i) => (
            <Reveal key={i} delay={i * 0.07}>
              <div style={styles.card}>
                <span style={styles.cardCode}>{item.code}</span>
                <h3 style={styles.cardTitle}>{item.title}</h3>
                <p style={styles.cardDesc}>{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={styles.featuresSection}>
        <div style={styles.featuresInner}>
          <Reveal>
            <p style={styles.eyebrow}>طريقة التعلّم</p>
            <h2 style={{ ...styles.sectionTitle, textAlign: "right", marginBottom: "1.5rem" }}>
              محاضرات مباشرة ومسجلة،<br />منظمة بالكامل
            </h2>
            <p style={styles.featuresDesc}>
              يصلك المحتوى عبر مجتمع Discord الخاص — محاضرات حية تفاعلية أسبوعية،
              ومكتبة كاملة من المحاضرات المسجلة مرتبة حسب التسلسل التعليمي.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <ul style={styles.featureList}>
              {["محاضرات مباشرة أسبوعية", "مكتبة محاضرات مسجلة منظمة", "اختبارات لقياس التقدم", "دعم مباشر من المدرب داخل Discord"].map((f, i) => (
                <li key={i} style={styles.featureItem}>
                  <span style={styles.featureIcon}>◆</span> {f}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section style={styles.section} id="pricing">
        <Reveal><p style={styles.eyebrow}>الأسعار</p></Reveal>
        <Reveal delay={0.1}><h2 style={styles.sectionTitle}>سعر واضح، بدون مفاجآت</h2></Reveal>

        <Reveal delay={0.2}>
          <div style={styles.priceCard}>
            <h3 style={styles.priceCardTitle}>عضوية Qais Trading Academy</h3>
            <div style={styles.priceRow}>
              <span style={styles.priceCurrency}>$</span>
              <span style={styles.priceNum}>300</span>
              <span style={styles.pricePeriod}>عند التسجيل</span>
            </div>
            <p style={styles.priceRenewal}>ثم <strong style={{ color: gold }}>$100</strong> شهرياً بشكل تلقائي لحد ما تلغي الاشتراك</p>

            <ul style={styles.priceFeatures}>
              {[
                "وصول فوري لجميع المحاضرات المسجلة والمباشرة",
                "عضوية Discord الحصرية",
                "تدريب 6 أشهر على حساب ديمو",
                "دعم مباشر من المدرب",
              ].map((f, i) => (
                <li key={i} style={styles.priceFeatureItem}>
                  <span style={styles.featureIcon}>◆</span> {f}
                </li>
              ))}
            </ul>

            <Link href="/signup" style={{ ...styles.btnPrimary, width: "100%", textAlign: "center", boxSizing: "border-box" }}>
              اشترك الآن — $300
            </Link>

            <p style={styles.priceTaxNote}>
              الأسعار بالدولار الأمريكي (USD) وقابلة لتطبيق ضرائب حسب موقعك — بيتم احتسابها وعرضها بشكل واضح قبل إتمام الدفع عند الـ Checkout.
            </p>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section style={styles.ctaSection}>
        <GlowOrb size="500px" color="#C9A24B" blur="100px" top="50%" left="50%" opacity={0.1} />
        <Reveal><h2 style={styles.ctaTitle}>جاهز تبدأ؟</h2></Reveal>
        <Reveal delay={0.15}><p style={styles.ctaSub}>انضم الآن وابدأ رحلتك في عالم التداول الاحترافي</p></Reveal>
        <Reveal delay={0.3}>
          <Link href="/signup" style={styles.btnPrimary}>عرض خطط الاشتراك</Link>
        </Reveal>
      </section>

      <footer style={styles.footer}>
        <div style={styles.footerLinks}>
          <Link href="/terms" style={styles.footerLink}>الشروط والأحكام</Link>
          <span style={styles.footerDot}>·</span>
          <Link href="/privacy" style={styles.footerLink}>سياسة الخصوصية</Link>
          <span style={styles.footerDot}>·</span>
          <Link href="/refund-policy" style={styles.footerLink}>سياسة الاسترجاع</Link>
          <span style={styles.footerDot}>·</span>
          <a href="mailto:qaisalraifai@gmail.com" style={styles.footerLink}>تواصل معنا</a>
        </div>
        <div style={{ marginTop: "1rem" }}>
          © {new Date().getFullYear()} Qais Trading Academy — جميع الحقوق محفوظة
        </div>
      </footer>
    </div>
  );
}

const gold = "#C9A24B";
const goldDim = "#B8915A";
const ink = "#050505";
const cardBg = "#0d0d0d";
const textMuted = "#6B6560";
const textSoft = "#E8E0D0";

const styles = {
  page: { backgroundColor: ink, color: textSoft, direction: "rtl", fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh", overflowX: "hidden" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.5rem 3rem", borderBottom: "1px solid #141414", position: "relative", zIndex: 10 },
  logoBlock: { display: "flex", alignItems: "center", gap: "0.85rem" },
  logoImg: { height: "36px", width: "auto", borderRadius: "4px" },
  logoText: { fontSize: "1rem", color: textSoft, fontWeight: 500 },
  navLinks: { display: "flex", alignItems: "center", gap: "1.75rem" },
  navLink: { color: textMuted, textDecoration: "none", fontSize: "0.9rem" },
  navCta: { border: `1px solid ${goldDim}`, color: gold, padding: "0.55rem 1.3rem", borderRadius: "4px", textDecoration: "none", fontSize: "0.85rem" },

  hero: { position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: "1280px", margin: "0 auto", padding: "6rem 3rem 5rem", gap: "3rem", flexWrap: "wrap", minHeight: "85vh" },
  heroInner: { flex: "1 1 480px", minWidth: "320px", position: "relative", zIndex: 2 },
  badge: { display: "inline-flex", alignItems: "center", gap: "0.5rem", border: "1px solid #1e1e1e", borderRadius: "999px", padding: "0.4rem 1rem", fontSize: "0.8rem", color: textMuted, marginBottom: "2rem", backgroundColor: "#0d0d0d" },
  badgeDot: { width: "6px", height: "6px", borderRadius: "50%", backgroundColor: gold },
  heroTitle: { fontSize: "clamp(2.5rem, 5vw, 4.5rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: "1.5rem", letterSpacing: "-1px" },
  heroTitleGold: { color: gold },
  heroSubtitle: { color: textMuted, fontSize: "1.05rem", lineHeight: 1.85, marginBottom: "2.5rem", maxWidth: "480px" },
  heroBtns: { display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "3rem" },
  btnPrimary: { display: "inline-block", backgroundColor: gold, color: "#080600", padding: "0.9rem 2.2rem", borderRadius: "6px", textDecoration: "none", fontWeight: 700, fontSize: "0.95rem" },
  btnSecondary: { display: "inline-block", border: "1px solid #222", color: textSoft, padding: "0.9rem 2.2rem", borderRadius: "6px", textDecoration: "none", fontWeight: 500, fontSize: "0.95rem" },
  statsRow: { display: "flex", gap: "2.5rem" },
  statItem: { display: "flex", flexDirection: "column", gap: "0.2rem" },
  statNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: "1.8rem", color: textSoft, fontWeight: 500 },
  statLabel: { color: textMuted, fontSize: "0.75rem" },

  orbsWrap: { flex: "1 1 320px", minWidth: "280px", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" },
  orbsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" },
  orbCard: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" },
  orbRing: { width: "100px", height: "100px", borderRadius: "50%", border: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 30% 30%, #1a1610 0%, #080600 100%)", boxShadow: `0 0 30px ${gold}22, inset 0 0 20px ${gold}11` },
  orbInner: { width: "70px", height: "70px", borderRadius: "50%", border: `1px solid ${gold}44`, display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle, ${gold}15 0%, transparent 70%)` },
  orbLabel: { fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", color: gold, letterSpacing: "1px", fontWeight: 500 },
  orbSub: { color: textMuted, fontSize: "0.72rem", textAlign: "center" },
  orbsCaption: { fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", color: "#2a2520", letterSpacing: "3px" },

  section: { padding: "5rem 3rem", maxWidth: "1280px", margin: "0 auto" },
  eyebrow: { fontFamily: "'JetBrains Mono', monospace", color: gold, letterSpacing: "2px", fontSize: "0.75rem", marginBottom: "0.75rem", textAlign: "center" },
  sectionTitle: { fontSize: "2rem", fontWeight: 800, textAlign: "center", marginBottom: "3rem", letterSpacing: "-0.5px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1px", backgroundColor: "#111", border: "1px solid #111" },
  card: { backgroundColor: cardBg, padding: "2.25rem 2rem", textAlign: "right", transition: "background 0.3s" },
  cardCode: { fontFamily: "'JetBrains Mono', monospace", color: textMuted, fontSize: "0.72rem", letterSpacing: "1px" },
  cardTitle: { fontSize: "1.15rem", color: gold, margin: "0.75rem 0", fontWeight: 700 },
  cardDesc: { color: textMuted, fontSize: "0.9rem", lineHeight: 1.75 },

  priceCard: {
    backgroundColor: cardBg,
    border: `1px solid ${goldDim}66`,
    borderRadius: "10px",
    padding: "2.75rem 2.5rem",
    maxWidth: "440px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.25rem",
    textAlign: "center",
  },
  priceCardTitle: { fontSize: "1.15rem", fontWeight: 700, color: textSoft, margin: 0 },
  priceRow: { display: "flex", alignItems: "baseline", gap: "0.35rem", justifyContent: "center" },
  priceCurrency: { color: gold, fontSize: "1.3rem" },
  priceNum: { fontFamily: "'JetBrains Mono', monospace", color: gold, fontSize: "3.2rem", fontWeight: 700, lineHeight: 1 },
  pricePeriod: { color: textMuted, fontSize: "0.85rem" },
  priceRenewal: { color: textMuted, fontSize: "0.88rem", margin: 0 },
  priceFeatures: { listStyle: "none", padding: 0, margin: "0.5rem 0", width: "100%", display: "flex", flexDirection: "column", gap: "0.65rem" },
  priceFeatureItem: { color: textMuted, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "flex-start" },
  priceTaxNote: { color: "#555", fontSize: "0.75rem", lineHeight: 1.6, margin: 0 },

  featuresSection: { backgroundColor: "#080808", padding: "5rem 3rem", borderTop: "1px solid #111", borderBottom: "1px solid #111" },
  featuresInner: { maxWidth: "900px", margin: "0 auto", display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "4rem", alignItems: "center" },
  featuresDesc: { color: textMuted, fontSize: "1rem", lineHeight: 1.9 },
  featureList: { listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "1.25rem" },
  featureItem: { color: textSoft, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.75rem" },
  featureIcon: { color: gold, fontSize: "0.6rem" },

  ctaSection: { position: "relative", padding: "6rem 3rem 7rem", textAlign: "center", overflow: "hidden" },
  ctaTitle: { fontSize: "2.5rem", fontWeight: 900, marginBottom: "1rem", letterSpacing: "-0.5px" },
  ctaSub: { color: textMuted, marginBottom: "2.5rem", fontSize: "1rem" },

  footer: { textAlign: "center", padding: "2rem", color: "#222", fontSize: "0.8rem", fontFamily: "'JetBrains Mono', monospace", borderTop: "1px solid #111" },
  footerLinks: { display: "flex", justifyContent: "center", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" },
  footerLink: { color: textMuted, textDecoration: "none", fontSize: "0.8rem" },
  footerDot: { color: "#2a2520" },
};
