"use client";
import Link from "next/link";
import { GOLD, BORDER, card, sectionTitle, sectionEyebrow, monoStack, fmt, InfoDot } from "./shared";

export default function TierProgress({ tier }) {
  if (!tier || !tier.current) return null;

  const {
    current,
    next,
    remaining,
    progressPct,
    activeClientsCount,
    allTiers,
    signupDelta,
    renewalDelta,
    projectedMonthlyIncome,
    projectedMonthlyIncomeAtNextTier,
  } = tier;

  return (
    <section id="tier" style={{ scrollMarginTop: 90, marginBottom: "1.4rem" }}>
      <div style={{ ...card, position: "relative", overflow: "hidden" }} className="qta-animate-in">
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(600px 200px at 100% 0%, ${current.color_hex}22, transparent)`,
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <p style={sectionEyebrow}>مستواك الحالي</p>
          <Link href="/affiliate/tiers" style={{ fontSize: "0.75rem", color: GOLD, textDecoration: "none", fontWeight: 700 }}>
            كل المستويات ←
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: "1.1rem" }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              background: `${current.color_hex}18`,
              border: `2px solid ${current.color_hex}`,
              boxShadow: `0 0 24px ${current.color_hex}33`,
              flexShrink: 0,
            }}
          >
            {current.badge_icon}
          </div>
          <div>
            <h2 style={{ ...sectionTitle, color: current.color_hex, marginBottom: 2 }}>{current.title_ar}</h2>
            <p style={{ color: "#93A0B8", fontSize: "0.82rem" }}>
              عندك حالياً <b style={{ color: "#EDF1F8" }}>{activeClientsCount}</b> عميل نشط
              <InfoDot text="عميل نشط = عميل مُحال منك وما زال مشتركاً فعلياً بالمنصة حالياً." />
            </p>
          </div>
        </div>

        {/* عمولتك الحالية بهالمستوى */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: "1.2rem" }}>
          <div style={rateBox(current.color_hex)}>
            <p style={rateLabel}>عمولة التسجيل</p>
            <p style={{ ...rateValue, color: current.color_hex }}>${fmt(current.signup_amount)}</p>
          </div>
          <div style={rateBox(current.color_hex)}>
            <p style={rateLabel}>عمولة التجديد الشهري</p>
            <p style={{ ...rateValue, color: current.color_hex }}>${fmt(current.renewal_amount)}</p>
          </div>
          <div style={rateBox("#1FBF87")}>
            <p style={rateLabel}>دخلك المتكرر المتوقع شهرياً</p>
            <p style={{ ...rateValue, color: "#1FBF87" }}>${fmt(projectedMonthlyIncome)}</p>
          </div>
        </div>

        {next ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: "0.78rem", color: "#93A0B8" }}>
                تبقى <b style={{ color: GOLD }}>{remaining}</b> {remaining === 1 ? "عميل" : "عملاء"} نشط للوصول إلى{" "}
                <b style={{ color: next.color_hex }}>
                  {next.badge_icon} {next.title_ar}
                </b>
              </span>
              <span style={{ fontFamily: monoStack, fontSize: "0.75rem", color: "#5D6880" }}>{progressPct}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 3, background: "rgba(255,255,255,0.05)", overflow: "hidden", marginBottom: "0.9rem" }}>
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  borderRadius: 3,
                  background: `linear-gradient(90deg, ${current.color_hex}, ${next.color_hex})`,
                  transition: "width 700ms cubic-bezier(.2,.8,.2,1)",
                }}
              />
            </div>

            {/* كم بيتغير دخلك بعد الترقية — أقوى جزء تحفيزي */}
            <div
              style={{
                background: `${next.color_hex}0d`,
                border: `1px solid ${next.color_hex}44`,
                borderRadius: 0,
                padding: "0.9rem 1.1rem",
              }}
            >
              <p style={{ fontSize: "0.8rem", color: "#EDF1F8", fontWeight: 700, marginBottom: 6 }}>
                {next.badge_icon} بعد الترقية لـ {next.title_ar}:
              </p>
              <div style={{ display: "flex", gap: "1.4rem", flexWrap: "wrap", fontSize: "0.78rem", color: "#93A0B8" }}>
                <span>
                  عمولة التسجيل: <b style={{ color: next.color_hex }}>${fmt(next.signup_amount)}</b>{" "}
                  <span style={{ color: "#1FBF87" }}>(+${fmt(signupDelta)})</span>
                </span>
                <span>
                  عمولة التجديد: <b style={{ color: next.color_hex }}>${fmt(next.renewal_amount)}</b>{" "}
                  <span style={{ color: "#1FBF87" }}>(+${fmt(renewalDelta)})</span>
                </span>
                <span>
                  دخلك الشهري بيصير: <b style={{ color: "#1FBF87" }}>${fmt(projectedMonthlyIncomeAtNextTier)}</b>
                </span>
              </div>
            </div>
          </>
        ) : (
          <p style={{ color: GOLD, fontSize: "0.85rem", fontWeight: 700 }}>وصلت لأعلى مستوى وأعلى عمولة بالبرنامج — استمر هيك، أنت مثال يُحتذى به!
          </p>
        )}

        {allTiers && allTiers.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: "1.2rem", flexWrap: "wrap" }}>
            {allTiers.map((t) => {
              const reached = activeClientsCount >= t.min_active_clients;
              const isCurrent = t.id === current.id;
              return (
                <div
                  key={t.id}
                  style={{
                    flex: "1 1 90px",
                    textAlign: "center",
                    padding: "0.6rem 0.4rem",
                    borderRadius: 3,
                    border: `1px solid ${isCurrent ? t.color_hex : BORDER}`,
                    background: isCurrent ? `${t.color_hex}14` : "transparent",
                    opacity: reached ? 1 : 0.45,
                  }}
                >
                  <div style={{ fontSize: 18 }}>{t.badge_icon}</div>
                  <div style={{ fontSize: "0.68rem", color: reached ? "#EDF1F8" : "#5D6880", fontWeight: 700, marginTop: 2 }}>
                    {t.title_ar}
                  </div>
                  <div style={{ fontSize: "0.6rem", color: "#5D6880" }}>{t.min_active_clients}+ عميل</div>
                  <div style={{ fontSize: "0.62rem", color: t.color_hex, fontWeight: 700, marginTop: 2 }}>
                    ${t.signup_amount} / ${t.renewal_amount}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

const rateLabel = { fontSize: "0.68rem", color: "#93A0B8", marginBottom: 4 };
const rateValue = { fontSize: "1.1rem", fontWeight: 800, fontFamily: monoStack };
function rateBox(color) {
  return {
    flex: "1 1 130px",
    textAlign: "center",
    background: `${color}0d`,
    border: `1px solid ${color}33`,
    borderRadius: 0,
    padding: "0.8rem 0.6rem",
  };
}
