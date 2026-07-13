import Link from "next/link";
import { gold, goldOklch, goldDeep, gradientGold, shadowGold, displayStack, fontStack, ink } from "../styles";

function SparklesIcon({ size = 13, color = "#D4AF37" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 3l1.6 4.6L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.4L12 3z"
        fill={color}
      />
      <path d="M19 14l0.7 2 2 0.7-2 0.7-0.7 2-0.7-2-2-0.7 2-0.7 0.7-2z" fill={color} />
    </svg>
  );
}

function ArrowIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const metadata = {
  title: "لوحة تحكم Qais Trading Academy",
  description: "بوابة الدخول إلى لوحة تحكم الإدارة — نظرة لحظية على الاشتراكات، الأعضاء والعمولات.",
};

export default function AdminWelcomePage() {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        backgroundColor: ink,
        color: "#F5F5F5",
        direction: "rtl",
        fontFamily: fontStack,
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      {/* توهج ذهبي خلفي */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            top: "-8rem",
            right: "-6rem",
            height: "24rem",
            width: "24rem",
            borderRadius: "9999px",
            background: `${goldOklch}`,
            opacity: 0.12,
            filter: "blur(120px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "-8rem",
            height: "28rem",
            width: "28rem",
            borderRadius: "9999px",
            background: `${goldDeep}`,
            opacity: 0.1,
            filter: "blur(140px)",
          }}
        />
      </div>

      <main
        style={{
          position: "relative",
          maxWidth: "48rem",
          margin: "0 auto",
          padding: "8rem 1.5rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            borderRadius: "9999px",
            border: "1px solid rgba(201,162,75,0.3)",
            background: "rgba(255,255,255,0.03)",
            padding: "0.3rem 0.9rem",
            fontSize: "11px",
            letterSpacing: "2px",
            color: "#a89b7f",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <SparklesIcon size={13} color={gold} /> QTA · لوحة التحكم
        </div>

        <h1
          style={{
            marginTop: "1.5rem",
            fontFamily: displayStack,
            fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          لوحة تحكم{" "}
          <span
            style={{
              backgroundImage: gradientGold,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            فاخرة ودقيقة
          </span>{" "}
          لإدارة الأكاديمية.
        </h1>

        <p
          style={{
            margin: "1.25rem auto 0",
            maxWidth: "32rem",
            color: "#8a8a8a",
            fontSize: "1.05rem",
            lineHeight: 1.8,
          }}
        >
          بيانات لحظية عن الاشتراكات، الأعضاء، والعمولات — بتصميم يجمع بساطة
          الأنظمة الحديثة، وكثافة معلومات منصات التداول، ودقّة تجربة المستخدم.
        </p>

        <div style={{ marginTop: "2.5rem", display: "flex", justifyContent: "center", gap: "0.75rem" }}>
          <Link
            href="/admin"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              height: "2.75rem",
              padding: "0 1.4rem",
              borderRadius: 10,
              backgroundImage: gradientGold,
              color: "#16130a",
              fontWeight: 700,
              fontSize: "0.95rem",
              textDecoration: "none",
              boxShadow: shadowGold,
            }}
          >
            الدخول إلى لوحة التحكم
            <ArrowIcon size={16} />
          </Link>
        </div>
      </main>
    </div>
  );
}
