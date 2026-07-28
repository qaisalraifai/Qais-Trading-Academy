"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Bot,
  Clock,
  ExternalLink,
  BarChart3,
} from "lucide-react";

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

const CONFIDENCE_BUCKETS = [
  { key: "all", label: "الكل" },
  { key: "80", label: "80%+" },
  { key: "60", label: "60-79%" },
  { key: "0", label: "أقل من 60%" },
];

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

function timeAgo(iso) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
}

export default function CombinedAITradesClient() {
  const [view, setView] = useState("live"); // live | history

  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkingIds, setCheckingIds] = useState(() => new Set());

  // فلاتر التبويب المباشر
  const [liveFilter, setLiveFilter] = useState("open"); // open | closed | all

  // فلاتر تبويب السجل والإحصائيات
  const [symbolFilter, setSymbolFilter] = useState("all");
  const [tfFilter, setTfFilter] = useState("all");
  const [dirFilter, setDirFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [confFilter, setConfFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadTrades = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/ai-trades");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل تحميل الصفقات");
      setTrades(data.trades || []);
      return data.trades || [];
    } catch (e) {
      setError(e.message || "فشل تحميل الصفقات");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const checkTrade = useCallback(async (id) => {
    setCheckingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/ai-trades/${id}/check`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.trade) {
        setTrades((prev) => prev.map((t) => (t.id === id ? data.trade : t)));
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
  useEffect(() => {
    // اقرأ التبويب المطلوب من الرابط، مثلاً /ai-trades?tab=history
    try {
      const params = new URLSearchParams(window.location.search);
      const wanted = params.get("tab");
      if (wanted === "history" || wanted === "live") setView(wanted);
    } catch {}

    (async () => {
      const initial = await loadTrades();
      const openOnes = initial.filter((t) => OPEN_STATUSES.includes(t.status));
      openOnes.forEach((t) => checkTrade(t.id));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleLive = trades.filter((t) => {
    if (liveFilter === "open") return OPEN_STATUSES.includes(t.status);
    if (liveFilter === "closed") return CLOSED_STATUSES.includes(t.status);
    return true;
  });

  const symbols = useMemo(() => Array.from(new Set(trades.map((t) => t.symbol))).sort(), [trades]);
  const timeframes = useMemo(() => Array.from(new Set(trades.map((t) => t.timeframe))).sort(), [trades]);

  const filteredHistory = useMemo(() => {
    return trades.filter((t) => {
      if (symbolFilter !== "all" && t.symbol !== symbolFilter) return false;
      if (tfFilter !== "all" && t.timeframe !== tfFilter) return false;
      if (dirFilter !== "all" && t.direction !== dirFilter) return false;
      if (resultFilter === "win" && t.status !== "Closed Winner") return false;
      if (resultFilter === "loss" && t.status !== "Stopped Out") return false;
      if (confFilter !== "all") {
        const c = t.confidence ?? 0;
        if (confFilter === "80" && c < 80) return false;
        if (confFilter === "60" && (c < 60 || c >= 80)) return false;
        if (confFilter === "0" && c >= 60) return false;
      }
      if (dateFrom && new Date(t.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(t.created_at) > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [trades, symbolFilter, tfFilter, dirFilter, resultFilter, confFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const closed = filteredHistory.filter((t) => CLOSED_STATUSES.includes(t.status));
    const wins = closed.filter((t) => t.status === "Closed Winner");
    const losses = closed.filter((t) => t.status === "Stopped Out");
    const winRate = closed.length ? Math.round((wins.length / closed.length) * 100) : null;
    const rrValues = closed.map((t) => t.risk_reward).filter((v) => v != null);
    const avgRR = rrValues.length ? (rrValues.reduce((a, b) => a + b, 0) / rrValues.length).toFixed(2) : null;

    const bySymbol = {};
    closed.forEach((t) => {
      bySymbol[t.symbol] = bySymbol[t.symbol] || { win: 0, loss: 0 };
      if (t.status === "Closed Winner") bySymbol[t.symbol].win++;
      else bySymbol[t.symbol].loss++;
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
    closed.forEach((t) => {
      byTF[t.timeframe] = byTF[t.timeframe] || { win: 0, loss: 0 };
      if (t.status === "Closed Winner") byTF[t.timeframe].win++;
      else byTF[t.timeframe].loss++;
    });
    let bestTF = null;
    Object.entries(byTF).forEach(([tf, v]) => {
      const total = v.win + v.loss;
      const rate = total ? v.win / total : 0;
      if (total < 1) return;
      if (!bestTF || rate > bestTF.rate) bestTF = { tf, rate };
    });

    return {
      totalTrades: filteredHistory.length,
      winRate,
      avgRR,
      totalWins: wins.length,
      totalLosses: losses.length,
      bestSymbol: bestSymbol ? `${bestSymbol.symbol} (${Math.round(bestSymbol.rate * 100)}%)` : "—",
      worstSymbol: worstSymbol ? `${worstSymbol.symbol} (${Math.round(worstSymbol.rate * 100)}%)` : "—",
      bestTimeframe: bestTF ? `${bestTF.tf} (${Math.round(bestTF.rate * 100)}%)` : "—",
    };
  }, [filteredHistory]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", padding: "1.2rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Bot size={20} color={GOLD} />
          <h1 style={{ fontSize: 18, fontWeight: 900, color: "#f0f0f0", margin: 0 }}>صفقات QAIS AI</h1>
        </div>

        {/* تبديل بين العرض المباشر والسجل والإحصائيات */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setView("live")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: view === "live" ? `${GOLD}1f` : "transparent",
              border: `1px solid ${view === "live" ? GOLD : "#2e2e2e"}`,
              color: view === "live" ? GOLD_LIGHT : "#aaa",
              borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
            }}
          >
            <Bot size={13} /> الصفقات
          </button>
          <button
            onClick={() => setView("history")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: view === "history" ? `${GOLD}1f` : "transparent",
              border: `1px solid ${view === "history" ? GOLD : "#2e2e2e"}`,
              color: view === "history" ? GOLD_LIGHT : "#aaa",
              borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
            }}
          >
            <BarChart3 size={13} /> السجل والإحصائيات
          </button>
        </div>
      </div>

      {error && <div style={{ ...glass, padding: "0.7rem 1rem", color: RED, fontSize: 12.5 }}>{error}</div>}

      {/* ================= تبويب: الصفقات (مباشر) ================= */}
      {view === "live" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            {[
              { key: "open", label: "مفتوحة" },
              { key: "closed", label: "مغلقة" },
              { key: "all", label: "الكل" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setLiveFilter(f.key)}
                style={{
                  background: liveFilter === f.key ? `${GOLD}1f` : "transparent",
                  border: `1px solid ${liveFilter === f.key ? GOLD : "#2e2e2e"}`,
                  color: liveFilter === f.key ? GOLD_LIGHT : "#888",
                  borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ ...glass, padding: "2rem", textAlign: "center", color: "#888" }}>جارٍ التحميل...</div>
          ) : visibleLive.length === 0 ? (
            <div style={{ ...glass, padding: "2rem", textAlign: "center", color: "#888" }}>
              ما في صفقات QAIS AI {liveFilter === "open" ? "مفتوحة" : liveFilter === "closed" ? "مغلقة" : ""} حالياً.
              <br />
              نفّذ صفقة من كارد الـ AI Trade بصفحة Trading Radar لما يصير الإعداد جاهز.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {visibleLive.map((t) => {
                const isBuy = t.direction === "up";
                const isChecking = checkingIds.has(t.id);
                const isClosed = CLOSED_STATUSES.includes(t.status);
                return (
                  <div key={t.id} style={{ ...glass, padding: "1rem 1.2rem" }}>
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
                        <b style={{ color: "#f0f0f0", fontSize: 14 }}>{t.symbol}</b>
                        <span style={{ fontSize: 11, color: "#999", background: "#14161a", border: "1px solid #2e2e2e", borderRadius: 6, padding: "3px 8px" }}>
                          {t.timeframe}
                        </span>
                        <span
                          style={{
                            fontSize: 11.5, fontWeight: 800, color: statusColor(t.status),
                            background: `${statusColor(t.status)}1a`, border: `1px solid ${statusColor(t.status)}55`,
                            borderRadius: 6, padding: "3px 9px",
                          }}
                        >
                          {t.status}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#777" }}>
                          <Clock size={11} /> {timeAgo(t.created_at)}
                        </span>
                        {!isClosed && (
                          <button
                            onClick={() => checkTrade(t.id)}
                            disabled={isChecking}
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              background: "transparent", border: "1px solid #2e2e2e", color: "#aaa",
                              borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: isChecking ? "default" : "pointer",
                            }}
                          >
                            <RefreshCw size={11} className={isChecking ? "qmi-dot" : ""} />
                            {isChecking ? "جارٍ الفحص..." : "تحديث السعر"}
                          </button>
                        )}
                        <Link
                          href={`/ai-trades/${t.id}`}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            background: `${GOLD}15`, border: `1px solid ${GOLD}40`, color: GOLD_LIGHT,
                            borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, textDecoration: "none",
                          }}
                        >
                          التفاصيل <ExternalLink size={11} />
                        </Link>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(95px, 1fr))", gap: 8 }}>
                      <MiniStat label="Entry" value={fmt(t.entry)} />
                      <MiniStat label="Stop Loss" value={fmt(t.stop_loss)} color={RED} />
                      <MiniStat label="TP1" value={fmt(t.tp1)} color={GREEN} />
                      <MiniStat label="TP2" value={fmt(t.tp2)} color={GREEN} />
                      <MiniStat label="TP3" value={fmt(t.tp3)} color={BLUE} />
                      <MiniStat label="TP4" value={fmt(t.tp4)} color={BLUE} />
                      <MiniStat label="Confidence" value={t.confidence != null ? `${t.confidence}%` : "—"} color={GOLD_LIGHT} />
                      <MiniStat label="R/R" value={t.risk_reward != null ? `${t.risk_reward}R` : "—"} />
                    </div>

                    <div style={{ marginTop: 10, fontSize: 11, color: "#777" }}>
                      آخر سعر تم فحصه: <b style={{ color: "#ccc" }}>{fmt(t.last_checked_price)}</b> · {timeAgo(t.last_checked_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ================= تبويب: السجل والإحصائيات ================= */}
      {view === "history" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <StatCard label="Total AI Trades" value={stats.totalTrades} />
            <StatCard label="Win Rate" value={stats.winRate != null ? `${stats.winRate}%` : "—"} color={GREEN} />
            <StatCard label="Average RR" value={stats.avgRR != null ? `${stats.avgRR}R` : "—"} color={GOLD_LIGHT} />
            <StatCard label="Total Wins" value={stats.totalWins} color={GREEN} />
            <StatCard label="Total Losses" value={stats.totalLosses} color={RED} />
            <StatCard label="Best Symbol" value={stats.bestSymbol} small />
            <StatCard label="Worst Symbol" value={stats.worstSymbol} small />
            <StatCard label="Best Timeframe" value={stats.bestTimeframe} small />
          </div>

          <div style={{ ...glass, padding: "0.9rem 1.1rem", display: "flex", flexWrap: "wrap", gap: 10 }}>
            <FilterSelect label="الرمز" value={symbolFilter} onChange={setSymbolFilter} options={[{ v: "all", l: "الكل" }, ...symbols.map((s) => ({ v: s, l: s }))]} />
            <FilterSelect label="الفريم" value={tfFilter} onChange={setTfFilter} options={[{ v: "all", l: "الكل" }, ...timeframes.map((s) => ({ v: s, l: s }))]} />
            <FilterSelect label="الاتجاه" value={dirFilter} onChange={setDirFilter} options={[{ v: "all", l: "الكل" }, { v: "up", l: "BUY" }, { v: "down", l: "SELL" }]} />
            <FilterSelect label="النتيجة" value={resultFilter} onChange={setResultFilter} options={[{ v: "all", l: "الكل" }, { v: "win", l: "رابحة" }, { v: "loss", l: "خاسرة" }]} />
            <FilterSelect label="Confidence" value={confFilter} onChange={setConfFilter} options={CONFIDENCE_BUCKETS.map((b) => ({ v: b.key, l: b.label }))} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10.5, color: "#888" }}>من تاريخ</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10.5, color: "#888" }}>إلى تاريخ</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {loading ? (
            <div style={{ ...glass, padding: "2rem", textAlign: "center", color: "#888" }}>جارٍ التحميل...</div>
          ) : filteredHistory.length === 0 ? (
            <div style={{ ...glass, padding: "2rem", textAlign: "center", color: "#888" }}>ما في صفقات مطابقة للفلاتر المختارة.</div>
          ) : (
            <div style={{ ...glass, padding: "0.5rem", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ color: "#888", textAlign: "right" }}>
                    {["الرمز", "الاتجاه", "الفريم", "Confidence", "R/R", "الحالة", "التاريخ", ""].map((h) => (
                      <th key={h} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #2e2e2e" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((t) => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #22242a" }}>
                      <td style={{ padding: "9px 12px", fontWeight: 800, color: "#f0f0f0" }}>{t.symbol}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: t.direction === "up" ? GREEN : RED, fontWeight: 700 }}>
                          {t.direction === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {t.direction === "up" ? "BUY" : "SELL"}
                        </span>
                      </td>
                      <td style={{ padding: "9px 12px", color: "#aaa" }}>{t.timeframe}</td>
                      <td style={{ padding: "9px 12px", color: GOLD_LIGHT, fontWeight: 700 }}>{t.confidence != null ? `${t.confidence}%` : "—"}</td>
                      <td style={{ padding: "9px 12px", color: "#ccc" }}>{t.risk_reward != null ? `${t.risk_reward}R` : "—"}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: statusColor(t.status), background: `${statusColor(t.status)}1a`, border: `1px solid ${statusColor(t.status)}55`, borderRadius: 6, padding: "3px 8px" }}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ padding: "9px 12px", color: "#888" }}>{new Date(t.created_at).toLocaleDateString("en-GB")}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <Link href={`/ai-trades/${t.id}`} style={{ display: "flex", alignItems: "center", gap: 4, color: GOLD_LIGHT, fontSize: 11, textDecoration: "none" }}>
                          التفاصيل <ExternalLink size={11} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const inputStyle = {
  background: "#14161a", border: "1px solid #2e2e2e", color: "#ddd",
  borderRadius: 6, padding: "6px 8px", fontSize: 11.5,
};

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 10.5, color: "#888" }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, minWidth: 110 }}>
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </div>
  );
}

function StatCard({ label, value, color = "#f0f0f0", small = false }) {
  return (
    <div style={{ ...glass, padding: "0.8rem 1rem" }}>
      <div style={{ fontSize: 10.5, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: small ? 13 : 18, fontWeight: 900, color }}>{value}</div>
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
