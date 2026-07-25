/**
 * QTA Academy — Vault of Gold Design (v2)
 * Dark luxury fintech aesthetic with gold accents
 * RTL Arabic layout, Cairo font, premium animations
 * Style: No emoji icons, terminal language, market-literate copy
 */
import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

// ── Animation Variants ──────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, delay: i * 0.08 },
  }),
};

// ── Reveal wrapper ───────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      custom={delay}
      variants={fadeUp}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Glow Orb ────────────────────────────────────────────────────────
function GlowOrb({ size, color, blur, style }: { size: string; color: string; blur: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: `blur(${blur})`,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

// ── Gold Divider ─────────────────────────────────────────────────────
function GoldDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "0 auto", maxWidth: "200px" }}>
      <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.4))" }} />
      <span style={{ color: "#D4AF37", fontSize: "0.6rem" }}>◆</span>
      <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, rgba(212,175,55,0.4), transparent)" }} />
    </div>
  );
}

// ── Terminal Badge ───────────────────────────────────────────────────
function TerminalBadge({ label }: { label: string }) {
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "0.62rem",
      color: "#8B8FA8",
      letterSpacing: "2px",
      border: "1px solid rgba(212,175,55,0.15)",
      padding: "0.2rem 0.6rem",
      borderRadius: "3px",
      background: "rgba(212,175,55,0.04)",
    }}>
      {label}
    </span>
  );
}

// ── Ticker ───────────────────────────────────────────────────────────
const tickerItems = [
  { symbol: "EUR/USD", price: "1.0842", change: "+0.12%", up: true },
  { symbol: "GBP/USD", price: "1.2673", change: "-0.08%", up: false },
  { symbol: "USD/JPY", price: "154.32", change: "+0.34%", up: true },
  { symbol: "XAU/USD", price: "2,341", change: "+0.67%", up: true },
  { symbol: "BTC/USD", price: "67,420", change: "+1.23%", up: true },
  { symbol: "NAS100", price: "18,234", change: "-0.21%", up: false },
  { symbol: "SPX500", price: "5,234", change: "+0.15%", up: true },
  { symbol: "OIL/USD", price: "78.45", change: "-0.43%", up: false },
  { symbol: "AUD/USD", price: "0.6542", change: "+0.09%", up: true },
  { symbol: "USD/CAD", price: "1.3621", change: "-0.14%", up: false },
];

