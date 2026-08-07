"use client";
import { gold, ink, glass, shadowLuxe, shadowGold, gradientGold, displayStack, monoStack, transition } from "@/app/admin/styles";

export const GOLD = gold;
export const BG = ink;
export const BORDER = "rgba(201,162,75,0.14)";
export const CARD_BG = "rgba(255,255,255,0.02)";

export { glass, shadowLuxe, shadowGold, gradientGold, displayStack, monoStack, transition };

export function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(d, locale = "ar") {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export function timeAgo(dateStr, t, locale = "ar") {
  if (!dateStr) return "—";
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return t("affiliate.justNow");
  if (diff < 3600) return t("affiliate.minutesAgo", { n: Math.floor(diff / 60) });
  if (diff < 86400) return t("affiliate.hoursAgo", { n: Math.floor(diff / 3600) });
  if (diff < 2592000) return t("affiliate.daysAgoGeneric", { n: Math.floor(diff / 86400) });
  return fmtDate(dateStr, locale);
}

export const SUB_STATUS_LABELS = {
  active: { labelKey: "affiliate.subActive", color: "#10E5A0" },
  trial: { labelKey: "affiliate.subTrial", color: "#7C4DFF" },
  expiring: { labelKey: "affiliate.subExpiring", color: "#FF9800" },
  expired: { labelKey: "affiliate.subExpired", color: "#6E6690" },
  suspended: { labelKey: "affiliate.subSuspended", color: "#FF453A" },
  vip: { labelKey: "affiliate.subVip", color: "#B26FE0" },
  none: { labelKey: "affiliate.subNone", color: "#6E6690" },
};

export const COMMISSION_STATUS_LABELS = {
  none: { labelKey: "affiliate.commNone", color: "#6E6690" },
  awaiting_lesson: { labelKey: "affiliate.commAwaitingLesson", color: "#7C4DFF" },
  pending: { labelKey: "affiliate.commPending", color: "#F0A13C" },
  ready: { labelKey: "affiliate.commReady", color: "#10E5A0" },
  paid: { labelKey: "affiliate.commPaid", color: GOLD },
};

// Card / layout primitives shared across affiliate sections
export const card = { ...glass, boxShadow: shadowLuxe, borderRadius: 0, padding: "1.6rem" };
export const sectionTitle = { fontSize: "1.05rem", fontWeight: 800, color: "#F5F3FF", fontFamily: displayStack, marginBottom: 4 };
export const sectionEyebrow = { fontFamily: monoStack, color: GOLD, fontSize: "0.68rem", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" };
export const btnPrimary = { backgroundImage: gradientGold, boxShadow: shadowGold, color: "#141024", border: "none", padding: "0.75rem 1.4rem", borderRadius: 3, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", transition, whiteSpace: "nowrap" };
export const btnGhost = { background: "transparent", border: `1px solid ${GOLD}`, color: GOLD, padding: "0.6rem 1.1rem", borderRadius: 3, cursor: "pointer", fontSize: "0.8rem", whiteSpace: "nowrap", transition, fontWeight: 600 };

// Simple inline tooltip: wraps children, shows a small label on hover/focus
export function Tip({ text, children }) {
  return (
    <span style={{ position: "relative", display: "inline-flex" }} className="qta-tip-wrap">
      {children}
      <span className="qta-tip-bubble" style={tipStyles.bubble}>{text}</span>
      <style>{`
        .qta-tip-wrap .qta-tip-bubble { opacity: 0; visibility: hidden; transform: translateY(4px); transition: all 160ms ease; }
        .qta-tip-wrap:hover .qta-tip-bubble, .qta-tip-wrap:focus-within .qta-tip-bubble { opacity: 1; visibility: visible; transform: translateY(0); }
      `}</style>
    </span>
  );
}

const tipStyles = {
  bubble: {
    position: "absolute",
    bottom: "calc(100% + 8px)",
    right: "50%",
    transform: "translateX(50%)",
    background: "#141024",
    border: `1px solid ${BORDER}`,
    color: "#A79FC4",
    fontSize: "0.7rem",
    lineHeight: 1.5,
    padding: "0.5rem 0.7rem",
    borderRadius: 3,
    width: 200,
    textAlign: "center",
    zIndex: 20,
    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    pointerEvents: "none",
  },
};

export function InfoDot({ text }) {
  return (
    <Tip text={text}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 15,
          height: 15,
          borderRadius: "50%",
          border: `1px solid ${BORDER}`,
          color: "#6E6690",
          fontSize: "0.62rem",
          cursor: "help",
          marginInlineStart: 5,
        }}
        tabIndex={0}
      >
        ?
      </span>
    </Tip>
  );
}

export function SkeletonBlock({ h = 16, w = "100%", radius = 6 }) {
  return (
    <div
      style={{
        height: h,
        width: w,
        borderRadius: radius,
        background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 37%, rgba(255,255,255,0.03) 63%)",
        backgroundSize: "400% 100%",
        animation: "qta-shimmer 1.4s ease infinite",
      }}
    />
  );
}

export function ShimmerStyles() {
  return (
    <style>{`
      @keyframes qta-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
      @keyframes qta-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      .qta-animate-in { animation: qta-fade-up 420ms cubic-bezier(.2,.8,.2,1) both; }
    `}</style>
  );
}

export function EmptyState({ icon = "📭", title, desc }) {
  return (
    <div style={{ textAlign: "center", padding: "2.2rem 1rem" }}>
      <div style={{ fontSize: "2rem", marginBottom: 10, opacity: 0.7 }}>{icon}</div>
      <p style={{ color: "#A79FC4", fontWeight: 700, fontSize: "0.9rem", marginBottom: 4 }}>{title}</p>
      {desc && <p style={{ color: "#6E6690", fontSize: "0.78rem" }}>{desc}</p>}
    </div>
  );
}
