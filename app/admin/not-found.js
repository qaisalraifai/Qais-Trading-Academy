import Link from "next/link";
import { gold, gradientGold, shadowGold, displayStack, fontStack, ink } from "./styles";

export default function AdminNotFound() {
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
        <h1
          style={{
            fontFamily: displayStack,
            fontSize: "5rem",
            fontWeight: 800,
            color: gold,
            lineHeight: 1,
          }}
        >
          404
        </h1>
        <h2 style={{ marginTop: "1rem", fontSize: "1.25rem", fontWeight: 700, fontFamily: displayStack }}>
          الصفحة غير موجودة
        </h2>
        <p style={{ marginTop: "0.5rem", color: "#8a8a8a", fontSize: "0.9rem", lineHeight: 1.7 }}>
          الصفحة اللي بتدوّر عليها مش موجودة، أو تم نقلها.
        </p>
        <div style={{ marginTop: "1.75rem" }}>
          <Link
            href="/admin"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: "2.6rem",
              padding: "0 1.3rem",
              borderRadius: 10,
              backgroundImage: gradientGold,
              color: "#16130a",
              fontWeight: 700,
              fontSize: "0.9rem",
              textDecoration: "none",
              boxShadow: shadowGold,
            }}
          >
            العودة إلى لوحة التحكم
          </Link>
        </div>
      </div>
    </div>
  );
}
