"use client";
import { useEffect, useState } from "react";
import { GOLD, BORDER, card, sectionTitle, sectionEyebrow, monoStack, fmt, transition } from "./shared";

const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };

const TABS = [
  { key: "earnings", label: "الأعلى أرباحًا", valueKey: "totalEarned", fmt: (v) => `$${fmt(v)}` },
  { key: "clients", label: "الأكثر عملاء", valueKey: "activeClients", fmt: (v) => v },
  { key: "conversion", label: "الأفضل تحويلاً", valueKey: "conversionRate", fmt: (v) => `${v}%` },
];

export default function Leaderboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("earnings");

  useEffect(() => {
    fetch("/api/affiliate/leaderboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  const list = data?.leaderboard?.[tab] || [];
  if (list.length === 0) return null;

  const activeTab = TABS.find((t) => t.key === tab);

  return (
    <section id="leaderboard" style={{ scrollMarginTop: 90, marginBottom: "1.4rem" }}>
      <div style={card} className="qta-animate-in">
        <p style={sectionEyebrow}>تنافس ودّي</p>
        <h2 style={sectionTitle}>لوحة الصدارة</h2>
        {!data?.showNames && (
          <p style={{ color: "#6E7177", fontSize: "0.72rem", marginTop: 4 }}>الأسماء مخفية حالياً — كل مسوّق يظهر بمعرف مموّه.</p>
        )}

        <div style={{ display: "flex", gap: 6, margin: "1rem 0 1.2rem", flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "0.5rem 0.9rem",
                borderRadius: 8,
                border: `1px solid ${tab === t.key ? GOLD : BORDER}`,
                background: tab === t.key ? "rgba(212,175,55,0.1)" : "transparent",
                color: tab === t.key ? GOLD : "#9A9A9A",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
                transition,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {data.myRank && (
          <p style={{ color: "#B8B0A0", fontSize: "0.82rem", marginBottom: "1rem" }}>
            ترتيبك بالأرباح: <span style={{ color: GOLD, fontWeight: 700 }}>#{data.myRank.earningsRank}</span>
            {" · "}ترتيبك بالعملاء النشطين: <span style={{ color: GOLD, fontWeight: 700 }}>#{data.myRank.clientsRank}</span>
          </p>
        )}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={s.th}>الترتيب</th>
                <th style={s.th}>المسوّق</th>
                <th style={s.th}>{activeTab.label}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} style={{ background: a.id === data?.myRank?.id ? "rgba(212,175,55,0.05)" : "transparent" }}>
                  <td style={s.td}>{MEDALS[a.rank] || `#${a.rank}`}</td>
                  <td style={s.td}>{a.displayName}</td>
                  <td style={{ ...s.td, color: GOLD, fontFamily: monoStack, fontWeight: 700 }}>{activeTab.fmt(a[activeTab.valueKey])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

const s = {
  th: { textAlign: "right", color: "#6E7177", fontSize: "0.72rem", padding: "0.6rem", borderBottom: `1px solid ${BORDER}` },
  td: { padding: "0.6rem", fontSize: "0.82rem", color: "#C8C0B0", borderBottom: `1px solid ${BORDER}` },
};
