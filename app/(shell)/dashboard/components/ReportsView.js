"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  Callout,
  Module,
  ModuleBody,
  ModuleHeader,
  ModuleTitle,
  ProgressBar,
  SkeletonStatGrid,
  Stat,
  StatCell,
  StatGrid,
  Tabs,
} from "@/app/components/ui";

const RANGES = [
  { key: "week", labelKey: "reports.rangeWeek" },
  { key: "month", labelKey: "reports.rangeMonth" },
  { key: "3months", labelKey: "reports.range3Months" },
  { key: "all", labelKey: "reports.rangeAll" },
];

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function rangeStartDate(rangeKey) {
  const now = new Date();
  if (rangeKey === "week") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (rangeKey === "month") return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  if (rangeKey === "3months") return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  return null; // all
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
      const [{ data: tradesRows }, { data: lecturesRows }, { data: progressData }, { data: quizRows }] =
        await Promise.all([
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
    return () => {
      active = false;
    };
  }, [userId]);

  /* ===== فلترة الصفقات حسب الفترة الزمنية المختارة ===== */
  const filteredTrades = useMemo(() => {
    const start = rangeStartDate(rangeKey);
    if (!start) return trades;
    return trades.filter((x) => x.trade_date && new Date(x.trade_date) >= start);
  }, [trades, rangeKey]);

  /* ===== القسم 1: إحصائيات التداول ===== */
  const tradingStats = useMemo(() => {
    const wins = filteredTrades.filter((x) => x.result === "win");
    const losses = filteredTrades.filter((x) => x.result === "loss");
    const decided = wins.length + losses.length;
    const winRate = decided > 0 ? (wins.length / decided) * 100 : 0;
    const netPnL = filteredTrades.reduce((acc, x) => {
      if (x.result === "win") return acc + Number(x.reward_amount || 0);
      if (x.result === "loss") return acc - Number(x.risk_amount || 0);
      return acc;
    }, 0);
    const avgRR =
      decided > 0
        ? filteredTrades
            .filter((x) => x.result === "win" || x.result === "loss")
            .reduce((acc, x) => acc + Number(x.rr || 0), 0) / decided
        : 0;

    // توزيع حسب الأصل
    const byAsset = {};
    filteredTrades.forEach((x) => {
      if (!x.asset) return;
      if (!byAsset[x.asset]) byAsset[x.asset] = { wins: 0, losses: 0 };
      if (x.result === "win") byAsset[x.asset].wins += 1;
      if (x.result === "loss") byAsset[x.asset].losses += 1;
    });
    const assetBreakdown = Object.entries(byAsset)
      .map(([asset, v]) => {
        const d = v.wins + v.losses;
        return { asset, decided: d, winRate: d > 0 ? (v.wins / d) * 100 : 0 };
      })
      .filter((a) => a.decided > 0)
      .sort((a, b) => b.decided - a.decided);

    return {
      total: filteredTrades.length,
      wins: wins.length,
      losses: losses.length,
      decided,
      winRate,
      netPnL,
      avgRR,
      assetBreakdown,
    };
  }, [filteredTrades]);

  /* ===== القسم 2: التقدم التعليمي ===== */
  const eduStats = useMemo(() => {
    const progressMap = {};
    progressRows.forEach((p) => {
      progressMap[p.lecture_id] = p;
    });
    const totalLessons = lectures.length;
    const completedRows = progressRows.filter((p) => p.completed);
    const completedCount = completedRows.length;
    const overallPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
    const completedSeconds = lectures
      .filter((l) => progressMap[l.id]?.completed)
      .reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
    const completedHours = completedSeconds / 3600;

    const totalQuizzes = quizAttempts.length;
    const avgQuizPct =
      totalQuizzes > 0
        ? (quizAttempts.reduce((acc, q) => acc + (q.total_questions ? q.score / q.total_questions : 0), 0) /
            totalQuizzes) *
          100
        : 0;

    return { totalLessons, completedCount, overallPct, completedHours, totalQuizzes, avgQuizPct, completedRows };
  }, [lectures, progressRows, quizAttempts]);

  /* ===== القسم 3: الربط الذكي بين التعليم والتداول ===== */
  const smartInsight = useMemo(() => {
    const decidedTrades = trades.filter((x) => x.result === "win" || x.result === "loss");
    const completedSorted = [...eduStats.completedRows]
      .filter((p) => p.last_watched_at)
      .sort((a, b) => new Date(a.last_watched_at) - new Date(b.last_watched_at));

    if (completedSorted.length < 4 || decidedTrades.length < 6) {
      return { type: "generic", text: t("reports.insightGeneric") };
    }

    const midIndex = Math.floor(completedSorted.length / 2);
    const midDate = new Date(completedSorted[midIndex].last_watched_at);

    const before = decidedTrades.filter((x) => new Date(x.trade_date) < midDate);
    const after = decidedTrades.filter((x) => new Date(x.trade_date) >= midDate);

    if (before.length < 3 || after.length < 3) {
      return { type: "generic", text: t("reports.insightGeneric") };
    }

    const winRate = (arr) => (arr.filter((x) => x.result === "win").length / arr.length) * 100;
    const beforeWR = winRate(before);
    const afterWR = winRate(after);
    const delta = afterWR - beforeWR;

    if (delta >= 3) {
      return {
        type: "positive",
        text: t("reports.insightPositive", {
          before: beforeWR.toFixed(0),
          after: afterWR.toFixed(0),
          delta: delta.toFixed(0),
        }),
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
    return (
      <div className="flex flex-col gap-4">
        <SkeletonStatGrid cols={4} />
        <SkeletonStatGrid cols={4} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- الترويسة + فلتر الفترة ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-edge pb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-text-primary">{t("reports.title")}</h1>
          <p className="mt-0.5 text-caption text-text-muted">{t("reports.subtitle")}</p>
        </div>
        <Tabs
          variant="segment"
          value={rangeKey}
          onChange={setRangeKey}
          items={RANGES.map((r) => ({ value: r.key, label: t(r.labelKey) }))}
        />
      </div>

      {/* ---------- الرسالة الذكية — أهم شي بالصفحة، فبتيجي أول ---------- */}
      <Callout tone={smartInsight.type === "positive" ? "success" : "info"}>{smartInsight.text}</Callout>

      {/* ---------- أداء التداول ---------- */}
      <section className="flex flex-col gap-3">
        <p className="eyebrow">{t("reports.tradingPerfTitle")}</p>

        <StatGrid cols={4}>
          <StatCell>
            <Stat label={t("reports.totalTrades")} value={tradingStats.total} />
          </StatCell>
          <StatCell>
            <Stat
              label={t("reports.winRate")}
              value={`${tradingStats.winRate.toFixed(1)}%`}
              tone={tradingStats.winRate >= 50 ? "profit" : "loss"}
            />
          </StatCell>
          <StatCell>
            <Stat
              label={t("reports.netPnl")}
              value={`${tradingStats.netPnL >= 0 ? "$" : "-$"}${fmt(Math.abs(tradingStats.netPnL))}`}
              tone={tradingStats.netPnL >= 0 ? "profit" : "loss"}
            />
          </StatCell>
          <StatCell>
            <Stat label={t("reports.avgRR")} value={tradingStats.avgRR.toFixed(2)} tone="ice" />
          </StatCell>
        </StatGrid>

        {tradingStats.assetBreakdown.length > 0 && (
          <Module level="secondary">
            <ModuleHeader meta={tradingStats.assetBreakdown.length}>
              <ModuleTitle ring={false} tick="ice">
                {t("reports.byAssetTitle")}
              </ModuleTitle>
            </ModuleHeader>
            <ModuleBody className="flex flex-col gap-3">
              {tradingStats.assetBreakdown.map((a) => (
                <div key={a.asset}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="font-mono text-caption text-text-secondary">{a.asset}</span>
                    <span className="ltr-num font-num text-caption text-text-muted">
                      {a.winRate.toFixed(0)}% ({t("reports.tradesSuffix", { count: a.decided })})
                    </span>
                  </div>
                  <ProgressBar value={a.winRate} tone={a.winRate >= 50 ? "profit" : "steel"} />
                </div>
              ))}
            </ModuleBody>
          </Module>
        )}
      </section>

      {/* ---------- التقدّم التعليمي ---------- */}
      <section className="flex flex-col gap-3">
        <p className="eyebrow">{t("reports.eduProgressTitle")}</p>

        <StatGrid cols={4}>
          <StatCell>
            <Stat
              label={t("reports.completedLectures")}
              value={`${eduStats.completedCount} / ${eduStats.totalLessons}`}
            />
          </StatCell>
          <StatCell>
            <Stat label={t("reports.completionRate")} value={`${eduStats.overallPct}%`} tone="value" />
          </StatCell>
          <StatCell>
            <Stat
              label={t("reports.completedHours")}
              value={t("reports.hoursSuffix", { hours: eduStats.completedHours.toFixed(1) })}
            />
          </StatCell>
          <StatCell>
            <Stat
              label={t("reports.avgQuizzes")}
              value={eduStats.totalQuizzes > 0 ? `${eduStats.avgQuizPct.toFixed(0)}%` : "—"}
              sub={
                eduStats.totalQuizzes > 0
                  ? t("reports.attemptsSuffix", { count: eduStats.totalQuizzes })
                  : t("reports.noAttemptsYet")
              }
            />
          </StatCell>
        </StatGrid>

        <Module level="secondary" padding="md">
          <ProgressBar
            label={t("reports.contentCompletionTitle")}
            value={eduStats.overallPct}
            showLabel
            tone="value"
            size="lg"
          />
        </Module>
      </section>
    </div>
  );
}
