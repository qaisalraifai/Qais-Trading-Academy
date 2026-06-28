"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }

    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { phone, country } },
    });

    if (signUpError) {
      setError(signUpError.message === "User already registered" ? "هذا الإيميل مسجل مسبقاً" : "حدث خطأ، حاول مرة أخرى");
      setLoading(false);
      return;
    }

    await supabase.auth.signInWithPassword({ email, password });
    router.push("/payment");
  }

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Hero Section */}
      <div style={s.hero}>
        <div style={s.heroInner}>
          <p style={s.eyebrow}>QAIS TRADING ACADEMY</p>
          <h1 style={s.heroTitle}>ابدأ رحلتك في التداول الاحترافي</h1>
          <p style={s.heroSub}>
            منهج تداول كامل من الأساسيات حتى الاحترافية — محاضرات لايف ومسجلة،
            تدريب عملي 6 أشهر على حساب ديمو، وBacktest حقيقي لكل استراتيجية.
          </p>

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

          {/* Pricing Card */}
          <div style={s.priceCard}>
            <div style={s.priceTop}>
              <p style={s.priceLabel}>سعر الاشتراك</p>
              <div style={s.priceRow}>
                <span style={s.priceNum}>300</span>
                <span style={s.priceCurrency}>USD</span>
              </div>
              <p style={s.priceNote}>* التجديد الشهري بعد انتهاء الاشتراك: $100 فقط</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div style={s.formSection}>
        <div style={s.card}>
          <p style={s.formEyebrow}>QTA</p>
          <h2 style={s.formTitle}>إنشاء حساب جديد</h2>
          <p style={s.formSub}>أنشئ حسابك وانتقل لصفحة الدفع</p>

          <div style={s.form}>
            <div style={s.field}>
              <label style={s.label}>البريد الإلكتروني</label>
              <input style={s.input} type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>رقم الهاتف</label>
              <input style={s.input} type="tel" placeholder="+962 79 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>بلد الإقامة</label>
              <input style={s.input} type="text" placeholder="الأردن، السعودية، الإمارات..." value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>كلمة المرور</label>
              <input style={s.input} type="password" placeholder="6 أحرف على الأقل" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div style={s.field}>
              <label style={s.label}>تأكيد كلمة المرور</label>
              <input style={s.input} type="password" placeholder="أعد كتابة كلمة المرور" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>

            {error && <p style={s.error}>{error}</p>}

            <button onClick={handleSignup} disabled={loading} style={s.btn}>
              {loading ? "جاري الإنشاء..." : "إنشاء الحساب والمتابعة للدفع ←"}
            </button>
          </div>

          <p style={s.linkText}>عندك حساب؟ <Link href="/login" style={s.link}>سجل دخول</Link></p>
        </div>
      </div>
    </div>
  );
}

const gold = "#C9A24B";
const s = {
  page: { backgroundColor: "#050505", minHeight: "100vh", direction: "rtl", fontFamily: "'Inter', sans-serif" },

  hero: { backgroundColor: "#080808", borderBottom: "1px solid #141414", padding: "5rem 3rem" },
  heroInner: { maxWidth: "700px", margin: "0 auto" },
  eyebrow: { fontFamily: "'JetBrains Mono', monospace", color: gold, fontSize: "0.75rem", letterSpacing: "3px", marginBottom: "1.5rem" },
  heroTitle: { fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, color: "#E8E0D0", lineHeight: 1.2, marginBottom: "1.25rem", letterSpacing: "-0.5px" },
  heroSub: { color: "#6B6560", fontSize: "1rem", lineHeight: 1.85, marginBottom: "2.5rem" },

  features: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem", marginBottom: "2.5rem" },
  featureItem: { display: "flex", alignItems: "center", gap: "0.6rem", color: "#C8C0B0", fontSize: "0.88rem" },
  featureDot: { color: gold, fontSize: "0.55rem", flexShrink: 0 },

  priceCard: { backgroundColor: "#0d0d0d", border: `1px solid ${gold}33`, borderRadius: "8px", padding: "2rem 2.5rem", display: "inline-block" },
  priceTop: {},
  priceLabel: { fontFamily: "'JetBrains Mono', monospace", color: "#555", fontSize: "0.75rem", letterSpacing: "2px", marginBottom: "0.75rem" },
  priceRow: { display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.75rem" },
  priceNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: "3.5rem", fontWeight: 700, color: gold },
  priceCurrency: { color: "#888", fontSize: "1.1rem" },
  priceNote: { color: "#444", fontSize: "0.8rem" },

  formSection: { padding: "4rem 3rem", display: "flex", justifyContent: "center" },
  card: { backgroundColor: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "3rem 2.5rem", width: "100%", maxWidth: "480px" },
  formEyebrow: { fontFamily: "'JetBrains Mono', monospace", color: gold, fontSize: "0.75rem", letterSpacing: "3px", marginBottom: "1rem", textAlign: "center" },
  formTitle: { fontSize: "1.75rem", fontWeight: 800, color: "#E8E0D0", textAlign: "center", marginBottom: "0.5rem" },
  formSub: { color: "#555", fontSize: "0.9rem", textAlign: "center", marginBottom: "2rem" },

  form: { display: "flex", flexDirection: "column", gap: "1.25rem" },
  field: { display: "flex", flexDirection: "column", gap: "0.4rem" },
  label: { color: "#888", fontSize: "0.82rem" },
  input: { backgroundColor: "#080808", border: "1px solid #1e1e1e", color: "#E8E0D0", padding: "0.75rem 1rem", borderRadius: "4px", fontSize: "0.95rem", outline: "none", direction: "ltr", textAlign: "right" },
  btn: { backgroundColor: gold, color: "#080600", padding: "1rem", borderRadius: "4px", border: "none", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", marginTop: "0.5rem" },
  error: { color: "#ef4444", fontSize: "0.85rem", textAlign: "center" },
  linkText: { color: "#444", fontSize: "0.85rem", textAlign: "center", marginTop: "1.5rem" },
  link: { color: gold, textDecoration: "none" },
};