function Ticker() {
  const doubled = [...tickerItems, ...tickerItems];
  return (
    <div
      style={{
        background: "rgba(6,8,9,0.98)",
        borderTop: "1px solid rgba(212,175,55,0.12)",
        borderBottom: "1px solid rgba(212,175,55,0.12)",
        overflow: "hidden",
        padding: "0.55rem 0",
        direction: "ltr",
      }}
    >
      <div className="ticker-track" style={{ display: "flex", gap: "2.5rem", width: "max-content" }}>
        {doubled.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", whiteSpace: "nowrap" }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", color: "#555", letterSpacing: "1px" }}>{item.symbol}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", color: "#EAECEF", fontWeight: 600 }}>{item.price}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", color: item.up ? "#00D4AA" : "#FF4D6A" }}>
              {item.up ? "▲" : "▼"} {item.change}
            </span>
            <span style={{ color: "rgba(212,175,55,0.15)", marginLeft: "0.25rem" }}>│</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Navbar ───────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "المنهج", href: "#curriculum" },
    { label: "طريقة التعلم", href: "#features" },
    { label: "الأسعار", href: "#pricing" },
    { label: "الأسئلة الشائعة", href: "#faq" },
  ];

  return (
    <>
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          transition: "all 0.35s ease",
          background: scrolled ? "rgba(6,8,9,0.97)" : "transparent",
          backdropFilter: scrolled ? "blur(24px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(212,175,55,0.1)" : "1px solid transparent",
          padding: "0 2rem",
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: "72px" }}>
          {/* Logo */}
          <a href="/" style={{ display: "flex", alignItems: "center", gap: "0.85rem", textDecoration: "none" }}>
            <div style={{ position: "relative" }}>
              <img src="/manus-storage/qta-logo_d0cf1363.jpg" alt="QTA" style={{ height: "42px", width: "42px", borderRadius: "6px", objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", inset: 0, borderRadius: "6px", border: "1px solid rgba(212,175,55,0.3)", pointerEvents: "none" }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 900, fontSize: "1rem", color: "#EAECEF", lineHeight: 1.1, letterSpacing: "-0.3px" }}>Qais Trading</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.55rem", color: "#D4AF37", letterSpacing: "3px", opacity: 0.85 }}>ACADEMY</div>
            </div>
          </a>

          {/* Desktop Nav */}
          <nav style={{ display: "flex", alignItems: "center", gap: "2rem" }} className="hidden md:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{ color: "#6B7280", textDecoration: "none", fontSize: "0.85rem", fontWeight: 500, transition: "color 0.2s", fontFamily: "'Cairo', sans-serif" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#D4AF37")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#6B7280")}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <a
              href="/login"
              style={{ color: "#6B7280", textDecoration: "none", fontSize: "0.82rem", transition: "color 0.2s", fontFamily: "'Cairo', sans-serif" }}
              className="hidden md:block"
              onMouseEnter={(e) => (e.currentTarget.style.color = "#EAECEF")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#6B7280")}
            >
              تسجيل الدخول
            </a>
            <a
              href="/signup"
              style={{
                background: "linear-gradient(135deg, #D4AF37 0%, #C9A227 100%)",
                color: "#060809",
                padding: "0.5rem 1.3rem",
                borderRadius: "5px",
                textDecoration: "none",
                fontWeight: 800,
                fontSize: "0.82rem",
                transition: "all 0.2s ease",
                boxShadow: "0 4px 15px rgba(212,175,55,0.2)",
                fontFamily: "'Cairo', sans-serif",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.03)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 25px rgba(212,175,55,0.4)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 15px rgba(212,175,55,0.2)"; }}
            >
              اشترك الآن
            </a>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: "none", border: "none", color: "#EAECEF", cursor: "pointer", padding: "0.25rem" }}
              className="md:hidden"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {menuOpen ? (
                  <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                ) : (
                  <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              top: "72px",
              left: 0,
              right: 0,
              zIndex: 99,
              background: "rgba(6,8,9,0.99)",
              backdropFilter: "blur(24px)",
              borderBottom: "1px solid rgba(212,175,55,0.12)",
              padding: "1.5rem 2rem",
            }}
          >
            <nav style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  style={{ color: "#EAECEF", textDecoration: "none", fontSize: "1rem", fontWeight: 600, padding: "0.5rem 0", borderBottom: "1px solid rgba(212,175,55,0.07)", fontFamily: "'Cairo', sans-serif" }}
                >
                  {link.label}
                </a>
              ))}
              <a href="/login" style={{ color: "#6B7280", textDecoration: "none", fontSize: "0.9rem", fontFamily: "'Cairo', sans-serif" }}>تسجيل الدخول</a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Hero Section ─────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        overflow: "hidden",
        paddingTop: "72px",
      }}
    >
      {/* Background Image */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url('/manus-storage/qta-hero-bg_4d590f16.jpg')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.3,
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #060809 0%, rgba(6,8,9,0.65) 50%, rgba(6,8,9,0.92) 100%)" }} />

      {/* Glow orbs */}
      <GlowOrb size="700px" color="rgba(212,175,55,0.15)" blur="130px" style={{ top: "-200px", right: "-200px" }} />
      <GlowOrb size="350px" color="rgba(212,175,55,0.1)" blur="80px" style={{ bottom: "80px", left: "-80px" }} />

      {/* Ticker */}
      <div style={{ position: "absolute", top: "72px", left: 0, right: 0, zIndex: 5 }}>
        <Ticker />
      </div>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 10, maxWidth: "1280px", margin: "0 auto", padding: "8rem 2rem 5rem", width: "100%" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "5rem", alignItems: "center" }} className="hero-grid">

          {/* Text Side */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={{ marginBottom: "2rem" }}
            >
              <TerminalBadge label="QTA · PROFESSIONAL TRADING EDUCATION" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.2 }}
              style={{
                fontFamily: "'Cairo', sans-serif",
                fontSize: "clamp(2.8rem, 5.5vw, 4.8rem)",
                fontWeight: 900,
                lineHeight: 1.06,
                marginBottom: "1.5rem",
                letterSpacing: "-1.5px",
                color: "#EAECEF",
              }}
            >
              السوق لا يكذب —<br />
              <span
                style={{
                  background: "linear-gradient(135deg, #F2D57E 0%, #D4AF37 60%, #9C7A22 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                تعلّم كيف تقرأه
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              style={{ color: "#6B7280", fontSize: "1rem", lineHeight: 1.9, marginBottom: "2.5rem", maxWidth: "480px", fontFamily: "'Cairo', sans-serif" }}
            >
              منهج تداول كامل — ICT، SK، تحليل أساسي، وتدريب عملي على ديمو 6 أشهر.
              ليس كل من يتداول يربح. نحن نعلمك الفرق.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "3.5rem" }}
            >
              <a
                href="/signup"
                style={{
                  background: "linear-gradient(135deg, #D4AF37 0%, #C9A227 100%)",
                  color: "#060809",
                  padding: "0.9rem 2.4rem",
                  borderRadius: "5px",
                  textDecoration: "none",
                  fontWeight: 900,
                  fontSize: "0.95rem",
                  boxShadow: "0 8px 30px rgba(212,175,55,0.3)",
                  transition: "all 0.25s ease",
                  display: "inline-block",
                  fontFamily: "'Cairo', sans-serif",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 14px 45px rgba(212,175,55,0.5)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(212,175,55,0.3)"; }}
              >
                انضم الآن — $300
              </a>
              <a
                href="#curriculum"
                style={{
                  border: "1px solid rgba(212,175,55,0.25)",
                  color: "#EAECEF",
                  padding: "0.9rem 2rem",
                  borderRadius: "5px",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  transition: "all 0.25s ease",
                  display: "inline-block",
                  background: "rgba(212,175,55,0.04)",
                  fontFamily: "'Cairo', sans-serif",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,175,55,0.5)"; (e.currentTarget as HTMLElement).style.background = "rgba(212,175,55,0.08)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,175,55,0.25)"; (e.currentTarget as HTMLElement).style.background = "rgba(212,175,55,0.04)"; }}
              >
                استعرض المنهج
              </a>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.65 }}
            >
              <div style={{ display: "flex", gap: "0", borderTop: "1px solid rgba(212,175,55,0.1)", paddingTop: "1.5rem" }}>
                {[
                  { num: "6M", label: "DEMO TRAINING" },
                  { num: "4+", label: "METHODOLOGIES" },
                  { num: "∞", label: "BACKTESTS" },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, paddingLeft: i > 0 ? "1.5rem" : 0, borderLeft: i > 0 ? "1px solid rgba(212,175,55,0.1)" : "none", marginLeft: i > 0 ? "1.5rem" : 0 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.6rem", fontWeight: 700, color: "#D4AF37", lineHeight: 1 }}>{s.num}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.58rem", color: "#555", letterSpacing: "1.5px", marginTop: "0.3rem" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Visual Side */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
            className="hero-visual"
          >
            <div style={{ position: "relative", width: "100%", maxWidth: "460px" }}>
              <div
                style={{
                  borderRadius: "10px",
                  overflow: "hidden",
                  border: "1px solid rgba(212,175,55,0.18)",
                  boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 50px rgba(212,175,55,0.08)",
                  background: "#0D1117",
                }}
              >
                {/* Terminal header bar */}
                <div style={{ background: "#0D1117", borderBottom: "1px solid rgba(212,175,55,0.1)", padding: "0.6rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem", direction: "ltr" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FF4D6A" }} />
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#F59E0B" }} />
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00D4AA" }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", color: "#555", marginLeft: "0.5rem" }}>XAU/USD · H4 · ICT Setup</span>
                </div>
                <img
                  src="/manus-storage/qta-trading-chart_52afaf6d.jpg"
                  alt="Trading Chart"
                  style={{ width: "100%", height: "auto", display: "block", opacity: 0.92 }}
                />
              </div>

              {/* Floating cards */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
                style={{
                  position: "absolute",
                  top: "-16px",
                  right: "-16px",
                  background: "rgba(6,8,9,0.97)",
                  border: "1px solid rgba(0,212,170,0.25)",
                  borderRadius: "8px",
                  padding: "0.65rem 0.9rem",
                  backdropFilter: "blur(12px)",
                  direction: "ltr",
                }}
              >
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.58rem", color: "#555", letterSpacing: "1px" }}>XAU/USD</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.9rem", color: "#00D4AA", fontWeight: 700 }}>▲ +2.4%</div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}
                style={{
                  position: "absolute",
                  bottom: "50px",
                  left: "-16px",
                  background: "rgba(6,8,9,0.97)",
                  border: "1px solid rgba(212,175,55,0.2)",
                  borderRadius: "8px",
                  padding: "0.65rem 0.9rem",
                  backdropFilter: "blur(12px)",
                  direction: "ltr",
                }}
              >
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.58rem", color: "#555", letterSpacing: "1px" }}>ICT · FVG</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.82rem", color: "#D4AF37", fontWeight: 700 }}>BULLISH ◆</div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "100px", background: "linear-gradient(to bottom, transparent, #060809)" }} />
    </section>
  );
}

// ── Curriculum Section ────────────────────────────────────────────────
const curriculumItems = [
  { code: "01 · FND", title: "أساسيات التداول", desc: "فهم الأسواق، أنواع الأدوات المالية، وإدارة رأس المال من الصفر حتى الإتقان.", tag: "FOUNDATION" },
  { code: "02 · FUN", title: "التحليل الأساسي", desc: "قراءة الأخبار الاقتصادية والمؤشرات وتأثيرها المباشر على حركة السعر.", tag: "FUNDAMENTAL" },
  { code: "03 · ICT", title: "Inner Circle Trader", desc: "مفاهيم ICT لفهم سلوك السيولة وأثر المؤسسات الكبرى على السوق.", tag: "ADVANCED" },
  { code: "04 · SK", title: "منهجية SK", desc: "المنهجية المشتقة من التحليل الموجي (Elliott Wave) لقراءة دورات السعر.", tag: "ADVANCED" },
  { code: "05 · DEMO", title: "تدريب 6 أشهر ديمو", desc: "تطبيق عملي يومي على حساب تجريبي لصقل المهارة قبل رأس المال الحقيقي.", tag: "PRACTICAL" },
  { code: "06 · BT", title: "Backtest مستمر", desc: "اختبار كل استراتيجية على بيانات تاريخية فعلية لقياس جدواها وتطويرها.", tag: "RESEARCH" },
];

function CurriculumSection() {
  return (
    <section id="curriculum" style={{ padding: "8rem 2rem", maxWidth: "1280px", margin: "0 auto" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ height: "1px", width: "40px", background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.4))" }} />
          <p className="eyebrow">وحدات المنهج</p>
          <div style={{ height: "1px", width: "40px", background: "linear-gradient(90deg, rgba(212,175,55,0.4), transparent)" }} />
        </div>
      </Reveal>
      <Reveal delay={1}>
        <h2 style={{ fontFamily: "'Cairo', sans-serif", fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)", fontWeight: 900, textAlign: "center", marginBottom: "0.75rem", color: "#EAECEF", letterSpacing: "-0.5px" }}>
          ست ركائز تبني متداولاً كاملاً
        </h2>
      </Reveal>
      <Reveal delay={2}>
        <p style={{ textAlign: "center", color: "#6B7280", fontSize: "0.95rem", marginBottom: "4rem", maxWidth: "480px", margin: "0 auto 4rem", fontFamily: "'Cairo', sans-serif" }}>
          منهج متكامل يأخذك من الصفر حتى تتداول باحترافية — بدون اختصارات
        </p>
      </Reveal>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1px", background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.08)", borderRadius: "10px", overflow: "hidden" }}>
        {curriculumItems.map((item, i) => (
          <Reveal key={i} delay={i * 0.5}>
            <div
              style={{
                background: "#0D1117",
                padding: "2.5rem 2rem",
                transition: "background 0.3s ease",
                cursor: "default",
                height: "100%",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#111820"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#0D1117"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                <TerminalBadge label={item.code} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.55rem", color: "#D4AF37", letterSpacing: "1.5px", opacity: 0.7 }}>{item.tag}</span>
              </div>
              <h3 style={{ fontFamily: "'Cairo', sans-serif", fontSize: "1.1rem", fontWeight: 800, color: "#D4AF37", marginBottom: "0.75rem" }}>{item.title}</h3>
              <p style={{ color: "#6B7280", fontSize: "0.88rem", lineHeight: 1.8, fontFamily: "'Cairo', sans-serif" }}>{item.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ── Features Section ─────────────────────────────────────────────────
const featureIcons = [
  // SVG line icons — no emoji
  <svg key="live" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  <svg key="lib" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  <svg key="bt" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  <svg key="disc" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  <svg key="demo" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  <svg key="quiz" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
];

const features = [
  { icon: featureIcons[0], title: "محاضرات مباشرة أسبوعية", desc: "جلسات تفاعلية مع المدرب — تحليلات حية، أسئلة، وتطبيق فوري على السوق." },
  { icon: featureIcons[1], title: "مكتبة محاضرات مسجلة", desc: "أكثر من 100 محاضرة مسجلة ومنظمة حسب التسلسل التعليمي الصحيح." },
  { icon: featureIcons[2], title: "Backtest أسبوعي", desc: "اختبار الاستراتيجيات على بيانات حقيقية — الثقة تُبنى بالدليل لا بالتخمين." },
  { icon: featureIcons[3], title: "مجتمع Discord حصري", desc: "تواصل مباشر مع المدرب والطلاب — تحليلات يومية وإشارات تعليمية." },
  { icon: featureIcons[4], title: "تدريب ديمو 6 أشهر", desc: "تطبيق عملي بإشراف مباشر — لا تخاطر برأس المال الحقيقي قبل الجاهزية." },
  { icon: featureIcons[5], title: "اختبارات تقييمية", desc: "قياس مستواك بعد كل وحدة — لا تتقدم إلا إذا أتقنت ما قبله." },
];

function FeaturesSection() {
  return (
    <section
      id="features"
      style={{
        padding: "8rem 2rem",
        background: "#0A0D10",
        borderTop: "1px solid rgba(212,175,55,0.07)",
        borderBottom: "1px solid rgba(212,175,55,0.07)",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginBottom: "1rem" }}>
            <div style={{ height: "1px", width: "40px", background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.4))" }} />
            <p className="eyebrow">طريقة التعلّم</p>
            <div style={{ height: "1px", width: "40px", background: "linear-gradient(90deg, rgba(212,175,55,0.4), transparent)" }} />
          </div>
        </Reveal>
        <Reveal delay={1}>
          <h2 style={{ fontFamily: "'Cairo', sans-serif", fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)", fontWeight: 900, textAlign: "center", marginBottom: "0.75rem", color: "#EAECEF" }}>
            كل ما تحتاجه في مكان واحد
          </h2>
        </Reveal>
        <Reveal delay={2}>
          <p style={{ textAlign: "center", color: "#6B7280", fontSize: "0.95rem", marginBottom: "4rem", fontFamily: "'Cairo', sans-serif" }}>
            منصة متكاملة — التعليم والتطبيق والمجتمع في تجربة واحدة
          </p>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1px", background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.08)", borderRadius: "10px", overflow: "hidden" }}>
          {features.map((f, i) => (
            <Reveal key={i} delay={i * 0.4}>
              <div
                style={{
                  background: "#0D1117",
                  padding: "2rem",
                  transition: "background 0.3s ease",
                  height: "100%",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#111820"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#0D1117"; }}
              >
                <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem" }}>
                  {f.icon}
                </div>
                <h3 style={{ fontFamily: "'Cairo', sans-serif", fontSize: "0.98rem", fontWeight: 700, color: "#EAECEF", marginBottom: "0.6rem" }}>{f.title}</h3>
                <p style={{ color: "#6B7280", fontSize: "0.85rem", lineHeight: 1.8, fontFamily: "'Cairo', sans-serif" }}>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Testimonials Section ─────────────────────────────────────────────
const testimonials = [
  { name: "أحمد الشمري", role: "متداول فوركس", text: "بعد 3 أشهر في QTA فهمت ICT بشكل ما كنت أتخيله. المنهج منظم ومترابط والمدرب متاح دايماً.", stars: 5 },
  { name: "سارة المنصور", role: "مبتدئة في التداول", text: "بدأت من الصفر. الآن أقدر أحلل السوق بثقة وأطبق على الديمو يومياً. المنهج يشرح بمنطق لا بحفظ.", stars: 5 },
  { name: "خالد العتيبي", role: "محلل فني", text: "منهجية SK غيّرت نظرتي للسوق كلياً. الـ Backtest الأسبوعي يثبت فعالية الاستراتيجية بالأرقام.", stars: 5 },
  { name: "فيصل الدوسري", role: "متداول عقود آجلة", text: "أفضل استثمار عملته. $300 مقابل منهج كامل ودعم مستمر — القيمة لا تُقارن بالسعر أبداً.", stars: 5 },
  { name: "نورة الحربي", role: "طالبة جامعية", text: "كنت خايفة من تعقيد التداول. المنهج يبني الفهم خطوة بخطوة بمنطق واضح — الآن أفهم كل شيء.", stars: 5 },
  { name: "محمد القحطاني", role: "مستثمر", text: "التحليل الأساسي اللي تعلمته هنا غيّر طريقة تفكيري في الأسواق. أنصح كل شخص جاد بالانضمام.", stars: 5 },
];

function TestimonialsSection() {
  return (
    <section style={{ padding: "8rem 2rem", maxWidth: "1280px", margin: "0 auto" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ height: "1px", width: "40px", background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.4))" }} />
          <p className="eyebrow">آراء الطلاب</p>
          <div style={{ height: "1px", width: "40px", background: "linear-gradient(90deg, rgba(212,175,55,0.4), transparent)" }} />
        </div>
      </Reveal>
      <Reveal delay={1}>
        <h2 style={{ fontFamily: "'Cairo', sans-serif", fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)", fontWeight: 900, textAlign: "center", marginBottom: "0.75rem", color: "#EAECEF" }}>
          ماذا يقول طلابنا؟
        </h2>
      </Reveal>
      <Reveal delay={2}>
        <p style={{ textAlign: "center", color: "#6B7280", fontSize: "0.95rem", marginBottom: "4rem", fontFamily: "'Cairo', sans-serif" }}>
          نتائج حقيقية — لا وعود فارغة
        </p>
      </Reveal>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }}>
        {testimonials.map((t, i) => (
          <Reveal key={i} delay={i * 0.4}>
            <div
              style={{
                background: "#0D1117",
                border: "1px solid rgba(212,175,55,0.1)",
                borderRadius: "8px",
                padding: "1.75rem",
                transition: "all 0.3s ease",
                height: "100%",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,175,55,0.25)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,175,55,0.1)"; }}
            >
              <div style={{ display: "flex", gap: "0.15rem", marginBottom: "1rem" }}>
                {Array.from({ length: t.stars }).map((_, si) => (
                  <span key={si} style={{ color: "#D4AF37", fontSize: "0.8rem" }}>★</span>
                ))}
              </div>
              <p style={{ color: "#EAECEF", fontSize: "0.9rem", lineHeight: 1.8, marginBottom: "1.25rem", fontFamily: "'Cairo', sans-serif" }}>
                "{t.text}"
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", borderTop: "1px solid rgba(212,175,55,0.07)", paddingTop: "1rem" }}>
                <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "linear-gradient(135deg, #D4AF37, #9C7A22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700, color: "#060809", flexShrink: 0 }}>
                  {t.name[0]}
                </div>
                <div>
                  <div style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "#EAECEF" }}>{t.name}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", color: "#555", letterSpacing: "1px" }}>{t.role}</div>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ── Pricing Section ───────────────────────────────────────────────────
function PricingSection() {
  return (
    <section
      id="pricing"
      style={{
        padding: "8rem 2rem",
        background: "#0A0D10",
        borderTop: "1px solid rgba(212,175,55,0.07)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <GlowOrb size="600px" color="rgba(212,175,55,0.1)" blur="110px" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />

      <div style={{ maxWidth: "1280px", margin: "0 auto", position: "relative", zIndex: 2 }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginBottom: "1rem" }}>
            <div style={{ height: "1px", width: "40px", background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.4))" }} />
            <p className="eyebrow">الأسعار</p>
            <div style={{ height: "1px", width: "40px", background: "linear-gradient(90deg, rgba(212,175,55,0.4), transparent)" }} />
          </div>
        </Reveal>
        <Reveal delay={1}>
          <h2 style={{ fontFamily: "'Cairo', sans-serif", fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)", fontWeight: 900, textAlign: "center", marginBottom: "0.75rem", color: "#EAECEF" }}>
            سعر واضح، بدون مفاجآت
          </h2>
        </Reveal>
        <Reveal delay={2}>
          <p style={{ textAlign: "center", color: "#6B7280", fontSize: "0.95rem", marginBottom: "4rem", fontFamily: "'Cairo', sans-serif" }}>
            استثمار واحد يفتح لك أبواب التداول الاحترافي
          </p>
        </Reveal>

        <Reveal delay={3}>
          <div style={{ maxWidth: "500px", margin: "0 auto" }}>
            <div
              style={{
                background: "rgba(13,17,23,0.98)",
                border: "1px solid rgba(212,175,55,0.3)",
                borderRadius: "12px",
                padding: "3rem 2.5rem",
                textAlign: "center",
                boxShadow: "0 40px 100px rgba(0,0,0,0.6), 0 0 80px rgba(212,175,55,0.06)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "1px", background: "linear-gradient(90deg, transparent, #D4AF37, transparent)" }} />

              <div style={{ marginBottom: "1.5rem" }}>
                <TerminalBadge label="QTA · PREMIUM MEMBERSHIP" />
              </div>

              <h3 style={{ fontFamily: "'Cairo', sans-serif", fontSize: "1.15rem", fontWeight: 800, color: "#EAECEF", marginBottom: "1.75rem" }}>عضوية Qais Trading Academy</h3>

              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "0.3rem", marginBottom: "0.5rem" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.1rem", color: "#D4AF37" }}>$</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "4.5rem", fontWeight: 700, color: "#D4AF37", lineHeight: 1 }}>300</span>
                <span style={{ color: "#555", fontSize: "0.85rem", fontFamily: "'Cairo', sans-serif" }}>عند التسجيل</span>
              </div>
              <p style={{ color: "#6B7280", fontSize: "0.85rem", marginBottom: "2rem", fontFamily: "'Cairo', sans-serif" }}>
                ثم <strong style={{ color: "#D4AF37" }}>$100</strong> شهرياً — يمكنك الإلغاء في أي وقت
              </p>

              <div style={{ textAlign: "right", marginBottom: "2.25rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                {[
                  "وصول فوري لجميع المحاضرات المسجلة والمباشرة",
                  "عضوية Discord الحصرية مع دعم مباشر",
                  "تدريب 6 أشهر على حساب ديمو بإشراف",
                  "Backtest أسبوعي مع المجموعة",
                  "اختبارات تقييمية لقياس التقدم",
                  "وصول لجميع التحديثات المستقبلية",
                ].map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ color: "#D4AF37", fontSize: "0.65rem", flexShrink: 0 }}>◆</span>
                    <span style={{ color: "#EAECEF", fontSize: "0.88rem", fontFamily: "'Cairo', sans-serif" }}>{f}</span>
                  </div>
                ))}
              </div>

              <a
                href="/signup"
                style={{
                  display: "block",
                  background: "linear-gradient(135deg, #D4AF37 0%, #C9A227 100%)",
                  color: "#060809",
                  padding: "1rem",
                  borderRadius: "6px",
                  textDecoration: "none",
                  fontWeight: 900,
                  fontSize: "1rem",
                  marginBottom: "1rem",
                  boxShadow: "0 8px 30px rgba(212,175,55,0.3)",
                  transition: "all 0.25s ease",
                  fontFamily: "'Cairo', sans-serif",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 14px 45px rgba(212,175,55,0.5)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(212,175,55,0.3)"; }}
              >
                انضم الآن — $300
              </a>

              <p style={{ color: "#444", fontSize: "0.7rem", lineHeight: 1.6, fontFamily: "'Cairo', sans-serif" }}>
                الأسعار بالدولار الأمريكي. قد تُطبق ضرائب حسب موقعك وتُعرض قبل إتمام الدفع.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── FAQ Section ───────────────────────────────────────────────────────
const faqs = [
  { q: "من هو المدرب وما خبرته؟", a: "قيس الرفاعي — متداول محترف بخبرة تزيد عن 5 سنوات في أسواق الفوركس والمعادن. متخصص في منهجيات ICT وSK مع سجل حافل من النتائج الموثقة." },
  { q: "هل أحتاج خبرة مسبقة للانضمام؟", a: "لا. المنهج يبدأ من الصفر المطلق. وحدة أساسيات التداول مصممة للمبتدئين وتأخذك خطوة بخطوة حتى تفهم كيف يعمل السوق." },
  { q: "كيف تصلني المحاضرات؟", a: "عبر مجتمع Discord الخاص بالأكاديمية — محاضرات مباشرة أسبوعية ومكتبة كاملة من المحاضرات المسجلة منظمة حسب التسلسل التعليمي." },
  { q: "ما الفرق بين ICT وSK؟", a: "ICT يركز على سلوك السيولة وأثر المؤسسات الكبرى. SK منهجية مشتقة من التحليل الموجي (Elliott Wave) لقراءة دورات السعر. كلاهما مكمل للآخر." },
  { q: "هل يمكنني الإلغاء في أي وقت؟", a: "نعم، يمكنك إلغاء الاشتراك الشهري في أي وقت دون أي التزامات. الدفع الأولي $300 غير قابل للاسترجاع وفقاً لسياسة الاسترجاع." },
  { q: "هل هناك ضمان استرجاع؟", a: "نعم، نقدم ضمان استرجاع خلال 7 أيام من الاشتراك إذا لم تكن راضياً عن المحتوى. راجع سياسة الاسترجاع للتفاصيل الكاملة." },
  { q: "كم من الوقت أحتاج يومياً للتعلم؟", a: "ساعة إلى ساعتين يومياً كافية للتقدم الجيد. المحاضرات المسجلة تتيح لك التعلم بوتيرتك الخاصة، والمحاضرات المباشرة أسبوعية." },
  { q: "هل يمكنني التداول بالحساب الحقيقي أثناء التدريب؟", a: "ننصح بشدة بالتركيز على الحساب التجريبي (ديمو) لمدة 6 أشهر أولاً. التداول بحساب حقيقي قبل إتقان المنهج محفوف بمخاطر عالية." },
];

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" style={{ padding: "8rem 2rem", maxWidth: "860px", margin: "0 auto" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ height: "1px", width: "40px", background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.4))" }} />
          <p className="eyebrow">الأسئلة الشائعة</p>
          <div style={{ height: "1px", width: "40px", background: "linear-gradient(90deg, rgba(212,175,55,0.4), transparent)" }} />
        </div>
      </Reveal>
      <Reveal delay={1}>
        <h2 style={{ fontFamily: "'Cairo', sans-serif", fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)", fontWeight: 900, textAlign: "center", marginBottom: "0.75rem", color: "#EAECEF" }}>
          كل ما تريد معرفته
        </h2>
      </Reveal>
      <Reveal delay={2}>
        <p style={{ textAlign: "center", color: "#6B7280", fontSize: "0.95rem", marginBottom: "4rem", fontFamily: "'Cairo', sans-serif" }}>
          إذا لم تجد إجابتك، تواصل معنا مباشرة
        </p>
      </Reveal>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {faqs.map((faq, i) => (
          <Reveal key={i} delay={i * 0.25}>
            <div
              style={{
                background: "#0D1117",
                border: `1px solid ${openIndex === i ? "rgba(212,175,55,0.3)" : "rgba(212,175,55,0.08)"}`,
                borderRadius: "8px",
                overflow: "hidden",
                transition: "border-color 0.3s ease",
              }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1.2rem 1.5rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "right",
                  gap: "1rem",
                }}
              >
                <span style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 700, fontSize: "0.92rem", color: openIndex === i ? "#D4AF37" : "#EAECEF", transition: "color 0.2s" }}>
                  {faq.q}
                </span>
                <span style={{ color: "#D4AF37", fontSize: "1.1rem", flexShrink: 0, transition: "transform 0.3s ease", transform: openIndex === i ? "rotate(45deg)" : "rotate(0deg)", display: "inline-block" }}>
                  +
                </span>
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ overflow: "hidden" }}
                  >
                    <p style={{ padding: "0 1.5rem 1.2rem", color: "#6B7280", fontSize: "0.88rem", lineHeight: 1.85, fontFamily: "'Cairo', sans-serif" }}>
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ── CTA Section ───────────────────────────────────────────────────────
function CTASection() {
  return (
    <section
      style={{
        padding: "8rem 2rem",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        background: "#0A0D10",
        borderTop: "1px solid rgba(212,175,55,0.07)",
      }}
    >
      <GlowOrb size="800px" color="rgba(212,175,55,0.09)" blur="130px" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />

      <div style={{ position: "relative", zIndex: 2, maxWidth: "600px", margin: "0 auto" }}>
        <Reveal>
          <div style={{ marginBottom: "2rem" }}>
            <img src="/manus-storage/qta-logo_d0cf1363.jpg" alt="QTA" style={{ width: "60px", height: "60px", borderRadius: "10px", objectFit: "cover", boxShadow: "0 8px 30px rgba(212,175,55,0.25)" }} />
          </div>
        </Reveal>
        <Reveal delay={1}>
          <h2 style={{ fontFamily: "'Cairo', sans-serif", fontSize: "clamp(2rem, 4vw, 3.2rem)", fontWeight: 900, color: "#EAECEF", marginBottom: "1rem", letterSpacing: "-0.5px" }}>
            السوق لا ينتظر أحداً
          </h2>
        </Reveal>
        <Reveal delay={2}>
          <p style={{ color: "#6B7280", fontSize: "1rem", lineHeight: 1.85, marginBottom: "2.5rem", fontFamily: "'Cairo', sans-serif" }}>
            ليس كل من يتداول يربح — نحن نعلمك الفرق. انضم الآن وابدأ التداول بعلم حقيقي.
          </p>
        </Reveal>
        <Reveal delay={3}>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="/signup"
              style={{
                background: "linear-gradient(135deg, #D4AF37 0%, #C9A227 100%)",
                color: "#060809",
                padding: "1rem 2.8rem",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: 900,
                fontSize: "1rem",
                boxShadow: "0 8px 30px rgba(212,175,55,0.35)",
                transition: "all 0.25s ease",
                display: "inline-block",
                fontFamily: "'Cairo', sans-serif",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 50px rgba(212,175,55,0.5)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(212,175,55,0.35)"; }}
            >
              انضم الآن — $300
            </a>
            <a
              href="mailto:qaisalraifai@gmail.com"
              style={{
                border: "1px solid rgba(212,175,55,0.25)",
                color: "#EAECEF",
                padding: "1rem 2rem",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "0.95rem",
                transition: "all 0.25s ease",
                display: "inline-block",
                background: "rgba(212,175,55,0.04)",
                fontFamily: "'Cairo', sans-serif",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,175,55,0.5)"; (e.currentTarget as HTMLElement).style.background = "rgba(212,175,55,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,175,55,0.25)"; (e.currentTarget as HTMLElement).style.background = "rgba(212,175,55,0.04)"; }}
            >
              تواصل معنا
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer
      style={{
        background: "#060809",
        borderTop: "1px solid rgba(212,175,55,0.08)",
        padding: "4rem 2rem 2rem",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "3rem", marginBottom: "3rem" }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <img src="/manus-storage/qta-logo_d0cf1363.jpg" alt="QTA" style={{ width: "36px", height: "36px", borderRadius: "6px", objectFit: "cover" }} />
              <div>
                <div style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 900, fontSize: "0.88rem", color: "#EAECEF" }}>Qais Trading Academy</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.5rem", color: "#D4AF37", letterSpacing: "3px" }}>QTA</div>
              </div>
            </div>
            <p style={{ color: "#555", fontSize: "0.8rem", lineHeight: 1.7, fontFamily: "'Cairo', sans-serif" }}>
              أكاديمية التداول الاحترافية — نعلمك كيف تقرأ السوق بثقة وعلم.
            </p>
          </div>

          <div>
            <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "0.65rem", color: "#D4AF37", marginBottom: "1rem", letterSpacing: "2px" }}>NAVIGATION</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {[
                { label: "المنهج", href: "#curriculum" },
                { label: "طريقة التعلم", href: "#features" },
                { label: "الأسعار", href: "#pricing" },
                { label: "الأسئلة الشائعة", href: "#faq" },
              ].map((link) => (
                <a key={link.label} href={link.href} style={{ color: "#555", textDecoration: "none", fontSize: "0.82rem", transition: "color 0.2s", fontFamily: "'Cairo', sans-serif" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#D4AF37")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "0.65rem", color: "#D4AF37", marginBottom: "1rem", letterSpacing: "2px" }}>LEGAL</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {[
                { label: "الشروط والأحكام", href: "/terms" },
                { label: "سياسة الخصوصية", href: "/privacy" },
                { label: "سياسة الاسترجاع", href: "/refund-policy" },
              ].map((link) => (
                <a key={link.label} href={link.href} style={{ color: "#555", textDecoration: "none", fontSize: "0.82rem", transition: "color 0.2s", fontFamily: "'Cairo', sans-serif" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#D4AF37")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "0.65rem", color: "#D4AF37", marginBottom: "1rem", letterSpacing: "2px" }}>CONTACT</h4>
            <a href="mailto:qaisalraifai@gmail.com" style={{ color: "#555", textDecoration: "none", fontSize: "0.8rem", display: "block", marginBottom: "0.75rem", transition: "color 0.2s", fontFamily: "'JetBrains Mono', monospace" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#D4AF37")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
            >
              qaisalraifai@gmail.com
            </a>
            <p style={{ color: "#333", fontSize: "0.72rem", lineHeight: 1.6, fontFamily: "'Cairo', sans-serif" }}>
              التداول ينطوي على مخاطر. لا تستثمر أكثر مما تستطيع تحمل خسارته.
            </p>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(212,175,55,0.07)", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", color: "#333" }}>
            © {new Date().getFullYear()} Qais Trading Academy — All Rights Reserved
          </p>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            {["Terms", "Privacy", "Refund"].map((label, i) => (
              <a key={label} href={["/terms", "/privacy", "/refund-policy"][i]} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", color: "#333", textDecoration: "none", transition: "color 0.2s", letterSpacing: "1px" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#D4AF37")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#333")}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div style={{ background: "#060809", minHeight: "100vh", direction: "rtl" }}>
      <Navbar />
      <HeroSection />
      <CurriculumSection />
      <FeaturesSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  );
}
