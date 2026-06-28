"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SuccessContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type");

  return (
    <div style={styles.card}>
      <div style={styles.icon}>🎉</div>
      <h1 style={styles.title}>تم الدفع بنجاح!</h1>
      <p style={styles.desc}>
        مرحباً بك في Qais Trading Academy. تم استلام دفعتك بنجاح.
      </p>
      <div style={styles.divider} />
      <p style={styles.step}>الخطوة التالية: انضم لمجموعة Discord الحصرية</p>
      <a href="https://discord.gg/x7rV7V9PA" target="_blank" style={styles.discordBtn}>
        🎮 انضم لـ Discord الآن
      </a>
      <p style={styles.note}>
        ستجد جميع المحاضرات والمحتوى الحصري داخل Discord
      </p>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.logoText}>QTA</div>
        <p style={styles.logoSub}>QAIS TRADING ACADEMY</p>
      </div>
      <Suspense fallback={<div style={{color:"#fff"}}>جاري التحميل...</div>}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}

const gold = "#D4AF37";

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0a0a0a",
    color: "#fff",
    direction: "rtl",
    fontFamily: "'Georgia', serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    gap: "2rem",
  },
  header: { textAlign: "center" },
  logoText: {
    fontSize: "2.5rem",
    fontWeight: "bold",
    color: gold,
    letterSpacing: "8px",
  },
  logoSub: {
    color: "#555",
    letterSpacing: "4px",
    fontSize: "0.7rem",
  },
  card: {
    backgroundColor: "#0f0f0f",
    border: `1px solid ${gold}`,
    borderRadius: "4px",
    padding: "3rem",
    textAlign: "center",
    maxWidth: "440px",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.25rem",
    boxShadow: `0 0 60px ${gold}22`,
  },
  icon: { fontSize: "3.5rem" },
  title: { fontSize: "1.8rem", fontWeight: "bold", color: gold },
  desc: { color: "#888", lineHeight: 1.6, fontSize: "0.95rem" },
  divider: { width: "60px", height: "1px", backgroundColor: "#222", margin: "0.5rem 0" },
  step: { color: "#fff", fontWeight: "bold", fontSize: "1rem" },
  discordBtn: {
    width: "100%",
    padding: "1rem",
    borderRadius: "2px",
    border: "none",
    backgroundColor: "#5865F2",
    color: "#fff",
    fontSize: "1rem",
    fontWeight: "bold",
    textDecoration: "none",
    letterSpacing: "1px",
    display: "block",
    textAlign: "center",
  },
  note: { color: "#444", fontSize: "0.8rem", lineHeight: 1.6 },
};
