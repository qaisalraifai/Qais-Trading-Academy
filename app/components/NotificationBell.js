"use client";
import { useEffect, useRef, useState } from "react";
import { playBeep } from "@/lib/beep";

const GOLD = "#D4AF37";

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "الآن";
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

export default function NotificationBell({ soundEnabled = true }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastSeenIdRef = useRef(null);
  const firstLoadRef = useRef(true);
  const rootRef = useRef(null);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/notifications?limit=15");
      if (!res.ok) return;
      const json = await res.json();
      const newItems = json.items || [];

      if (!firstLoadRef.current && soundEnabled && newItems.length > 0) {
        const newestId = newItems[0].id;
        if (lastSeenIdRef.current && newestId !== lastSeenIdRef.current) {
          const isNew = !items.find((i) => i.id === newestId);
          if (isNew) playBeep();
        }
      }
      if (newItems.length > 0) lastSeenIdRef.current = newItems[0].id;
      firstLoadRef.current = false;

      setItems(newItems);
      setUnreadCount(json.unreadCount || 0);
    } catch (e) {
      // تجاهل أخطاء polling الصامتة
    }
  }

  async function markAllRead() {
    setUnreadCount(0);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) markAllRead();
  }

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={toggleOpen} style={s.bellBtn} aria-label="الإشعارات">
        🔔
        {unreadCount > 0 && <span style={s.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {open && (
        <div style={s.dropdown}>
          <div style={s.dropdownHeader}>الإشعارات</div>
          <div style={s.list}>
            {items.length === 0 && <p style={s.empty}>ما في إشعارات لسا</p>}
            {items.map((n) => (
              <div key={n.id} style={s.item}>
                <p style={s.itemTitle}>{n.title}</p>
                {n.message && <p style={s.itemMsg}>{n.message}</p>}
                <p style={s.itemTime}>{timeAgo(n.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  bellBtn: { position: "relative", background: "transparent", border: "1px solid #2B2F36", borderRadius: 8, width: 40, height: 40, fontSize: "1.1rem", cursor: "pointer", color: "#EAECEF" },
  badge: { position: "absolute", top: -4, left: -4, background: "#F6465D", color: "#fff", fontSize: "0.65rem", fontWeight: 700, borderRadius: 9, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" },
  dropdown: { position: "absolute", top: "48px", left: 0, width: 320, maxWidth: "90vw", background: "#0d0d0d", border: "1px solid #2B2F36", borderRadius: 12, boxShadow: "0 12px 30px rgba(0,0,0,0.5)", zIndex: 50, overflow: "hidden" },
  dropdownHeader: { padding: "0.8rem 1rem", fontSize: "0.85rem", fontWeight: 700, color: GOLD, borderBottom: "1px solid #2B2F36" },
  list: { maxHeight: 360, overflowY: "auto" },
  empty: { padding: "1.2rem", color: "#555", fontSize: "0.8rem", textAlign: "center" },
  item: { padding: "0.8rem 1rem", borderBottom: "1px solid #181A20" },
  itemTitle: { fontSize: "0.83rem", color: "#EAECEF", fontWeight: 600, marginBottom: 2 },
  itemMsg: { fontSize: "0.78rem", color: "#9a9488", lineHeight: 1.5, marginBottom: 4 },
  itemTime: { fontSize: "0.68rem", color: "#555" },
};
