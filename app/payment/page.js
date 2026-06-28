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
      <h1 style={styles.title}>Qais Trading Academy</h1>
      <p style={styles.subtitle}>اختر خطة الاشتراك المناسبة لك</p>

      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.badge}>مرة واحدة</div>
          <h2 style={styles.planTitle}>تسجيل أولي</h2>
          <div style={styles.price}>$300</div>
          <p style={styles.desc}>دفعة تسجيل لمرة واحدة للانضمام للأكاديمية</p>
          <ul style={styles.features}>
            <li>✅ وصول فوري للمحتوى</li>
            <li>✅ عضوية في Discord</li>
            <li>✅ دعم مباشر</li>
          </ul>
          <button
            style={styles.button}
            onClick={() => handlePayment("registration")}
            disabled={loading === "registration"}
          >
            {loading === "registration" ? "جاري التحويل..." : "ادفع $300"}
          </button>
        </div>

        <div style={{ ...styles.card, borderColor: "#f59e0b" }}>
          <div style={{ ...styles.badge, backgroundColor: "#f59e0b" }}>شهري</div>
          <h2 style={styles.planTitle}>اشتراك شهري</h2>
          <div style={{ ...styles.price, color: "#f59e0b" }}>$100/شهر</div>
          <p style={styles.desc}>اشتراك شهري متجدد للوصول المستمر</p>
          <ul style={styles.features}>
            <li>✅ وصول كامل للمحتوى</li>
            <li>✅ تحديثات مستمرة</li>
            <li>✅ إلغاء في أي وقت</li>
          </ul>
          <button
            style={{ ...styles.button, backgroundColor: "#f59e0b" }}
            onClick={() => handlePayment("subscription")}
            disabled={loading === "subscription"}
          >
            {loading === "subscription" ? "جاري التحويل..." : "اشترك $100/شهر"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0a0a0a",
    color: "#fff",
    direction: "rtl",
    fontFamily: "system-ui, sans-serif",
    padding: "3rem 2rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  title: { fontSize: "2rem", fontWeight: "bold", marginBottom: "0.5rem" },
  subtitle: { color: "#888", marginBottom: "3rem" },
  grid: { display: "flex", gap: "2rem", flexWrap: "wrap", justifyContent: "center" },
  card: {
    backgroundColor: "#111",
    border: "2px solid #10b981",
    borderRadius: "16px",
    padding: "2rem",
    width: "300px",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  badge: {
    backgroundColor: "#10b981",
    color: "#000",
    padding: "0.25rem 0.75rem",
    borderRadius: "20px",
    fontSize: "0.8rem",
    fontWeight: "bold",
    width: "fit-content",
  },
  planTitle: { fontSize: "1.4rem", fontWeight: "bold" },
  price: { fontSize: "2.5rem", fontWeight: "bold", color: "#10b981" },
  desc: { color: "#888", fontSize: "0.9rem" },
  features: { listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" },
  button: {
    padding: "0.875rem",
    borderRadius: "10px",
    border: "none",
    backgroundColor: "#10b981",
    color: "#000",
    fontSize: "1rem",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: "auto",
  },
};
