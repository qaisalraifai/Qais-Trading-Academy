"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, RefreshCw, Bot, Clock, ExternalLink, BarChart3 } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2D57E";
const GREEN = "#02C076";
const RED = "#F6465D";
const BLUE = "#4f7cff";

const glass = {
  background: "linear-gradient(145deg, rgba(34,37,43,0.9), rgba(20,22,26,0.92))",
  border: `1px solid ${GOLD}22`,
  borderRadius: 16,
  boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
  backdropFilter: "blur(10px)",
};

const CLOSED_STATUSES = ["Closed Winner", "Stopped Out"];
const OPEN_STATUSES = ["Open", "Running", "TP1 Hit", "TP2 Hit", "TP3 Hit", "TP4 Hit"];

function statusColor(status) {
  if (status === "Closed Winner") return GREEN;
  if (status === "Stopped Out") return RED;
  if (status === "Open") return "#999";
  return GOLD_LIGHT; // Running / TPx Hit
}

function fmt(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n >= 100 ? n.toFixed(2) : n.toFixed(4);
}

function timeAgo(iso, t) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t("aiTrades.justNow");
  if (mins < 60) return t("aiTrades.minutesAgo", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("aiTrades.hoursAgo", { n: hrs });
  return t("aiTrades.daysAgo", { n: Math.floor(hrs / 24) });
}

