"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const GOLD = "#E8B86D";
const GOLD_LIGHT = "#F0C588";
const GREEN = "#3DBB6E";
const RED = "#E5484D";

const cardStyle = {
  background: "linear-gradient(145deg, #141517, #0D0E10)",
  border: `1px solid ${GOLD}26`,
  borderRadius: 18,
  boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
};

const RANGES = [
  { key: "week", labelKey: "reports.rangeWeek" },
  { key: "month", labelKey: "reports.rangeMonth" },
  { key: "3months", labelKey: "reports.range3Months" },
  { key: "all", labelKey: "reports.rangeAll" },
];

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rangeStartDate(rangeKey) {
  const now = new Date();
  if (rangeKey === "week") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (rangeKey === "month") return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  if (rangeKey === "3months") return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  return null; // all
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ ...cardStyle, padding: "1rem 1.1rem" }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || "#eee" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "#666", marginTop: 4 }}>{sub}</div>}
      }
    </div>
  );
}

function ProgressMeter({ pct, color }) {
  return (
    <div style={{ width: "100%", height: 8, borderRadius: 999, background: "#242832", overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%", background: color || GOLD, borderRadius: 999 }} />
    </div>
  );
}

export default function ReportsView({ userId }) {
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [rangeKey, setRangeKey] = useState("all");
  const [trades, setTrades] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [progressRows, setProgressRows] = useState([]);
  const [quizAttempts, setQuizAttempts] = useState([]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const [{ data: tradesRows }, { data: lecturesRows }, { data: progressData }, { data: quizRows }] = await Promise.all([
        supabase.from("trades").select("*").eq("user_id", userId).order("trade_date", { ascending: true }),
        supabase.from("lectures").select("id, duration_seconds"),
        supabase.from("lecture_progress").select("*").eq("user_id", userId),
        supabase.from("quiz_attempts").select("*").eq("student_id", userId),
      ]);
      if (!active) return;
      setTrades(tradesRows || []);
      setLectures(lecturesRows || []);
      setProgressRows(progressData || []);
      setQuizAttempts(quizRows || []);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [userId]);

  /* ===== فلترة الصفقات حسب الفترة الزمنية المختارة ===== */
  const filteredTrades = useMemo(() => {
    const start = rangeStartDate(rangeKey);
    if (!start) return trades;
    return trades.filter((t) => t.trade_date && new Date(t.trade_date) >= start);
  }, [trades, rangeKey]);

  /* ===== القسم 1: إحصائيات التداول ===== */
  const tradingStats = useMemo(() => {
    const wins = filteredTrades.filter((t) => t.result === "win");
    const losses = filteredTrades.filter((t) => t.result === "loss");
    const decided = wins.length + losses.length;
    const winRate = decided > 0 ? (wins.length / decided) * 100 : 0;
    const netPnL = filteredTrades.reduce((acc, t) => {
      if (t.result === "win") return acc + Number(t.reward_amount || 0);
      if (t.result === "loss") return acc - Number(t.risk_amount || 0);
      return acc;
    }, 0);
    const avgRR = decided > 0
      ? filteredTrades.filter((t) => t.result === "win" || t.result === "loss")
          .reduce((acc, t) => acc + Number(t.rr || 0), 0) / decided
      : 0;

    // توزيع حسب الأصل
    const byAsset = {};
    filteredTrades.forEach((t) => {
      if (!t.asset) return;
      if (!byAsset[t.asset]) byAsset[t.asset] = { wins: 0, losses: 0 };
      if (t.result === "win") byAsset[t.asset].wins += 1;
      if (t.result === "loss") byAsset[t.asset].losses += 1;
    });
    const assetBreakdown = Object.entries(byAsset)
      .map(([asset, v]) => {
        const d = v.wins + v.losses;
        return { asset, decided: d, winRate: d > 0 ? (v.wins / d) * 100 : 0 };
      })
      .filter((a) => a.decided > 0)
      .sort((a, b) => b.decided - a.decided);

    return { total: filteredTrades.length, wins: wins.length, losses: losses.length, decided, winRate, netPnL, avgRR, assetBreakdown };
  }, [filteredTrades]);

  /* ===== القسم 2: التقدم التعليمي ===== */
  const eduStats = useMemo(() => {
    const progressMap = {};
    progressRows.forEach((p) => { progressMap[p.lecture_id] = p; });
    const totalLessons = lectures.length;
    const completedRows = progressRows.filter((p) => p.completed);
    const completedCount = completedRows.length;
    const overallPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
    const completedSeconds = lectures
      .filter((l) => progressMap[l.id]?.completed)
      .reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
    const completedHours = completedSeconds / 3600;

    const totalQuizzes = quizAttempts.length;
    const avgQuizPct = totalQuizzes > 0
      ? (quizAttempts.reduce((acc, q) => acc + (q.total_questions ? q.score / q.total_questions : 0), 0) / totalQuizzes) * 100
      : 0;

    return { totalLessons, completedCount, overallPct, completedHours, totalQuizzes, avgQuizPct, completedRows };
  }, [lectures, progressRows, quizAttempts]);

  /* ===== القسم 3: الربط الذكي بين التعليم والتداول ===== */
  const smartInsight = useMemo(() => {
    const decidedTrades = trades.filter((t) => t.result === "win" || t.result === "loss");
    const completedSorted = [...eduStats.completedRows]
      .filter((p) => p.last_watched_at)
      .sort((a, b) => new Date(a.last_watched_at) - new Date(b.last_watched_at));

    if (completedSorted.length < 4 || decidedTrades.length < 6) {
      return {
        type: "generic",
        text: t("reports.insightGeneric"),
      };
    }

    const midIndex = Math.floor(completedSorted.length / 2);
    const midDate = new Date(completedSorted[midIndex].last_watched_at);

    const before = decidedTrades.filter((t) => new Date(t.trade_date) < midDate);
    const after = decidedTrades.filter((t) => new Date(t.trade_date) >= midDate);

    if (before.length < 3 || after.length < 3) {
      return {
        type: "generic",
        text: t("reports.insightGeneric"),
      };
    }

    const winRate = (arr) => (arr.filter((t) => t.result === "win").length / arr.length) * 100;
    const beforeWR = winRate(before);
    const afterWR = winRate(after);
    const delta = afterWR - beforeWR;

    if (delta >= 3) {
      return {
        type: "positive",
        text: t("reports.insightPositive", { before: beforeWR.toFixed(0), after: afterWR.toFixed(0), delta: delta.toFixed(0) }),
      };
    }
    if (delta <= -3) {
      return {
        type: "neutral",
        text: t("reports.insightDeclined", { before: beforeWR.toFixed(0), after: afterWR.toFixed(0) }),
      };
    }
    return {
      type: "neutral",
      text: t("reports.insightStable", { before: beforeWR.toFixed(0), after: afterWR.toFixed(0) }),
    };
  }, [trades, eduStats.completedRows, t]);

  if (loading) {
    return <div style={{ color: "#666", fontSize: 14, padding: "3rem 0", textAlign: "center" }}>{t("reports.loading")}</div>;
  }

  return (
    <div>
      {/* رأس الصفحة + فلتر الفترة */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#eee" }}>{t("reports.title")}</div>
          <div style={{ fontSize: 12.5, color: "#777", marginTop: 2 }}>{t("reports.subtitle")}</div>
        </div>
        <div style={{ display: "flex", gap: 6, background: "#0D0E10", padding: 4, borderRadius: 10 }}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRangeKey(r.key)}
              style={{
                padding: "0.35rem 0.8rem", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                border: "none", cursor: "pointer",
                background: rangeKey === r.key ? `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})` : "transparent",
                color: rangeKey === r.key ? "#1A1408" : "#999",
              }}
            >
              {t(r.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* القسم 3: الربط الذكي — نحطه فوق لأنو أهم رسالة بالصفحة */}
      <div style={{
        ...cardStyle, padding: "1.1rem 1.3rem", marginBottom: "1.3rem",
        border: `1px solid ${smartInsight.type === "positive" ? GREEN : GOLD}44`,
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>
          {smartInsight.type === "positive" ? "🚀" : smartInsight.type === "neutral" ? "🔎" : "💡"}
        </span>
        <div style={{ fontSize: 13.5, color: "#ddd", lineHeight: 1.7 }}>{smartInsight.text}</div>
      </div>

      {/* القسم 1: التداول */}
      <div style={{ fontSize: 14, fontWeight: 700, color: GOLD_LIGHT, marginBottom: 10 }}>{t("reports.tradingPerfTitle")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.8rem", marginBottom: "1rem" }}>
        <StatCard label={t("reports.totalTrades")} value={tradingStats.total} />
        <StatCard label={t("reports.winRate")} value={`${tradingStats.winRate.toFixed(1)}%`} color={tradingStats.winRate >= 50 ? GREEN : RED} />
        <StatCard
          label={t("reports.netPnl")}
          value={`${tradingStats.netPnL >= 0 ? "$" : "-$"}${fmt(Math.abs(tradingStats.netPnL))}`}
          color={tradingStats.netPnL >= 0 ? GREEN : RED}
        />
        <StatCard label={t("reports.avgRR")} value={tradingStats.avgRR.toFixed(2)} />
      </div>

      {tradingStats.assetBreakdown.length > 0 && (
        <div style={{ ...cardStyle, padding: "1rem 1.2rem", marginBottom: "1.4rem" }}>
          <div style={{ fontSize: 12.5, color: "#999", marginBottom: 10 }}>{t("reports.byAssetTitle")}</div>
          {tradingStats.assetBreakdown.map((a) => (
            <div key={a.asset} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#ccc", marginBottom: 4 }}>
                <span>{a.asset}</span>
                <span>{a.winRate.toFixed(0)}% ({t("reports.tradesSuffix", { count: a.decided })})</span>
              </div>
              <ProgressMeter pct={a.winRate} color={a.winRate >= 50 ? GREEN : RED} />
            </div>
          ))}
        </div>
      )}

      {/* القسم 2: التعليم */}
      <div style={{ fontSize: 14, fontWeight: 700, color: GOLD_LIGHT, marginBottom: 10 }}>{t("reports.eduProgressTitle")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.8rem", marginBottom: "1rem" }}>
        <StatCard label={t("reports.completedLectures")} value={`${eduStats.completedCount} / ${eduStats.totalLessons}`} />
        <StatCard label={t("reports.completionRate")} value={`${eduStats.overallPct}%`} color={GOLD} />
        <StatCard label={t("reports.completedHours")} value={t("reports.hoursSuffix", { hours: eduStats.completedHours.toFixed(1) })} />
        <StatCard
          label={t("reports.avgQuizzes")}
          value={eduStats.totalQuizzes > 0 ? `${eduStats.avgQuizPct.toFixed(0)}%` : "—"}
          sub={eduStats.totalQuizzes > 0 ? t("reports.attemptsSuffix", { count: eduStats.totalQuizzes }) : t("reports.noAttemptsYet")}
        />
      </div>
      <div style={{ ...cardStyle, padding: "1rem 1.2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#ccc", marginBottom: 6 }}>
          <span>{t("reports.contentCompletionTitle")}</span>
          <span>{eduStats.overallPct}%</span>
        </div>
        <ProgressMeter pct={eduStats.overallPct} color={GOLD} />
      </div>
    </div>
  );
}
