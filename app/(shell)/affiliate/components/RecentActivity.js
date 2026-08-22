"use client";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, CircleCheck, CircleDollarSign, CircleX, Dot, Gift, Landmark, Ticket, UserPlus } from "lucide-react";
import { playBeep } from "@/lib/beep";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const GOLD = "#DCD4F7";
const CARD = "#0A0614";
const BORDER = "#241C3E";

const ICONS = {
  commission: CircleDollarSign,
  badge: BadgeCheck,
  wheel_credit: Ticket,
  wheel_spin: Gift,
  referral_joined: UserPlus,
  application_approved: CircleCheck,
  application_rejected: CircleX,
  payout: Landmark,
};

const ICON_COLORS = {
  commission: GOLD,
  badge: GOLD,
  wheel_credit: "#7C4DFF",
  wheel_spin: "#7C4DFF",
  referral_joined: "#10E5A0",
  application_approved: "#10E5A0",
  application_rejected: "#FF453A",
  payout: "#7C4DFF",
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
            <div key={n.id} style={{ ...s.row, borderBottom: i < items.length - 1 ? `1px solid #141024` : "none" }}>
              {(() => {
                const Icon = ICONS[n.type] || Dot;
                return <Icon size={16} strokeWidth={1.75} color={ICON_COLORS[n.type] || "#6E6690"} style={s.icon} aria-hidden />;
              })()}
              <div style={{ flex: 1 }}>
                <p style={s.title}>{n.title}</p>
                {n.message && <p style={s.msg}>{n.message}</p>}
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
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 0, padding: "1.6rem", marginBottom: "1.2rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" },
  sectionTitle: { fontSize: "1rem", fontWeight: 700, color: GOLD },
  liveTag: { display: "flex", alignItems: "center", gap: 5, fontSize: "0.7rem", color: "#10E5A0" },
  liveDot: { width: 6, height: 6, borderRadius: "50%", background: "#10E5A0", boxShadow: "0 0 6px #10E5A0" },
  empty: { color: "#4A4368", fontSize: "0.85rem" },
  row: { display: "flex", gap: 10, padding: "0.7rem 0" },
  icon: { flexShrink: 0, marginTop: 2 },
  title: { fontSize: "0.85rem", color: "#F5F3FF", fontWeight: 600 },
  msg: { fontSize: "0.78rem", color: "#A79FC4", marginTop: 2, lineHeight: 1.5 },
  time: { fontSize: "0.7rem", color: "#4A4368", marginTop: 3 },
};