export default function AITradesClient() {
  const { t } = useLocale();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("open"); // open | closed | all
  const [checkingIds, setCheckingIds] = useState(() => new Set());

  const loadTrades = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/ai-trades");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("aiTrades.loadFailed"));
      setTrades(data.trades || []);
      return data.trades || [];
    } catch (e) {
      setError(e.message || t("aiTrades.loadFailed"));
      return [];
    } finally {
      setLoading(false);
    }
  }, [t]);

  const checkTrade = useCallback(async (id) => {
    setCheckingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/ai-trades/${id}/check`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.trade) {
        setTrades((prev) => prev.map((tr) => (tr.id === id ? data.trade : tr)));
      }
    } catch {
      /* فشل فحص فردي — منتجاهله، المستخدم فيه يعيد الضغط يدوياً */
    } finally {
      setCheckingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  // أول تحميل: نجيب القائمة، وبعدين نفحص تلقائياً كل الصفقات المفتوحة عند الطلب
  // (فحص عند الطلب — بدون كرون دوري بالخلفية)
  useEffect(() => {
    (async () => {
      const initial = await loadTrades();
      const openOnes = initial.filter((tr) => OPEN_STATUSES.includes(tr.status));
      openOnes.forEach((tr) => checkTrade(tr.id));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = trades.filter((tr) => {
    if (filter === "open") return OPEN_STATUSES.includes(tr.status);
    if (filter === "closed") return CLOSED_STATUSES.includes(tr.status);
    return true;
  });

  const emptyStatusLabel = filter === "open" ? t("aiTrades.filterOpen") : filter === "closed" ? t("aiTrades.filterClosed") : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", padding: "1.2rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Bot size={20} color={GOLD} />
          <h1 style={{ fontSize: 18, fontWeight: 900, color: "#f0f0f0", margin: 0 }}>{t("aiTrades.pageTitle")}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/ai-trades/history"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "transparent", border: "1px solid #2e2e2e", color: "#aaa",
              borderRadius: 8, padding: "6px 12px", fontSize: 12, textDecoration: "none",
            }}
          >
            <BarChart3 size={13} /> {t("aiTrades.historyLink")}
          </Link>
          {[
            { key: "open", labelKey: "aiTrades.filterOpen" },
            { key: "closed", labelKey: "aiTrades.filterClosed" },
            { key: "all", labelKey: "aiTrades.filterAll" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                background: filter === f.key ? `${GOLD}1f` : "transparent",
                border: `1px solid ${filter === f.key ? GOLD : "#2e2e2e"}`,
                color: filter === f.key ? GOLD_LIGHT : "#888",
                borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              }}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={{ ...glass, padding: "0.7rem 1rem", color: RED, fontSize: 12.5 }}>{error}</div>}

      {loading ? (
        <div style={{ ...glass, padding: "2rem", textAlign: "center", color: "#888" }}>{t("aiTrades.loading")}</div>
      ) : visible.length === 0 ? (
        <div style={{ ...glass, padding: "2rem", textAlign: "center", color: "#888" }}>
          {t("aiTrades.emptyState", { status: emptyStatusLabel })}
          <br />
          {t("aiTrades.emptyStateHint")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visible.map((tr) => {
            const isBuy = tr.direction === "up";
            const isChecking = checkingIds.has(tr.id);
            const isClosed = CLOSED_STATUSES.includes(tr.status);
            return (
              <div key={tr.id} style={{ ...glass, padding: "1rem 1.2rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        background: isBuy ? `${GREEN}1f` : `${RED}1f`,
                        border: `1px solid ${isBuy ? GREEN : RED}66`,
                        color: isBuy ? GREEN : RED,
                        fontWeight: 900, fontSize: 12, borderRadius: 7, padding: "4px 10px",
                      }}
                    >
                      {isBuy ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {isBuy ? "BUY" : "SELL"}
                    </span>
                    <b style={{ color: "#f0f0f0", fontSize: 14 }}>{tr.symbol}</b>
                    <span style={{ fontSize: 11, color: "#999", background: "#14161a", border: "1px solid #2e2e2e", borderRadius: 6, padding: "3px 8px" }}>
                      {tr.timeframe}
                    </span>
                    <span
                      style={{
                        fontSize: 11.5, fontWeight: 800, color: statusColor(tr.status),
                        background: `${statusColor(tr.status)}1a`, border: `1px solid ${statusColor(tr.status)}55`,
                        borderRadius: 6, padding: "3px 9px",
                      }}
                    >
                      {tr.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#777" }}>
                      <Clock size={11} /> {timeAgo(tr.created_at, t)}
                    </span>
                    {!isClosed && (
                      <button
                        onClick={() => checkTrade(tr.id)}
                        disabled={isChecking}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          background: "transparent", border: "1px solid #2e2e2e", color: "#aaa",
                          borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: isChecking ? "default" : "pointer",
                        }}
                      >
                        <RefreshCw size={11} className={isChecking ? "qmi-dot" : ""} />
                        {isChecking ? t("aiTrades.checking") : t("aiTrades.refreshPrice")}
                      </button>
                    )}
                    <Link
                      href={`/ai-trades/${tr.id}`}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        background: `${GOLD}15`, border: `1px solid ${GOLD}40`, color: GOLD_LIGHT,
                        borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, textDecoration: "none",
                      }}
                    >
                      {t("aiTrades.detailsLink")} <ExternalLink size={11} />
                    </Link>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(95px, 1fr))", gap: 8 }}>
                  <MiniStat label="Entry" value={fmt(tr.entry)} />
                  <MiniStat label="Stop Loss" value={fmt(tr.stop_loss)} color={RED} />
                  <MiniStat label="TP1" value={fmt(tr.tp1)} color={GREEN} />
                  <MiniStat label="TP2" value={fmt(tr.tp2)} color={GREEN} />
                  <MiniStat label="TP3" value={fmt(tr.tp3)} color={BLUE} />
                  <MiniStat label="TP4" value={fmt(tr.tp4)} color={BLUE} />
                  <MiniStat label="Confidence" value={tr.confidence != null ? `${tr.confidence}%` : "—"} color={GOLD_LIGHT} />
                  <MiniStat label="R/R" value={tr.risk_reward != null ? `${tr.risk_reward}R` : "—"} />
                </div>

                <div style={{ marginTop: 10, fontSize: 11, color: "#777" }}>
                  {t("aiTrades.lastCheckedPrice")} <b style={{ color: "#ccc" }}>{fmt(tr.last_checked_price)}</b> · {timeAgo(tr.last_checked_at, t)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color = "#f0f0f0" }) {
  return (
    <div style={{ background: "#14161a", border: "1px solid #2e2e2e", borderRadius: 8, padding: "6px 9px" }}>
      <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
