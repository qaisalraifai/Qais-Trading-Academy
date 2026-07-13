"use client";
import { useEffect, useState } from "react";

const GOLD = "#D4AF37";
const CARD = "#0d0d0d";
const BORDER = "#2B2F36";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function Leaderboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/affiliate/leaderboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data || !data.leaderboard || data.leaderboard.length === 0) return null;

  return (
    <div style={s.card}>
      <p style={s.sectionTitle}>🏆 قائمة الصدارة</p>
      {data.myRank && (
        <p style={s.myRank}>ترتيبك الحالي: <span style={{ color: GOLD, fontWeight: 700 }}>#{data.myRank.rank}</span> بإجمالي ${fmt(data.myRank.totalEarned)}</p>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>الترتيب</th>
              <th style={s.th}>المسوّق</th>
              <th style={s.th}>الإحالات</th>
              <th style={s.th}>إجمالي الأرباح</th>
            </tr>
          </thead>
          <tbody>
            {data.leaderboard.map((a) => (
              <tr key={a.id}>
                <td style={s.td}>{MEDALS[a.rank] || a.rank}</td>
                <td style={s.td}>{a.username || "مسوّق"}</td>
                <td style={s.td}>{a.referrals}</td>
                <td style={s.td}>${fmt(a.totalEarned)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s = {
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "1.6rem", marginBottom: "1.2rem" },
  sectionTitle: { fontSize: "1rem", fontWeight: 700, color: GOLD, marginBottom: "0.7rem" },
  myRank: { color: "#B8B0A0", fontSize: "0.85rem", marginBottom: "1rem" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "right", color: "#6E7177", fontSize: "0.75rem", padding: "0.6rem", borderBottom: `1px solid ${BORDER}` },
  td: { padding: "0.6rem", fontSize: "0.85rem", color: "#C8C0B0", borderBottom: `1px solid ${BORDER}` },
};
