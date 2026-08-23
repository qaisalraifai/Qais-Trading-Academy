"use client";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { readJson } from "@/lib/http-json";
import QrCodeBox from "../components/QrCodeBox";

const gold = "#DCD4F7";

export default function CryptoPaymentPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState("loading"); // loading | pick-network | submit-proof | pending | error
  const [error, setError] = useState("");
  const [wallets, setWallets] = useState([]);
  const [plan, setPlan] = useState(null);
  const [transactionId, setTransactionId] = useState(null);

  const [selectedWallet, setSelectedWallet] = useState(null);
  const [txid, setTxid] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [txStatus, setTxStatus] = useState("pending");
  const [rejectionReason, setRejectionReason] = useState(null);

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
        body: JSON.stringify({ providerCode: "manual_usdt" }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "تعذر بدء عملية الدفع");

      setPlan(data.plan);
      setTransactionId(data.transactionId);
      setWallets(data.checkout?.wallets || []);
      setStep("pick-network");
    } catch (e) {
      setError(e.message);
      setStep("error");
    }
  }

  function copyAddress() {
    if (!selectedWallet) return;
    navigator.clipboard.writeText(selectedWallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function submitProof() {
    if (!txid && !file) {
      setError("لازم تدخل رقم العملية (TXID) أو ترفع صورة إثبات على الأقل");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("transactionId", transactionId);
      formData.append("walletId", selectedWallet.id);
      formData.append("network", selectedWallet.network);
      if (txid) formData.append("txid", txid);
      if (file) formData.append("file", file);

      const res = await fetch("/api/payments/manual/submit", { method: "POST", body: formData });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "تعذر إرسال إثبات الدفع");

      setStep("pending");
      pollStatus();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function pollStatus() {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/status?transactionId=${transactionId}`);
        const data = await readJson(res);
        if (!res.ok) return;
        setTxStatus(data.transaction.status);
        if (data.transaction.status === "succeeded") {
          clearInterval(interval);
          setTimeout(() => router.push("/dashboard"), 1500);
        } else if (data.transaction.status === "rejected") {
          clearInterval(interval);
          setRejectionReason(data.transaction.rejection_reason);
        }
      } catch {
        // تجاهل — منحاول تاني بالدورة الجاية
      }
    }, 5000);
    return () => clearInterval(interval);
  }

  const walletsByNetwork = groupBy(wallets, "network");

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.logoText}>QTA</div>
        <p style={styles.logoSub}>الدفع بالـ USDT</p>
      </div>

      <div style={styles.card}>
        {step === "loading" && <p style={styles.note}>...جاري التحضير</p>}

        {step === "error" && (
          <>
            <p style={styles.configError}>{error}</p>
            <Link href="/payment" style={styles.linkBtn}>← رجوع لصفحة الدفع</Link>
          </>
        )}

        {step === "pick-network" && (
          <>
            <h2 style={styles.title}>
              {plan?.code === "signup" ? "اشتراك أول" : "تجديد شهري"} — ${plan?.amount} {plan?.currency}
            </h2>

            {!selectedWallet ? (
              <>
                <p style={styles.subtitle}>اختر الشبكة اللي بدك تحوّل عليها:</p>
                <div style={styles.networkGrid}>
                  {Object.entries(walletsByNetwork).map(([network, list]) => (
                    <button key={network} style={styles.networkBtn} onClick={() => setSelectedWallet(list[0])}>{network}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p style={styles.subtitle}>حوّل {plan?.amount} USDT بالضبط لهاد العنوان عبر شبكة {selectedWallet.network}:</p>
                <QrCodeBox value={selectedWallet.address} size={160} />
                <div style={styles.addressBox}>
                  <code style={styles.addressText}>{selectedWallet.address}</code>
                  <button onClick={copyAddress} style={styles.copyBtn}>{copied ? "✓ تم النسخ" : "نسخ"}</button>
                </div>
                <p style={styles.warnNote}>تأكد إنك بتحوّل على شبكة {selectedWallet.network} بالضبط، وإلا بتضيع الحوالة.</p>

                <div style={styles.formBox}>
                  <label style={styles.label}>رقم العملية (TXID)</label>
                  <input
                    value={txid}
                    onChange={(e) => setTxid(e.target.value)}
                    placeholder="اختياري إذا رفعت صورة الإثبات"
                    style={styles.input}
                  />
                  <label style={styles.label}>صورة إثبات التحويل</label>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} style={styles.input} />

                  {error && <p style={styles.configError}>{error}</p>}

                  <button onClick={submitProof} disabled={submitting} style={styles.submitBtn}>
                    {submitting ? "...جاري الإرسال" : "إرسال للمراجعة"}
                  </button>
                  <button onClick={() => setSelectedWallet(null)} style={styles.linkBtnInline}>← تغيير الشبكة</button>
                </div>
              </>
            )}
          </>
        )}

        {step === "pending" && (
          <div style={{ textAlign: "center" }}>
            {txStatus === "pending" && (
              <>
                <div style={styles.spinnerIcon}><Clock size={14} aria-hidden /></div>
                <h2 style={styles.title}>بانتظار مراجعة الأدمن</h2>
                <p style={styles.subtitle}>استلمنا إثبات التحويل. بيتفعّل اشتراكك تلقائياً فور الموافقة (عادة خلال ساعات قليلة).</p>
              </>
            )}
            {txStatus === "succeeded" && (
              <>
                <div style={styles.spinnerIcon}><CheckCircle2 size={14} aria-hidden /></div>
                <h2 style={styles.title}>تم تفعيل اشتراكك!</h2>
                <p style={styles.subtitle}>جاري تحويلك للوحة التحكم...</p>
              </>
            )}
            {txStatus === "rejected" && (
              <>
                <div style={styles.spinnerIcon}><XCircle size={14} aria-hidden /></div>
                <h2 style={styles.title}>تعذّرت مراجعة الدفعة</h2>
                {rejectionReason && <p style={styles.configError}>السبب: {rejectionReason}</p>}
                <button
                  onClick={() => {
                    setStep("pick-network");
                    setTxStatus("pending");
                    setTxid("");
                    setFile(null);
                  }}
                  style={styles.submitBtn}
                >
                  حاول مرة ثانية
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <Link href="/payment" style={{ ...styles.linkBtn, marginTop: "1rem" }}>← رجوع لخيارات الدفع</Link>
    </div>
  );
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    (acc[item[key]] = acc[item[key]] || []).push(item);
    return acc;
  }, {});
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0E0A1A",
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
  logoSub: { color: "#6E6690", fontSize: "0.85rem", marginTop: "0.4rem" },
  card: {
    backgroundColor: "#0A0614",
    border: `1px solid ${gold}`,
    borderRadius: "3px",
    padding: "2.5rem",
    width: "100%",
    maxWidth: "460px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.25rem",
    boxShadow: `0 0 60px ${gold}22`,
  },
  title: { fontSize: "1.2rem", fontWeight: "bold", textAlign: "center" },
  subtitle: { color: "#6E6690", fontSize: "0.9rem", textAlign: "center", lineHeight: 1.6 },
  networkGrid: { display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center", width: "100%" },
  networkBtn: {
    padding: "0.9rem 1.5rem",
    borderRadius: "3px",
    border: `1px solid ${gold}55`,
    background: "transparent",
    color: "#fff",
    fontSize: "0.95rem",
    fontWeight: "bold",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  addressBox: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    width: "100%",
    background: "#0A0614",
    border: "1px solid #241C3E",
    borderRadius: 3,
    padding: "0.6rem 0.8rem",
  },
  addressText: { flex: 1, fontSize: "0.75rem", wordBreak: "break-all", color: "#A79FC4" },
  copyBtn: {
    background: "transparent",
    border: `1px solid ${gold}`,
    color: gold,
    borderRadius: 3,
    padding: "0.4rem 0.8rem",
    fontSize: "0.75rem",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  warnNote: { color: "#FF9800", fontSize: "0.78rem", textAlign: "center" },
  formBox: { width: "100%", display: "flex", flexDirection: "column", gap: "0.6rem" },
  label: { color: "#6E6690", fontSize: "0.78rem" },
  input: {
    background: "#0A0614",
    border: "1px solid #241C3E",
    color: "#fff",
    borderRadius: 3,
    padding: "0.6rem 0.8rem",
    fontSize: "0.85rem",
    fontFamily: "inherit",
  },
  submitBtn: {
    marginTop: "0.5rem",
    padding: "0.8rem",
    borderRadius: 3,
    border: "none",
    background: gold,
    color: "#141024",
    fontWeight: "bold",
    fontSize: "0.9rem",
    cursor: "pointer",
  },
  linkBtn: { color: gold, fontSize: "0.85rem", textDecoration: "none" },
  linkBtnInline: { background: "none", border: "none", color: gold, fontSize: "0.8rem", cursor: "pointer", textAlign: "center" },
  spinnerIcon: { fontSize: "3rem", marginBottom: "0.5rem" },
  configError: {
    color: "#FF453A",
    fontSize: "0.78rem",
    textAlign: "center",
    lineHeight: 1.7,
    background: "#FF453A14",
    border: "1px solid #FF453A44",
    borderRadius: 3,
    padding: "0.6rem 0.9rem",
  },
  note: { color: "#4A4368", fontSize: "0.85rem" },
};
