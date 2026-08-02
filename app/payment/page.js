"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import { createClient } from "@/lib/supabase-client";

export default function PaymentPage() {
  const router = useRouter();
  const supabase = createClient();

  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);

  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const [configError, setConfigError] = useState("");

  useEffect(() => {
    fetch("/api/payments/methods")
      .then((r) => r.json())
      .then((data) => setProviders(data.providers || []))
      .finally(() => setLoadingProviders(false));
  }, []);

  async function handlePayment(providerCode) {
    setConfigError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    // الدفع اليدوي بالكريبتو إله صفحة تدفق خاصة (اختيار شبكة + رفع إثبات)
    if (providerCode === "manual_usdt") {
      router.push("/payment/crypto");
      return;
    }

    // الكريبتو التلقائي (NOWPayments) إله صفحة تدفق داخل موقعنا بالكامل
    // (اختيار عملة → عنوان دفع + QR → تفعيل فوري)، بدون تحويل لصفحة خارجية
    if (providerCode === "nowpayments") {
      router.push("/payment/crypto-auto");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConfigError(data.error || "تعذر بدء عملية الدفع.");
        setLoading(false);
        return;
      }

      if (data.checkout?.mode === "embed") {
        setSessionId(data.checkout.sessionId);
        setCheckoutStarted(true);
      } else if (data.checkout?.mode === "redirect" && data.checkout?.url) {
        window.location.href = data.checkout.url;
      } else {
        setConfigError("رد غير متوقع من مزوّد الدفع.");
      }
    } catch (e) {
      setConfigError("تعذر الاتصال بخادم الدفع: " + (e?.message || "خطأ غير معروف"));
    } finally {
      setLoading(false);
    }
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
          <div style={styles.providerList}>
            {loadingProviders ? (
              <p style={styles.note}>...جاري تحميل وسائل الدفع</p>
            ) : providers.length === 0 ? (
              <p style={styles.configError}>⚠️ ما في وسائل دفع مفعّلة حالياً — تواصل مع الدعم.</p>
            ) : (
              providers.map((p) => (
                <button key={p.code} style={styles.providerBtn} onClick={() => handlePayment(p.code)} disabled={loading}>
                  <div style={styles.providerBtnMain}>
                    <span>{providerIcon(p.type)} {p.name}</span>
                    {loading && <span style={{ fontSize: "0.75rem" }}>جاري التحويل...</span>}
                  </div>
                  {p.description && <div style={styles.providerBtnDesc}>{p.description}</div>}
                </button>
              ))
            )}
          </div>
        )}

        {configError && (
          <p style={styles.configError}>
            ⚠️ إعدادات الدفع ناقصة: {configError} راجع متغيرات البيئة (Environment Variables) بإعدادات النشر.
          </p>
        )}

        {checkoutStarted && sessionId && (
          <div style={styles.checkoutContainer}>
            <WhopCheckoutEmbed
              sessionId={sessionId}
              returnUrl={typeof window !== "undefined" ? `${window.location.origin}/payment-success?type=subscription` : undefined}
              environment={process.env.NEXT_PUBLIC_WHOP_SANDBOX === "true" ? "sandbox" : "production"}
              theme="dark"
            />
          </div>
        )}

        <p style={styles.note}>
          بعد $300 رسوم التسجيل، بينسحب تلقائياً <strong style={{ color: "#E8B86D" }}>$100 كل شهر</strong> (بالبطاقة) أو بيتوجب عليك التجديد يدوياً كل شهر (بالكريبتو) لحد ما تلغي الاشتراك.
        </p>
        <p style={styles.taxNote}>
          الأسعار المعروضة قابلة لتطبيق ضرائب حسب موقعك — بيتم احتسابها وعرضها بوضوح قبل إتمام الدفع.
        </p>
      </div>

      <p style={styles.footer}>🔒 جميع المدفوعات مؤمنة · يمكنك الإلغاء بأي وقت</p>

      <Link href="/admin" style={styles.adminLink}>⚙</Link>
    </div>
  );
}

function providerIcon(type) {
  if (type === "card") return "💳";
  if (type === "crypto_manual" || type === "crypto_auto") return "🪙";
  return "💰";
}

const gold = "#E8B86D";

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0D0E10",
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
  providerList: { width: "100%", display: "flex", flexDirection: "column", gap: "0.75rem" },
  providerBtn: {
    width: "100%",
    padding: "0.9rem 1rem",
    borderRadius: "6px",
    border: `1px solid ${gold}55`,
    backgroundColor: "transparent",
    color: "#fff",
    fontSize: "0.95rem",
    fontWeight: "bold",
    cursor: "pointer",
    textAlign: "right",
    fontFamily: "inherit",
  },
  providerBtnMain: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  providerBtnDesc: { color: "#777", fontSize: "0.75rem", fontWeight: "normal", marginTop: "0.3rem" },
  checkoutContainer: {
    width: "100%",
    minHeight: "450px",
  },
  note: { color: "#555", fontSize: "0.8rem", textAlign: "center", lineHeight: 1.6 },
  configError: { color: "#E5484D", fontSize: "0.78rem", textAlign: "center", lineHeight: 1.7, background: "#E5484D14", border: "1px solid #E5484D44", borderRadius: 6, padding: "0.75rem 1rem" },
  taxNote: { color: "#26282C", fontSize: "0.72rem", textAlign: "center", lineHeight: 1.5, marginTop: "-0.75rem" },
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
