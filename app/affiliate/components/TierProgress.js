"use client";
import { GOLD, BORDER, card, sectionTitle, sectionEyebrow, monoStack, InfoDot } from "./shared";

export default function TierProgress({ tier }) {
  if (!tier || !tier.current) return null;

  const { current, next, remaining, progressPct, activeClientsCount, allTiers } = tier;

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

        <p style={sectionEyebrow}>مستواك الحالي</p>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: "1rem" }}>
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
            <p style={{ color: "#9A9A9A", fontSize: "0.82rem" }}>
              عندك حالياً <b style={{ color: "#EAECEF" }}>{activeClientsCount}</b> عميل نشط
              <InfoDot text="عميل نشط = عميل مُحال منك وما زال مشتركاً فعلياً بالمنصة حالياً." />
            </p>
          </div>
        </div>

        {next ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: "0.78rem", color: "#9A9A9A" }}>
                تبقى <b style={{ color: GOLD }}>{remaining}</b> {remaining === 1 ? "عميل" : "عملاء"} نشط للوصول إلى{" "}
                <b style={{ color: next.color_hex }}>
                  {next.badge_icon} {next.title_ar}
                </b>
              </span>
              <span style={{ fontFamily: monoStack, fontSize: "0.75rem", color: "#8A8580" }}>{progressPct}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 6, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  borderRadius: 6,
                  background: `linear-gradient(90deg, ${current.color_hex}, ${next.color_hex})`,
                  transition: "width 700ms cubic-bezier(.2,.8,.2,1)",
                }}
              />
            </div>
          </>
        ) : (
          <p style={{ color: GOLD, fontSize: "0.85rem", fontWeight: 700 }}>
            👑 وصلت لأعلى مستوى — استمر هيك، أنت مثال يُحتذى به!
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
                    borderRadius: 10,
                    border: `1px solid ${isCurrent ? t.color_hex : BORDER}`,
                    background: isCurrent ? `${t.color_hex}14` : "transparent",
                    opacity: reached ? 1 : 0.45,
                  }}
                >
                  <div style={{ fontSize: 18 }}>{t.badge_icon}</div>
                  <div style={{ fontSize: "0.68rem", color: reached ? "#EAECEF" : "#6E7177", fontWeight: 700, marginTop: 2 }}>
                    {t.title_ar}
                  </div>
                  <div style={{ fontSize: "0.62rem", color: "#6E7177" }}>{t.min_active_clients}+</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
