"use client";
import { useEffect, useState } from "react";
import { GOLD, BORDER, card, sectionTitle, sectionEyebrow, monoStack, fmt, fmtDate } from "./shared";

export default function AchievementsGrid() {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/affiliate/achievements")
      .then((r) => r.json())
      .then((json) => setAchievements(json.achievements || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading || achievements.length === 0) return null;

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <section id="achievements" style={{ scrollMarginTop: 90, marginBottom: "1.4rem" }}>
      <div style={card} className="qta-animate-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <div>
            <p style={sectionEyebrow}>مثل الألعاب تماماً</p>
            <h2 style={sectionTitle}>الإنجازات</h2>
          </div>
          <span style={{ fontFamily: monoStack, fontSize: "0.78rem", color: GOLD, fontWeight: 700 }}>
            {unlockedCount} / {achievements.length}
          </span>
        </div>
        <p style={{ color: "#9A9A9A", fontSize: "0.8rem", margin: "0.5rem 0 1.2rem" }}>
          إنجازات تراكمية — أول ما تحققها بتضل مكتسبة إلك للأبد، حتى لو تغيّرت أرقامك لاحقاً.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "0.8rem" }}>
          {achievements.map((a) => (
            <div
              key={a.code}
              style={{
                border: `1px solid ${a.unlocked ? GOLD + "66" : BORDER}`,
                borderRadius: 14,
                padding: "1rem",
                textAlign: "center",
                background: a.unlocked
                  ? "linear-gradient(160deg, rgba(212,175,55,0.1), rgba(212,175,55,0.02))"
                  : "rgba(255,255,255,0.015)",
                boxShadow: a.unlocked ? "0 0 22px rgba(212,175,55,0.15)" : "none",
                position: "relative",
              }}
            >
              <div style={{ fontSize: "1.9rem", marginBottom: 8, opacity: a.unlocked ? 1 : 0.3, filter: a.unlocked ? "none" : "grayscale(1)" }}>
                {a.icon}
              </div>
              <p style={{ fontWeight: 800, fontSize: "0.82rem", color: a.unlocked ? "#EAECEF" : "#8A8580", marginBottom: 4 }}>
                {a.title}
              </p>
              {a.description && (
                <p style={{ fontSize: "0.68rem", color: "#6E7177", marginBottom: 8, lineHeight: 1.5 }}>{a.description}</p>
              )}

              {a.unlocked ? (
                <>
                  <p style={{ fontSize: "0.65rem", color: GOLD, fontWeight: 700 }}>
                    {a.bonusAmount > 0 ? `+$${fmt(a.bonusAmount)}` : "مفتوحة ✓"}
                  </p>
                  <p style={{ fontSize: "0.6rem", color: "#6E7177", marginTop: 3 }}>{fmtDate(a.unlockedAt)}</p>
                </>
              ) : (
                <>
                  <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 5 }}>
                    <div style={{ height: "100%", width: `${a.progressPct}%`, background: GOLD, opacity: 0.5, borderRadius: 4 }} />
                  </div>
                  <p style={{ fontSize: "0.62rem", color: "#6E7177" }}>
                    {fmt(a.currentValue)} / {fmt(a.threshold)}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
