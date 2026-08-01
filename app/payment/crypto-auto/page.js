"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import QrCodeBox from "../components/QrCodeBox";

const gold = "#D4AF37";

export default function CryptoAutoPaymentPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState("loading"); // loading | pick-currency | pay | error
  const [error, setError] = useState("");
  const [currencies, setCurrencies] = useState([]);
  const [plan, setPlan] = useState(null);
  const [transactionId, setTransactionId] = useState(null);

  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const [payment, setPayment] = useState(null); // { payAddress, payAmount, payCurrency, payinExtraId, expiresAt }
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [copied, setCopied] = useState(false);
  const [txStatus, setTxStatus] = useState("pending");
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    startCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCheckout() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerCode: "nowpayments" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر بدء عملية الدفع");

      setPlan(data.plan);
      setTransactionId(data.transactionId);
      setCurrencies(data.checkout?.currencies || []);
      setStep("pick-currency");
    } catch (e) {
      setError(e.message);
      setStep("error");
    }
  }

  async function pickCurrency(currency) {
    setSelectedCurrency(currency);
    setCreatingPayment(true);
    setError("");
    try {
      const res = await fetch("/api/payments/nowpayments/select-currency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, payCurrency: currency.code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر إنشاء عملية الدفع");

      setPayment(data.payment);
      setStep("pay");
      startPolling();
      if (data.payment.expiresAt) startCountdown(data.payment.expiresAt);
    } catch (e) {
      setError(e.message);
      setSelectedCurrency(null);
    } finally {
      setCreatingPayment(false);
    }
  }

  function copyAddress() {
    if (!payment) return;
    navigator.clipboard.writeText(payment.payAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function startCountdown(expiresAt) {
    const end = new Date(expiresAt).getTime();
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff <= 0) clearInterval(interval);
    }, 1000);
  }

  function startPolling() {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/status?transactionId=${transactionId}`);
        const data = await res.json();
        if (!res.ok) return;
        setTxStatus(data.transaction.status);
        if (data.transaction.status === "succeeded") {
          clearInterval(interval);
          setTimeout(() => router.push("/dashboard"), 1500);
        }
      } catch {
        // نحاول تاني بالدورة الجاية
      }
    }, 5000);
    return () => clearInterval(interval);
  }

  function formatTime(sec) {
    if (sec === null) return null;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.logoText}>QTA</div>
        <p style={styles.logoSub}>دفع كريبتو تلقائي</p>
      </div>

      <div style={styles.card}>
        {step === "loading" && <p style={styles.note}>...جاري التحضير</p>}

        {step === "error" && (
          <>
            <p style={styles.configError}>⚠️ {error}</p>
            <Link href="/payment" style={styles.linkBtn}>← رجوع لصفحة الدفع</Link>
          </>
        )}

        {step === "pick-currency" && (
          <>
            <h2 style={styles.title}>
              {plan?.code === "signup" ? "اشتراك أول" : "تجديد شهري"} — ${plan?.amount} {plan?.currency}
            </h2>
            <p style={styles.subtitle}>اختر العملة اللي بدك تدفع فيها:</p>
            <div style={styles.currencyGrid}>
              {currencies.map((c) => (
                <button
                  key={c.code}
                  style={styles.currencyBtn}
                  onClick={() => pickCurrency(c)}
                  disabled={creatingPayment}
                >
                  <div style={{ fontWeight: "bold" }}>{c.label}</div>
                  <div style={{ fontSize: "0.72rem", color: "#888" }}>{c.network}</div>
                </button>
              ))}
            </div>
            {creatingPayment && <p style={styles.note}>...جاري إنشاء عملية الدفع</p>}
            {error && <p style={styles.configError}>{error}</p>}
          </>
        )}

        {step === "pay" && payment && (
          <>
            {txStatus === "succeeded" ? (
              <div style={{ textAlign: "center" }}>
                <div style={styles.spinnerIcon}>✅</div>
                <h2 style={styles.title}>تم تفعيل اشتراكك!</h2>
                <p style={styles.subtitle}>جاري تحويلك للوحة التحكم...</p>
              </div>
            ) : (
              <>
                <h2 style={styles.title}>حوّل {payment.payAmount} {payment.payCurrency?.toUpperCase()}</h2>
                <p style={styles.subtitle}>لهاد العنوان بالضبط، خلال الوقت المتبقي تحت:</p>
                <QrCodeBox value={payment.payAddress} size={160} />
                <div style={styles.addressBox}>
                  <code style={styles.addressText}>{payment.payAddress}</code>
                  <button onClick={copyAddress} style={styles.copyBtn}>{copied ? "✓ تم النسخ" : "نسخ"}</button>
                </div>
                {payment.payinExtraId && (
                  <p style={styles.warnNote}>⚠️ لازم تضيف Memo/Tag: <strong>{payment.payinExtraId}</strong> مع التحويل</p>
                )}
                {secondsLeft !== null && (
                  <p style={{ ...styles.note, color: secondsLeft < 120 ? "#FF9800" : "#666" }}>
                    الوقت المتبقي: {formatTime(secondsLeft)}
                  </p>
                )}
                <div style={styles.pendingBox}>
                  <div style={styles.spinnerIconSmall}>🕐</div>
                  <p style={styles.note}>عم ننتظر تأكيد الشبكة — بيتفعّل اشتراكك تلقائياً فور وصول التحويل، بدون أي تدخل يدوي.</p>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <Link href="/payment" style={{ ...styles.linkBtn, marginTop: "1rem" }}>← رجوع لخيارات الدفع</Link>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#181A20",
    color: "#fff",
    direction: "rtl",
    fontFamily: "'Georgia', serif",
    padding: "3rem 1.5rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  header: { textAlign: "center", marginBottom: "2rem" },
  logoText: { fontSize: "2.2rem", fontWeight: "bold", color: gold, letterSpacing: "6px" },
  logoSub: { color: "#888", fontSize: "0.85rem", marginTop: "0.4rem" },
  card: {
    backgroundColor: "#0f0f0f",
    border: `1px solid ${gold}`,
    borderRadius: "4px",
    padding: "2.5rem",
    width: "100%",
    maxWidth: "460px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.1rem",
    boxShadow: `0 0 60px ${gold}22`,
  },
  title: { fontSize: "1.2rem", fontWeight: "bold", textAlign: "center" },
  subtitle: { color: "#888", fontSize: "0.9rem", textAlign: "center", lineHeight: 1.6 },
  currencyGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem", width: "100%" },
  currencyBtn: {
    padding: "0.9rem 0.5rem",
    borderRadius: "6px",
    border: `1px solid ${gold}55`,
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "center",
  },
  addressBox: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    width: "100%",
    background: "#0b0b0b",
    border: "1px solid #2B2F36",
    borderRadius: 8,
    padding: "0.6rem 0.8rem",
  },
  addressText: { flex: 1, fontSize: "0.75rem", wordBreak: "break-all", color: "#ccc" },
  copyBtn: {
    background: "transparent",
    border: `1px solid ${gold}`,
    color: gold,
    borderRadius: 6,
    padding: "0.4rem 0.8rem",
    fontSize: "0.75rem",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  warnNote: { color: "#FF9800", fontSize: "0.78rem", textAlign: "center" },
  pendingBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem", marginTop: "0.5rem" },
  spinnerIcon: { fontSize: "3rem", marginBottom: "0.5rem" },
  spinnerIconSmall: { fontSize: "1.5rem" },
  linkBtn: { color: gold, fontSize: "0.85rem", textDecoration: "none" },
  configError: {
    color: "#F6465D",
    fontSize: "0.78rem",
    textAlign: "center",
    lineHeight: 1.7,
    background: "#F6465D14",
    border: "1px solid #F6465D44",
    borderRadius: 6,
    padding: "0.6rem 0.9rem",
  },
  note: { color: "#555", fontSize: "0.8rem", textAlign: "center" },
};
