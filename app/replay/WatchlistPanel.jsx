"use client";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { ASSETS } from "@/lib/assets";

const GOLD = "#DCD4F7";
const GOLD_LIGHT = "#F5F3FF";
const GREEN = "#10E5A0";
const RED = "#FF453A";

const COLLAPSE_STORAGE_KEY = "qais_watchlist_collapsed_groups_v1";
const POLL_MS = 10000; // كل 10 ثواني - توازن بين الحيوية وتجنّب حظر يوهو لكتر طلبات

function loadCollapsed() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function fmtPrice(price, mult) {
  if (!Number.isFinite(price)) return "—";
  // عدد الخانات العشرية يتناسب عكسياً مع mult (نفس منطق تسعير أداة الريبلاي)
  const decimals = mult >= 10000 ? 5 : mult >= 1000 ? 4 : mult >= 100 ? 3 : mult >= 10 ? 2 : mult >= 1 ? 2 : 2;
  return price.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtChange(change, mult) {
  if (!Number.isFinite(change)) return "—";
  const decimals = mult >= 10000 ? 5 : mult >= 1000 ? 4 : mult >= 100 ? 3 : 2;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function AssetBadge({ label }) {
  const letter = (label || "?").replace(/[^A-Za-z]/g, "").slice(0, 1) || "?";
  return (
    <span
      style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 800, color: "#120B24",
        background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
      }}
    >
      {letter}
    </span>
  );
}

export default function WatchlistPanel({ activeSymbol, onSelectSymbol, onClose }) {
  const [quotes, setQuotes] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const timerRef = useRef(null);

  const fetchQuotes = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist-quotes", { cache: "no-store" });
      const data = await res.json();
      if (data?.quotes) {
        setQuotes(data.quotes);
        setError(data.stale ? "آخر تحديث متاح (تعذّر جلب أسعار جديدة مؤقتاً)" : null);
      } else if (data?.error) {
        setError(data.error);
      }
    } catch {
      setError("تعذّر الاتصال بالسيرفر لجلب الأسعار");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
    function schedule() {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (document.visibilityState === "visible") fetchQuotes();
      }, POLL_MS);
    }
    schedule();
    function onVisibility() {
      if (document.visibilityState === "visible") fetchQuotes();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchQuotes]);

  function toggleGroup(name) {
    setCollapsed((prev) => {
      const next = { ...prev, [name]: !prev[name] };
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  return (
    <div
      style={{
        flex: "0 0 300px", alignSelf: "stretch", display: "flex", flexDirection: "column",
        background: "#0E0A1A", border: "1px solid #2A2145", borderRadius: 3,
        overflow: "hidden", minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 10px", borderBottom: "1px solid #2A2145", flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: GOLD_LIGHT }}>قائمة المتابعة</span>
          {loading && <span style={{ fontSize: 10.5, color: "#6E6690" }}>...تحديث</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={fetchQuotes}
            title="تحديث الآن"
            style={{ background: "transparent", border: "none", color: "#6E6690", cursor: "pointer", fontSize: 13, padding: 2 }}
          ><RefreshCw size={14} aria-hidden /></button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="إخفاء لوحة المتابعة"
              style={{ background: "transparent", border: "none", color: "#6E6690", cursor: "pointer", fontSize: 13, padding: 2 }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: "6px 10px", fontSize: 11, color: RED, background: "#FF453A14", flexShrink: 0 }}>
          {error}
        </div>
      )}

      <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", fontSize: 10.5, color: "#3D2F63", position: "sticky", top: 0, background: "#0E0A1A", zIndex: 1 }}>
          <span style={{ width: 18, flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 60 }}>الرمز</span>
          <span style={{ width: 40, textAlign: "left", flexShrink: 0 }}>%</span>
          <span style={{ width: 54, textAlign: "left", flexShrink: 0 }}>التغيّر</span>
          <span style={{ width: 62, textAlign: "left", flexShrink: 0 }}>السعر</span>
        </div>

        {ASSETS.map((group) => {
          const isCollapsed = !!collapsed[group.group];
          return (
            <div key={group.group}>
              <div
                onClick={() => toggleGroup(group.group)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 10px", cursor: "pointer", background: "#141024",
                  borderTop: "1px solid #2A2145", borderBottom: "1px solid #2A2145",
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: "#6E6690", letterSpacing: 0.3 }}>
                  {group.group}
                </span>
                <span style={{ fontSize: 10, color: "#3D2F63" }}>{isCollapsed ? "▸" : "▾"}</span>
              </div>
              {!isCollapsed &&
                group.items.map((it) => {
                  const q = quotes[it.v];
                  const up = q && q.changePercent > 0;
                  const down = q && q.changePercent < 0;
                  const color = up ? GREEN : down ? RED : "#6E6690";
                  const isActive = it.v === activeSymbol;
                  const disabled = !it.yahoo && !it.yahooSpot;
                  return (
                    <div
                      key={it.v}
                      onClick={() => !disabled && onSelectSymbol && onSelectSymbol(it.v)}
                      title={it.label}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
                        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
                        background: isActive ? "#1C1630" : "transparent",
                        borderInlineStart: isActive ? `2px solid ${GOLD}` : "2px solid transparent",
                      }}
                      onMouseEnter={(e) => { if (!isActive && !disabled) e.currentTarget.style.background = "#141024"; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                    >
                      <AssetBadge label={it.v} />
                      <span style={{ flex: 1, minWidth: 60, fontSize: 12, fontWeight: 600, color: isActive ? GOLD_LIGHT : "#F5F3FF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {it.v}
                      </span>
                      <span style={{ width: 40, textAlign: "left", fontSize: 10.5, fontWeight: 700, color, flexShrink: 0 }}>
                        {q ? `${q.changePercent > 0 ? "+" : ""}${q.changePercent.toFixed(2)}%` : disabled ? "—" : "..."}
                      </span>
                      <span style={{ width: 54, textAlign: "left", fontSize: 10.5, color, flexShrink: 0, fontFamily: "monospace" }}>
                        {q ? fmtChange(q.change, it.mult) : disabled ? "—" : "..."}
                      </span>
                      <span style={{ width: 62, textAlign: "left", fontSize: 11, color: "#A79FC4", flexShrink: 0, fontFamily: "monospace" }}>
                        {q ? fmtPrice(q.price, it.mult) : disabled ? "—" : "..."}
                      </span>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
