"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";

function useReveal() {
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
  return [ref, visible];
}

function Reveal({ children, delay = 0 }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(30px)",
      transition: `opacity 0.8s ease ${delay}s, transform 0.8s ease ${delay}s`,
    }}>
      {children}
    </div>
  );
}

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoY, setLogoY] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let frame;
    let start = null;
    const animate = (ts) => {
      if (!start) start = ts;
      const t = (ts - start) / 1000;
      setLogoY(Math.sin(t * 0.8) * 10);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) { setError("الرجاء إدخال الاسم"); return; }
    if (password !== confirmPassword) { setError("كلمتا المرور غير متطابقتين"); return; }
    setLoading(true);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { data: { phone, country, full_name: fullName } },
    });

    if (signUpError) {
      setError(signUpError.message === "User already registered" ? "هذا الإيميل مسجل مسبقاً" : "حدث خطأ، حاول مرة أخرى");
      setLoading(false);
      return;
    }

    const newUserId = signUpData?.user?.id;

    await supabase.auth.signInWithPassword({ email, password });

    // إنشاء/تحديث صف profiles باسم المستخدم
    if (newUserId) {
      await supabase.from("profiles").upsert({
        id: newUserId,
        username: fullName.trim(),
        role: "student",
        subscription_status: "inactive",
      });
    }

    router.push("/payment");
  }

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Floating background orbs */}
      <div style={{ ...s.orb, width: "500px", height: "500px", top: "-100px", left: "-150px", background: "radial-gradient(circle, #B8915A22 0%, transparent 70%)" }} />
      <div style={{ ...s.orb, width: "350px", height: "350px", top: "40%", right: "-100px", background: "radial-gradient(circle, #C9A24B18 0%, transparent 70%)" }} />
      <div style={{ ...s.orb, width: "250px", height: "250px", bottom: "10%", left: "30%", background: "radial-gradient(circle, #8B691412 0%, transparent 70%)" }} />

      {/* Header */}
      <header style={s.header}>
        <div style={s.logoBlock}>
          <img src="/logo.jpg" alt="QTA" style={s.logoImg} />
          <span style={s.logoText}>Qais Trading Academy</span>
        </div>
        <Link href="/login" style={s.loginLink}>تسجيل الدخول</Link>
      </header>

      {/* Hero */}
      <section style={s.hero}>
        <Reveal delay={0}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
            <img
              src="/logo.jpg"
              alt="QTA"
              style={{
                ...s.heroLogo,
                transform: `translateY(${logoY}px)`,
                transition: "transform 0.1s ease-out",
              }}
            />
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <p style={s.eyebrow}>QAIS TRADING ACADEMY</p>
        </Reveal>

        <Reveal delay={0.2}>
          <h1 style={s.heroTitle}>ابدأ رحلتك في<br /><span style={s.heroGold}>التداول الاحترافي</span></h1>
        </Reveal>

        <Reveal delay={0.3}>
          <p style={s.heroSub}>
            منهج تداول كامل من الأساسيات حتى الاحترافية — محاضرات لايف ومسجلة،
            تدريب عملي 6 أشهر على حساب ديمو، وBacktest حقيقي لكل استراتيجية.
          </p>
        </Reveal>

        <Reveal delay={0.4}>
          <div style={s.features}>
            {[
              "محاضرات لايف أسبوعية تفاعلية",
              "مكتبة محاضرات مسجلة منظمة",
              "تدريب 6 أشهر على حساب ديمو",
              "منهجيات ICT و SK و Elliott Wave",
              "Backtest مستمر لكل استراتيجية",
              "دعم مباشر من المدرب على Discord",
            ].map((f, i) => (
              <div key={i} style={s.featureItem}>
                <span style={s.featureDot}>◆</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.5}>
          <div style={s.priceCard}>
            <p style={s.priceLabel}>سعر الاشتراك</p>
            <div style={s.priceRow}>
              <span style={s.priceNum}>300</span>
              <span style={s.priceCurrency}>USD</span>
            </div>
            <p style={s.priceNote}>* التجديد الشهري بعد انتهاء الاشتراك: $100 فقط</p>
          </div>
        </Reveal>
      </section>

      {/* Form */}
      <section style={s.formSection}>
        <Reveal delay={0}>
          <div style={s.card}>
            <p style={s.formEyebrow}>QTA</p>
            <h2 style={s.formTitle}>إنشاء حساب جديد</h2>
            <p style={s.formSub}>أنشئ حسابك وانتقل لصفحة الدفع</p>

            <div style={s.form}>
              {[
                { label: "الاسم الكامل", type: "text", placeholder: "مثال: قيس الريفاعي", value: fullName, set: setFullName },
                { label: "البريد الإلكتروني", type: "email", placeholder: "example@email.com", value: email, set: setEmail },
                { label: "رقم الهاتف", type: "tel", placeholder: "+962 79 000 0000", value: phone, set: setPhone },
                { label: "بلد الإقامة", type: "text", placeholder: "الأردن، السعودية، الإمارات...", value: country, set: setCountry },
                { label: "كلمة المرور", type: "password", placeholder: "6 أحرف على الأقل", value: password, set: setPassword },
                { label: "تأكيد كلمة المرور", type: "password", placeholder: "أعد كتابة كلمة المرور", value: confirmPassword, set: setConfirmPassword },
              ].map((f, i) => (
                <div key={i} style={s.field}>
                  <label style={s.label}>{f.label}</label>
                  <input
                    style={s.input}
                    type={f.type}
                    placeholder={f.placeholder}
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    required={i !== 2 && i !== 3}
                  />
                </div>
              ))}

              {error && <p style={s.error}>{error}</p>}

              <button onClick={handleSignup} disabled={loading} style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}>
                {loading ? "جاري الإنشاء..." : "إنشاء الحساب والمتابعة للدفع ←"}
              </button>
            </div>

            <p style={s.linkText}>عندك حساب؟ <Link href="/login" style={s.link}>سجل دخول</Link></p>
          </div>
        </Reveal>
      </section>

      <footer style={s.footer}>
        © {new Date().getFullYear()} Qais Trading Academy — جميع الحقوق محفوظة
      </footer>
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
  loginLink: { color: "#6B6560", textDecoration: "none", fontSize: "0.9rem" },

  hero: { position: "relative", zIndex: 1, maxWidth: "680px", margin: "0 auto", padding: "5rem 3rem 3rem", textAlign: "center" },
  heroLogo: { width: "100px", height: "100px", objectFit: "cover", borderRadius: "50%", border: `2px solid ${gold}44`, boxShadow: `0 0 40px ${gold}33` },
  eyebrow: { fontFamily: "'JetBrains Mono', monospace", color: gold, fontSize: "0.72rem", letterSpacing: "3px", marginBottom: "1.25rem" },
  heroTitle: { fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 900, lineHeight: 1.2, marginBottom: "1.25rem", letterSpacing: "-0.5px" },
  heroGold: { color: gold, fontStyle: "italic" },
  heroSub: { color: "#6B6560", fontSize: "1rem", lineHeight: 1.85, marginBottom: "2.5rem" },

  features: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem", marginBottom: "2.5rem", textAlign: "right" },
  featureItem: { display: "flex", alignItems: "center", gap: "0.6rem", color: "#C8C0B0", fontSize: "0.88rem" },
  featureDot: { color: gold, fontSize: "0.5rem", flexShrink: 0 },

  priceCard: { backgroundColor: "#0d0d0d", border: `1px solid ${gold}44`, borderRadius: "8px", padding: "2rem 2.5rem", display: "inline-block", textAlign: "center" },
  priceLabel: { fontFamily: "'JetBrains Mono', monospace", color: "#555", fontSize: "0.72rem", letterSpacing: "2px", marginBottom: "0.75rem" },
  priceRow: { display: "flex", alignItems: "baseline", gap: "0.5rem", justifyContent: "center", marginBottom: "0.75rem" },
  priceNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: "3.5rem", fontWeight: 700, color: gold },
  priceCurrency: { color: "#888", fontSize: "1.1rem" },
  priceNote: { color: "#444", fontSize: "0.78rem" },

  formSection: { position: "relative", zIndex: 1, padding: "3rem", display: "flex", justifyContent: "center" },
  card: { backgroundColor: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "3rem 2.5rem", width: "100%", maxWidth: "500px" },
  formEyebrow: { fontFamily: "'JetBrains Mono', monospace", color: gold, fontSize: "0.72rem", letterSpacing: "3px", marginBottom: "1rem", textAlign: "center" },
  formTitle: { fontSize: "1.6rem", fontWeight: 800, color: "#E8E0D0", textAlign: "center", marginBottom: "0.4rem" },
  formSub: { color: "#555", fontSize: "0.88rem", textAlign: "center", marginBottom: "2rem" },

  form: { display: "flex", flexDirection: "column", gap: "1.25rem" },
  field: { display: "flex", flexDirection: "column", gap: "0.4rem" },
  label: { color: "#888", fontSize: "0.8rem" },
  input: { backgroundColor: "#080808", border: "1px solid #1e1e1e", color: "#E8E0D0", padding: "0.8rem 1rem", borderRadius: "4px", fontSize: "0.95rem", outline: "none", direction: "ltr", textAlign: "right" },
  btn: { backgroundColor: gold, color: "#080600", padding: "1rem", borderRadius: "4px", border: "none", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", marginTop: "0.5rem" },
  error: { color: "#ef4444", fontSize: "0.85rem", textAlign: "center" },
  linkText: { color: "#444", fontSize: "0.85rem", textAlign: "center", marginTop: "1.5rem" },
  link: { color: gold, textDecoration: "none" },

  footer: { position: "relative", zIndex: 1, textAlign: "center", padding: "2rem", color: "#222", fontSize: "0.8rem", fontFamily: "'JetBrains Mono', monospace", borderTop: "1px solid #111", marginTop: "2rem" },
};
