"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { initializePaddle } from "@paddle/paddle-js";
import { createClient } from "@/lib/supabase-client";

export default function PaymentPage() {
  const [loading, setLoading] = useState(false);
  const [paddle, setPaddle] = useState(null);
  const [checkoutStarted, setCheckoutStarted] = useState(false); // لما تصير true، منعرض حاوية الدفع المدمجة
  const [configError, setConfigError] = useState(""); // خطأ إعدادات Paddle واضح، بدل شاشة "Something went wrong" الغامضة
  const supabase = createClient();

  // منحمّل Paddle.js مرة وحدة لما الصفحة تفتح
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) {
      // بدون توكن، Paddle.js أصلاً ما رح يشتغل - أفضل نوقف هون بدل ما نخلي
      // المستخدم يوصل لشاشة الدفع ويشوف خطأ Paddle الغامض "Something went wrong"
      setConfigError("متغير NEXT_PUBLIC_PADDLE_CLIENT_TOKEN غير مضبوط بإعدادات المشروع.");
      return;
    }
    initializePaddle({
      environment: process.env.NEXT_PUBLIC_PADDLE_ENV || "sandbox",
      token,
    })
      .then((instance) => {
        if (!instance) {
          setConfigError(
            "تعذّر تهيئة Paddle.js. تأكد إنه NEXT_PUBLIC_PADDLE_CLIENT_TOKEN صحيح، وإنه دومين الموقع مضاف بقائمة الدومينات المسموحة بلوحة تحكم Paddle."
          );
          return;
        }
        setPaddle(instance);
      })
      .catch((e) => {
        console.error("initializePaddle failed:", e);
        setConfigError("تعذّر تحميل Paddle.js: " + (e?.message || "خطأ غير معروف"));
      });
  }, []);

  async function handlePayment() {
    if (!paddle) return; // Paddle.js لسا ما حمّل، منستنى

    // لازم الـ price IDs تكون مضبوطة وإلا Paddle بيرفض فتح الدفع بخطأ عام
    // "Something went wrong" بدون ما يوضح السبب الحقيقي (price id غير موجود/غير
    // مفعّل، أو تابع لبيئة sandbox/production مختلفة عن اللي مضبوطة هون)
    const signupPriceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_SIGNUP;
    const monthlyPriceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY;
    if (!signupPriceId || !monthlyPriceId) {
      setConfigError(
        "متغيرات أسعار Paddle (NEXT_PUBLIC_PADDLE_PRICE_SIGNUP / NEXT_PUBLIC_PADDLE_PRICE_MONTHLY) غير مضبوطة."
      );
      return;
    }

    setLoading(true);

    // لازم نعرف مين المستخدم الحالي حتى نربط الدفعة فيه بالـ Webhook لاحقاً
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      window.location.href = "/login";
      return;
    }

    // منعرض حاوية الدفع أول شي حتى يصير عنصرها موجود فعلياً بالصفحة قبل ما نطلب من Paddle يعبيها
    setCheckoutStarted(true);

    // منستنى تيك واحد (frame) حتى React يخلص يرسم الـ div الجديدة، وبعدين منفتح الدفع المدمج جواها
    requestAnimationFrame(() => {
      paddle.Checkout.open({
        items: [
          { priceId: signupPriceId, quantity: 1 },
          { priceId: monthlyPriceId, quantity: 1 },
        ],
        customer: { email: user.email },
        customData: { user_id: user.id }, // Webhook بيستخدمها حتى يعرف مين المستخدم يفعّل اشتراكه
        settings: {
          displayMode: "inline", // مدمجة بالصفحة بدل نافذة منبثقة
          frameTarget: "paddle-checkout-container", // اسم الـ class تبع الحاوية تحت
          frameInitialHeight: "450",
          frameStyle:
            "width: 100%; min-width: 312px; background-color: transparent; border: none;",
          theme: "dark",
          successUrl: `${window.location.origin}/payment-success?type=subscription`,
        },
      });
      setLoading(false);
    });
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.logoText}>QTA</div>
        <p style={styles.logoSub}>QAIS TRADING ACADEMY</p>
        <div style={styles.divider} />
        <h1 style={styles.title}>انضم للأكاديمية</h1>
        <p style={styles.subtitle}>طوّر مهاراتك وابدأ رحلتك التعليمية في عالم التداول</p>
      </div>

      <div style={styles.card}>
        <div style={styles.cardIcon}>👑</div>
        <h2 style={styles.cardTitle}>عضوية Qais Trading Academy</h2>
        <div style={styles.priceBox}>
          <span style={styles.currency}>$</span>
          <span style={styles.amount}>300</span>
          <span style={styles.period}>عند التسجيل</span>
        </div>
        <ul style={styles.features}>
          <li style={styles.feature}><span style={styles.check}>◆</span> وصول فوري لجميع المحاضرات</li>
          <li style={styles.feature}><span style={styles.check}>◆</span> عضوية Discord الحصرية</li>
          <li style={styles.feature}><span style={styles.check}>◆</span> دعم مباشر من المدرب</li>
          <li style={styles.feature}><span style={styles.check}>◆</span> شروحات وتحليلات تعليمية حصرية</li>
        </ul>

        {!checkoutStarted && (
          <button style={styles.btn} onClick={handlePayment} disabled={loading || !paddle || !!configError}>
            {loading ? "جاري التحويل..." : !paddle && !configError ? "جاري التحميل..." : "ادفع $300 وابدأ الاشتراك"}
          </button>
        )}

        {configError && (
          <p style={styles.configError}>
            ⚠️ إعدادات الدفع ناقصة: {configError} راجع متغيرات البيئة (Environment Variables) بإعدادات النشر.
          </p>
        )}

        {/* حاوية الدفع المدمجة — Paddle بيعبيها بنفسه لما checkoutStarted تصير true */}
        {checkoutStarted && (
          <div className="paddle-checkout-container" style={styles.checkoutContainer} />
        )}

        <p style={styles.note}>
          بعد $300 رسوم التسجيل، بينسحب تلقائياً <strong style={{ color: "#D4AF37" }}>$100 كل شهر</strong> من نفس البطاقة لحد ما تلغي الاشتراك.
        </p>
        <p style={styles.taxNote}>
          الأسعار المعروضة قابلة لتطبيق ضرائب حسب موقعك — بيتم احتسابها وعرضها بوضوح قبل إتمام الدفع.
        </p>
      </div>

      <p style={styles.footer}>🔒 جميع المدفوعات مؤمنة عبر Paddle · يمكنك الإلغاء بأي وقت</p>

      {/* رابط الأدمن المخفي */}
      <Link href="/admin" style={styles.adminLink}>⚙</Link>
    </div>
  );
}

const gold = "#D4AF37";

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#181A20",
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
    borderTop: "1px solid #2B2F36",
    borderBottom: "1px solid #2B2F36",
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
  checkoutContainer: {
    width: "100%",
    minHeight: "450px",
  },
  note: { color: "#555", fontSize: "0.8rem", textAlign: "center", lineHeight: 1.6 },
  configError: { color: "#F6465D", fontSize: "0.78rem", textAlign: "center", lineHeight: 1.7, background: "#F6465D14", border: "1px solid #F6465D44", borderRadius: 6, padding: "0.75rem 1rem" },
  taxNote: { color: "#3a3a3a", fontSize: "0.72rem", textAlign: "center", lineHeight: 1.5, marginTop: "-0.75rem" },
  footer: { color: "#333", fontSize: "0.8rem", marginTop: "1.5rem" },
  adminLink: {
    position: "fixed",
    bottom: "1rem",
    left: "1rem",
    color: "#2B2F36",
    fontSize: "1rem",
    textDecoration: "none",
    opacity: 0.3,
    transition: "opacity 0.3s",
  },
};
