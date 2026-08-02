"use client";
import { useEffect, useRef, useState } from "react";
import { GOLD, transition } from "./shared";

const TOAST_ICONS = {
  referral_joined: "👋",
  commission: "💰",
  payout: "🏦",
  application_rejected: "⚠️",
};

const TOAST_ACCENT = {
  referral_joined: "#3DBB6E",
  commission: GOLD,
  payout: "#3D8BFD",
  application_rejected: "#E5484D",
};

// أنواع الإشعارات يلي بدنا نطلعلها Toast فوري (إحالة جديدة، عمولة جاهزة، دفعة، رفض/إلغاء)
const RELEVANT_TYPES = new Set(["referral_joined", "commission", "payout", "application_rejected"]);

export default function AlertToasts() {
  const [toasts, setToasts] = useState([]);
  const lastIdRef = useRef(null);
  const firstLoadRef = useRef(true);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch("/api/notifications?limit=5");
        if (!res.ok || !active) return;
        const json = await res.json();
        const items = json.items || [];
        if (items.length === 0) return;

        if (firstLoadRef.current) {
          lastIdRef.current = items[0].id;
          firstLoadRef.current = false;
          return;
        }

        const newestSeenIndex = items.findIndex((n) => n.id === lastIdRef.current);
        const freshItems = newestSeenIndex === -1 ? items.slice(0, 1) : items.slice(0, newestSeenIndex);

        const relevant = freshItems.filter((n) => RELEVANT_TYPES.has(n.type)).reverse();
        if (relevant.length > 0) {
          setToasts((prev) => [...prev, ...relevant.map((n) => ({ ...n, _key: `${n.id}-${Date.now()}` }))].slice(-4));
          relevant.forEach((n) => {
            setTimeout(() => {
              setToasts((prev) => prev.filter((t) => t.id !== n.id));
            }, 6000);
          });
        }
        lastIdRef.current = items[0].id;
      } catch {
        // تجاهل أخطاء الشبكة المؤقتة بالـ polling
      }
    }
    poll();
    const interval = setInterval(poll, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.2rem",
        left: "1.2rem",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
        maxWidth: 320,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t._key}
          className="qta-animate-in"
          style={{
            background: "#141414",
            border: `1px solid ${TOAST_ACCENT[t.type] || GOLD}55`,
            borderInlineStart: `3px solid ${TOAST_ACCENT[t.type] || GOLD}`,
            borderRadius: 10,
            padding: "0.8rem 1rem",
            boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            transition,
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>{TOAST_ICONS[t.type] || "🔔"}</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#EAECEF" }}>{t.title}</p>
            {t.message && <p style={{ fontSize: "0.74rem", color: "#9A9A9A", marginTop: 2, lineHeight: 1.5 }}>{t.message}</p>}
            }
          </div>
        </div>
      ))}
    </div>
  );
}
