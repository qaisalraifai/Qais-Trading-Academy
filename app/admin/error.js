"use client";

import { useEffect } from "react";
import Link from "next/link";
import { gradientGold, shadowGold, displayStack, fontStack, ink } from "./styles";

export default function AdminError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: ink,
        color: "#EAECEF",
        direction: "rtl",
        fontFamily: fontStack,
        padding: "1.5rem",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <div style={{ maxWidth: "26rem", textAlign: "center" }}>
        <h1 style={{ fontFamily: displayStack, fontSize: "1.3rem", fontWeight: 700 }}>
          حصل خطأ غير متوقع
        </h1>
        <p style={{ marginTop: "0.5rem", color: "#8a8a8a", fontSize: "0.9rem", lineHeight: 1.7 }}>
          في مشكلة صارت من طرفنا. جرّب تحدّث الصفحة أو ارجع للوحة التحكم.
        </p>
        <div style={{ marginTop: "1.75rem", display: "flex", justifyContent: "center", gap: "0.6rem" }}>
          <button
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: "2.6rem",
              padding: "0 1.3rem",
              borderRadius: 10,
              backgroundImage: gradientGold,
              color: "#16130a",
              border: "none",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
              boxShadow: shadowGold,
              fontFamily: fontStack,
            }}
          >
            إعادة المحاولة
          </button>
          <Link
            href="/admin"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: "2.6rem",
              padding: "0 1.3rem",
              borderRadius: 10,
              border: "1px solid #2A2E39",
              color: "#EAECEF",
              fontSize: "0.9rem",
              textDecoration: "none",
            }}
          >
            لوحة التحكم
          </Link>
        </div>
      </div>
    </div>
  );
}
