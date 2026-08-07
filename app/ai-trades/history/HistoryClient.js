"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, ExternalLink, BarChart3 } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const GOLD = "#DCD4F7";
const GOLD_LIGHT = "#F5F3FF";
const GREEN = "#10E5A0";
const RED = "#FF453A";
const BLUE = "#7C4DFF";

const glass = {
  background: "#141024",
  border: `1px solid #2A2145`,
  borderRadius: 0,
  boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
  backdropFilter: "blur(10px)",
};

const CLOSED_STATUSES = ["Closed Winner", "Stopped Out"];

function fmt(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n >= 100 ? n.toFixed(2) : n.toFixed(4);
}

function statusColor(status) {
  if (status === "Closed Winner") return GREEN;
  if (status === "Stopped Out") return RED;
  if (status === "Open") return "#A79FC4";
  return GOLD_LIGHT;
}

export default function HistoryClient() {
  const { t, locale } = useLocale();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [symbolFilter, setSymbolFilter] = useState("all");
  const [tfFilter, setTfFilter] = useState("all");
  const [dirFilter, setDirFilter] = useState("all"); // all | up | down
  const [resultFilter, setResultFilter] = useState("all"); // all | win | loss
  const [confFilter, setConfFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const CONFIDENCE_BUCKETS = [
    { key: "all", labelKey: "aiTrades.optAll" },
    { key: "80", labelKey: "aiTrades.confBucket80" },
    { key: "60", labelKey: "aiTrades.conf60to79" },
    { key: "0", labelKey: "aiTrades.confBelow60" },
  ];

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ai-trades");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("aiTrades.loadFailed"));
        setTrades(data.trades || []);
      } catch (e) {
        setError(e.message || t("aiTrades.loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const symbols = useMemo(() => Array.from(new Set(trades.map((tr) => tr.symbol))).sort(), [trades]);
  const timeframes = useMemo(() => Array.from(new Set(trades.map((tr) => tr.timeframe))).sort(), [trades]);

  const filtered = useMemo(() => {
    return trades.filter((tr) => {
      if (symbolFilter !== "all" && tr.symbol !== symbolFilter) return false;
      if (tfFilter !== "all" && tr.timeframe !== tfFilter) return false;
      if (dirFilter !== "all" && tr.direction !== dirFilter) return false;
      if (resultFilter === "win" && tr.status !== "Closed Winner") return false;
      if (resultFilter === "loss" && tr.status !== "Stopped Out") return false;
      if (confFilter !== "all") {
        const c = tr.confidence ?? 0;
        if (confFilter === "80" && c < 80) return false;
        if (confFilter === "60" && (c < 60 || c >= 80)) return false;
        if (confFilter === "0" && c >= 60) return false;
      }
      if (dateFrom && new Date(tr.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(tr.created_at) > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [trades, symbolFilter, tfFilter, dirFilter, resultFilter, confFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const closed = filtered.filter((tr) => CLOSED_STATUSES.includes(tr.status));
    const wins = closed.filter((tr) => tr.status === "Closed Winner");
    const losses = closed.filter((tr) => tr.status === "Stopped Out");
    const winRate = closed.length ? Math.round((wins.length / closed.length) * 100) : null;
    const rrValues = closed.map((tr) => tr.risk_reward).filter((v) => v != null);
    const avgRR = rrValues.length ? (rrValues.reduce((a, b) => a + b, 0) / rrValues.length).toFixed(2) : null;

    const bySymbol = {};
    closed.forEach((tr) => {
      bySymbol[tr.symbol] = bySymbol[tr.symbol] || { win: 0, loss: 0 };
      if (tr.status === "Closed Winner") bySymbol[tr.symbol].win++;
      else bySymbol[tr.symbol].loss++;
    });
    let bestSymbol = null, worstSymbol = null;
    Object.entries(bySymbol).forEach(([sym, v]) => {
      const total = v.win + v.loss;
      const rate = total ? v.win / total : 0;
      if (total < 1) return;
      if (!bestSymbol || rate > bestSymbol.rate) bestSymbol = { symbol: sym, rate };
      if (!worstSymbol || rate < worstSymbol.rate) worstSymbol = { symbol: sym, rate };
    });

    const byTF = {};
    closed.forEach((tr) => {
      byTF[tr.timeframe] = byTF[tr.timeframe] || { win: 0, loss: 0 };
      if (tr.status === "Closed Winner") byTF[tr.timeframe].win++;
      else byTF[tr.timeframe].loss++;
    });
    let bestTF = null;
    Object.entries(byTF).forEach(([tf, v]) => {
      const total = v.win + v.loss;
      const rate = total ? v.win / total : 0;
      if (total < 1) return;
      if (!bestTF || rate > bestTF.rate) bestTF = { tf, rate };
    });

    return {
      totalTrades: filtered.length,
      winRate,
      avgRR,
      totalWins: wins.length,
      totalLosses: losses.length,
      bestSymbol: bestSymbol ? `${bestSymbol.symbol} (${Math.round(bestSymbol.rate * 100)}%)` : "—",
      worstSymbol: worstSymbol ? `${worstSymbol.symbol} (${Math.round(worstSymbol.rate * 100)}%)` : "—",
      bestTimeframe: bestTF ? `${bestTF.tf} (${Math.round(bestTF.rate * 100)}%)` : "—",
    };
  }, [filtered]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", padding: "1.2rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BarChart3 size={20} color={GOLD} />
        <h1 style={{ fontSize: 18, fontWeight: 900, color: "#F5F3FF", margin: 0 }}>{t("aiTrades.historyTitle")}</h1>
      </div>

      {error && <div style={{ ...glass, padding: "0.7rem 1rem", color: RED, fontSize: 12.5 }}>{error}</div>}

      {/* ================= إحصائيات ================= */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <StatCard label={t("aiTrades.statTotalTrades")} value={stats.totalTrades} />
        <StatCard label={t("aiTrades.statWinRate")} value={stats.winRate != null ? `${stats.winRate}%` : "—"} color={GREEN} />
        <StatCard label={t("aiTrades.statAvgRR")} value={stats.avgRR != null ? `${stats.avgRR}R` : "—"} color={GOLD_LIGHT} />
        <StatCard label={t("aiTrades.statTotalWins")} value={stats.totalWins} color={GREEN} />
        <StatCard label={t("aiTrades.statTotalLosses")} value={stats.totalLosses} color={RED} />
        <StatCard label={t("aiTrades.statBestSymbol")} value={stats.bestSymbol} small />
        <StatCard label={t("aiTrades.statWorstSymbol")} value={stats.worstSymbol} small />
        <StatCard label={t("aiTrades.statBestTimeframe")} value={stats.bestTimeframe} small />
      </div>

      {/* ================= الفلاتر ================= */}
      <div style={{ ...glass, padding: "0.9rem 1.1rem", display: "flex", flexWrap: "wrap", gap: 10 }}>
        <FilterSelect label={t("aiTrades.filterSymbol")} value={symbolFilter} onChange={setSymbolFilter} options={[{ v: "all", l: t("aiTrades.optAll") }, ...symbols.map((s) => ({ v: s, l: s }))]} />
        <FilterSelect label={t("aiTrades.filterTimeframe")} value={tfFilter} onChange={setTfFilter} options={[{ v: "all", l: t("aiTrades.optAll") }, ...timeframes.map((s) => ({ v: s, l: s }))]} />
        <FilterSelect label={t("aiTrades.filterDirection")} value={dirFilter} onChange={setDirFilter} options={[{ v: "all", l: t("aiTrades.optAll") }, { v: "up", l: "BUY" }, { v: "down", l: "SELL" }]} />
        <FilterSelect label={t("aiTrades.filterResult")} value={resultFilter} onChange={setResultFilter} options={[{ v: "all", l: t("aiTrades.optAll") }, { v: "win", l: t("aiTrades.optWin") }, { v: "loss", l: t("aiTrades.optLoss") }]} />
        <FilterSelect label="Confidence" value={confFilter} onChange={setConfFilter} options={CONFIDENCE_BUCKETS.map((b) => ({ v: b.key, l: t(b.labelKey) }))} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 10.5, color: "#6E6690" }}>{t("aiTrades.fromDate")}</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 10.5, color: "#6E6690" }}>{t("aiTrades.toDate")}</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {/* ================= الجدول ================= */}
      {loading ? (
        <div style={{ ...glass, padding: "2rem", textAlign: "center", color: "#6E6690" }}>{t("aiTrades.loading")}</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...glass, padding: "2rem", textAlign: "center", color: "#6E6690" }}>{t("aiTrades.noMatchingTrades")}</div>
      ) : (
        <div style={{ ...glass, padding: "0.5rem", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: "#6E6690", textAlign: "right" }}>
                {[t("aiTrades.colSymbol"), t("aiTrades.colDirection"), t("aiTrades.colTimeframe"), "Confidence", "R/R", t("aiTrades.colStatus"), t("aiTrades.colDate"), ""].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #241C3E" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((tr) => (
                <tr key={tr.id} style={{ borderBottom: "1px solid #1C1630" }}>
                  <td style={{ padding: "9px 12px", fontWeight: 800, color: "#F5F3FF" }}>{tr.symbol}</td>
                  <td style={{ padding: "9px 12px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: tr.direction === "up" ? GREEN : RED, fontWeight: 700 }}>
                      {tr.direction === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {tr.direction === "up" ? "BUY" : "SELL"}
                    </span>
                  </td>
                  <td style={{ padding: "9px 12px", color: "#aaa" }}>{tr.timeframe}</td>
                  <td style={{ padding: "9px 12px", color: GOLD_LIGHT, fontWeight: 700 }}>{tr.confidence != null ? `${tr.confidence}%` : "—"}</td>
                  <td style={{ padding: "9px 12px", color: "#A79FC4" }}>{tr.risk_reward != null ? `${tr.risk_reward}R` : "—"}</td>
                  <td style={{ padding: "9px 12px" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: statusColor(tr.status), background: `${statusColor(tr.status)}1a`, border: `1px solid ${statusColor(tr.status)}55`, borderRadius: 3, padding: "3px 8px" }}>
                      {tr.status}
                    </span>
                  </td>
                  <td style={{ padding: "9px 12px", color: "#6E6690" }}>{new Date(tr.created_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB")}</td>
                  <td style={{ padding: "9px 12px" }}>
                    <Link href={`/ai-trades/${tr.id}`} style={{ display: "flex", alignItems: "center", gap: 4, color: GOLD_LIGHT, fontSize: 11, textDecoration: "none" }}>
                      {t("aiTrades.detailsLink")} <ExternalLink size={11} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  background: "#141024", border: "1px solid #241C3E", color: "#ddd",
  borderRadius: 3, padding: "6px 8px", fontSize: 11.5,
};

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 10.5, color: "#6E6690" }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, minWidth: 110 }}>
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </div>
  );
}

function StatCard({ label, value, color = "#F5F3FF", small = false }) {
  return (
    <div style={{ ...glass, padding: "0.8rem 1rem" }}>
      <div style={{ fontSize: 10.5, color: "#6E6690", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: small ? 13 : 18, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}
