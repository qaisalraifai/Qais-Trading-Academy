"use client";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const GOLD = "#C9A860";
const CARD = "#080B14";
const BORDER = "#1E2941";

export default function Badges() {
  const { t } = useLocale();
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/affiliate/badges")
      .then((r) => r.json())
      .then((json) => setBadges(json.badges || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (badges.length === 0) return null;

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div style={s.card}>
      <p style={s.sectionTitle}>{t("affiliate.achievementsTitle", { earned: earnedCount, total: badges.length })}</p>
      <div style={s.grid}>
        {badges.map((b) => (
          <div key={b.code} style={{ ...s.badge, opacity: b.earned ? 1 : 0.35 }}>
            <div style={s.icon}>{b.icon}</div>
            <p style={s.badgeTitle}>{b.title}</p>
            <p style={s.badgeDesc}>{b.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 0, padding: "1.6rem", marginBottom: "1.2rem" },
  sectionTitle: { fontSize: "1rem", fontWeight: 700, color: GOLD, marginBottom: "1rem" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.8rem" },
  badge: { background: "#080B14", border: `1px solid ${BORDER}`, borderRadius: 3, padding: "1rem 0.7rem", textAlign: "center" },
  icon: { fontSize: "1.8rem", marginBottom: 6 },
  badgeTitle: { fontSize: "0.78rem", fontWeight: 700, color: "#EDF1F8", marginBottom: 4 },
  badgeDesc: { fontSize: "0.68rem", color: "#5D6880", lineHeight: 1.4 },
};
