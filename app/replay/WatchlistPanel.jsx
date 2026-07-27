"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { ASSETS } from "@/lib/assets";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2D57E";
const GREEN = "#02C076";
const RED = "#F6465D";

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
        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 800, color: "#1a1608",
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
        flex: "0 0 280px", alignSelf: "stretch", display: "flex", flexDirection: "column",
        background: "#131722", border: "1px solid #2a2e39", borderRadius: 6,
        overflow: "hidden", minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 10px", borderBottom: "1px solid #2a2e39", flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: GOLD_LIGHT }}>قائمة المتابعة</span>
          {loading && <span style={{ fontSize: 10.5, color: "#777" }}>...تحديث</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={fetchQuotes}
            title="تحديث الآن"
            style={{ background: "transparent", border: "none", color: "#8a8f9c", cursor: "pointer", fontSize: 13, padding: 2 }}
          >
            🔄
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="إخفاء لوحة المتابعة"
              style={{ background: "transparent", border: "none", color: "#8a8f9c", cursor: "pointer", fontSize: 13, padding: 2 }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: "6px 10px", fontSize: 11, color: RED, background: "#F6465D14", flexShrink: 0 }}>
          {error}
        </div>
      )}

      <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", padding: "4px 10px", fontSize: 10.5, color: "#5d6270", position: "sticky", top: 0, background: "#131722", zIndex: 1 }}>
          <span style={{ flex: 1 }}>الرمز</span>
          <span style={{ width: 48, textAlign: "left" }}>%</span>
          <span style={{ width: 58, textAlign: "left" }}>التغيّر</span>
          <span style={{ width: 66, textAlign: "left" }}>السعر</span>
        </div>

        {ASSETS.map((group) => {
          const isCollapsed = !!collapsed[group.group];
          return (
            <div key={group.group}>
              <div
                onClick={() => toggleGroup(group.group)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 10px", cursor: "pointer", background: "#171b26",
                  borderTop: "1px solid #2a2e39", borderBottom: "1px solid #2a2e39",
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: "#9599a3", letterSpacing: 0.3 }}>
                  {group.group}
                </span>
                <span style={{ fontSize: 10, color: "#5d6270" }}>{isCollapsed ? "▸" : "▾"}</span>
              </div>
              {!isCollapsed &&
                group.items.map((it) => {
                  const q = quotes[it.v];
                  const up = q && q.changePercent > 0;
                  const down = q && q.changePercent < 0;
                  const color = up ? GREEN : down ? RED : "#8a8f9c";
                  const isActive = it.v === activeSymbol;
                  const disabled = !it.yahoo && !it.yahooSpot;
                  return (
                    <div
                      key={it.v}
                      onClick={() => !disabled && onSelectSymbol && onSelectSymbol(it.v)}
                      title={it.label}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
                        background: isActive ? "#20242f" : "transparent",
                        borderInlineStart: isActive ? `2px solid ${GOLD}` : "2px solid transparent",
                      }}
                      onMouseEnter={(e) => { if (!isActive && !disabled) e.currentTarget.style.background = "#1a1e28"; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                    >
                      <AssetBadge label={it.v} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: isActive ? GOLD_LIGHT : "#e5e5e5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {it.v}
                      </span>
                      <span style={{ width: 48, textAlign: "left", fontSize: 11, fontWeight: 700, color, flexShrink: 0 }}>
                        {q ? `${q.changePercent > 0 ? "+" : ""}${q.changePercent.toFixed(2)}%` : disabled ? "—" : "..."}
                      </span>
                      <span style={{ width: 58, textAlign: "left", fontSize: 11, color, flexShrink: 0, fontFamily: "monospace" }}>
                        {q ? fmtChange(q.change, it.mult) : disabled ? "—" : "..."}
                      </span>
                      <span style={{ width: 66, textAlign: "left", fontSize: 11.5, color: "#c7cad1", flexShrink: 0, fontFamily: "monospace" }}>
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
