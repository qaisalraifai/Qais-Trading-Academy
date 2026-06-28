"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type");

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>🎉</div>
        <h1 style={styles.title}>تم الدفع بنجاح!</h1>
        {type === "registration" ? (
          <p style={styles.desc}>
            مرحباً بك في Qais Trading Academy. تم تفعيل حسابك بنجاح.
          </p>
        ) : (
          <p style={styles.desc}>
            تم تجديد اشتراكك بنجاح. استمتع بالوصول الكامل للمحتوى.
          </p>
        )}
        <a href="/dashboard" style={styles.button}>
          الذهاب للداشبورد
        </a>
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#111",
    border: "2px solid #10b981",
    borderRadius: "16px",
    padding: "3rem",
    textAlign: "center",
    maxWidth: "400px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
  },
  icon: { fontSize: "4rem" },
  title: { fontSize: "1.8rem", fontWeight: "bold" },
  desc: { color: "#888", lineHeight: 1.6 },
  button: {
    padding: "0.875rem 2rem",
    borderRadius: "10px",
    backgroundColor: "#10b981",
    color: "#000",
    fontWeight: "bold",
    textDecoration: "none",
    marginTop: "1rem",
  },
};
