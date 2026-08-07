"use client";
import { Medal } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const GOLD = "#DCD4F7";
const CARD = "#0A0614";
const BORDER = "#241C3E";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ألوان مراكز الصدارة الثلاثة — ذهبي / فضي / برونزي */
const MEDAL_COLORS = { 1: "#D4AF37", 2: "#B8BCC4", 3: "#B07A45" };

export default function Leaderboard() {
  const { t } = useLocale();
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
      <p style={s.sectionTitle}>{t("affiliate.leaderboardTitle")}</p>
      {data.myRank && (
        <p style={s.myRank}>{t("affiliate.yourRank", { rank: data.myRank.rank, total: fmt(data.myRank.totalEarned) })}</p>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>{t("affiliate.colRank")}</th>
              <th style={s.th}>{t("affiliate.colMarketer")}</th>
              <th style={s.th}>{t("affiliate.colReferrals")}</th>
              <th style={s.th}>{t("affiliate.colTotalEarnings")}</th>
            </tr>
          </thead>
          <tbody>
            {data.leaderboard.map((a) => (
              <tr key={a.id}>
                <td style={s.td}>
                  {MEDAL_COLORS[a.rank] ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Medal size={15} strokeWidth={1.75} color={MEDAL_COLORS[a.rank]} aria-hidden />
                      {a.rank}
                    </span>
                  ) : (
                    a.rank
                  )}
                </td>
                <td style={s.td}>{a.username || t("affiliate.marketerFallback")}</td>
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
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 0, padding: "1.6rem", marginBottom: "1.2rem" },
  sectionTitle: { fontSize: "1rem", fontWeight: 700, color: GOLD, marginBottom: "0.7rem" },
  myRank: { color: "#A79FC4", fontSize: "0.85rem", marginBottom: "1rem" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "right", color: "#6E6690", fontSize: "0.75rem", padding: "0.6rem", borderBottom: `1px solid ${BORDER}` },
  td: { padding: "0.6rem", fontSize: "0.85rem", color: "#A79FC4", borderBottom: `1px solid ${BORDER}` },
};
