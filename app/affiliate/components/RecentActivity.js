"use client";
import { useEffect, useRef, useState } from "react";
import { playBeep } from "@/lib/beep";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const GOLD = "#E8B86D";
const CARD = "#0D0E10";
const BORDER = "#2B2F36";

const ICONS = {
  commission: "💰",
  badge: "🏅",
  wheel_credit: "🎡",
  wheel_spin: "🎁",
  referral_joined: "👋",
  application_approved: "✅",
  application_rejected: "⚠️",
  payout: "🏦",
};

function timeAgo(dateStr, t) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return t("affiliate.justNow");
  if (diff < 3600) return t("affiliate.minutesAgo", { n: Math.floor(diff / 60) });
  if (diff < 86400) return t("affiliate.hoursAgo", { n: Math.floor(diff / 3600) });
  return t("affiliate.daysAgoGeneric", { n: Math.floor(diff / 86400) });
}

export default function RecentActivity() {
  const { t } = useLocale();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastIdRef = useRef(null);
  const firstLoadRef = useRef(true);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/notifications?limit=15");
      if (!res.ok) return;
      const json = await res.json();
      const newItems = json.items || [];

      if (!firstLoadRef.current && newItems.length > 0) {
        const newestId = newItems[0].id;
        if (lastIdRef.current && newestId !== lastIdRef.current) playBeep();
      }
      if (newItems.length > 0) lastIdRef.current = newItems[0].id;
      firstLoadRef.current = false;

      setItems(newItems);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.card}>
      <div style={s.header}>
        <p style={s.sectionTitle}>{t("affiliate.recentActivityTitle")}</p>
        <span style={s.liveTag}>
          <span style={s.liveDot} /> Live
        </span>
      </div>
      {loading ? (
        <p style={s.empty}>{t("affiliate.recentActivityLoading")}</p>
      ) : items.length === 0 ? (
        <p style={s.empty}>{t("affiliate.recentActivityEmpty")}</p>
      ) : (
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {items.map((n, i) => (
            <div key={n.id} style={{ ...s.row, borderBottom: i < items.length - 1 ? `1px solid #0D0E10` : "none" }}>
              <span style={s.icon}>{ICONS[n.type] || "⚪"}</span>
              <div style={{ flex: 1 }}>
                <p style={s.title}>{n.title}</p>
                {n.message && <p style={s.msg}>{n.message}</p>}
                }
                <p style={s.time}>{timeAgo(n.created_at, t)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "1.6rem", marginBottom: "1.2rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" },
  sectionTitle: { fontSize: "1rem", fontWeight: 700, color: GOLD },
  liveTag: { display: "flex", alignItems: "center", gap: 5, fontSize: "0.7rem", color: "#3DBB6E" },
  liveDot: { width: 6, height: 6, borderRadius: "50%", background: "#3DBB6E", boxShadow: "0 0 6px #3DBB6E" },
  empty: { color: "#555", fontSize: "0.85rem" },
  row: { display: "flex", gap: 10, padding: "0.7rem 0" },
  icon: { fontSize: "1rem" },
  title: { fontSize: "0.85rem", color: "#EAECEF", fontWeight: 600 },
  msg: { fontSize: "0.78rem", color: "#9a9488", marginTop: 2, lineHeight: 1.5 },
  time: { fontSize: "0.7rem", color: "#555", marginTop: 3 },
};
