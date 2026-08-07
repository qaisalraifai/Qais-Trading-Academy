"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3,
  Bell,
  Calendar,
  Dna,
  FileText,
  Flame,
  GraduationCap,
  Handshake,
  Radar,
  Radio,
  Target,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import AppShell from "../components/layout/AppShell";
import {
  Badge,
  Button,
  Delta,
  Module,
  ModuleBody,
  ModuleHeader,
  ModuleRow,
  ModuleTitle,
  Skeleton,
  SkeletonStatGrid,
  Stat,
  StatCell,
  StatGrid,
  Table,
  TableBody,
  TableEmpty,
  TableHead,
  TableRow,
  TableTd,
  TableTh,
} from "@/app/components/ui";

/* ============================================================================
   مركز القيادة — Overview.
   ----------------------------------------------------------------------------
   التسلسل البصري ثلاث درجات، مش صف بطاقات متطابقة:
     ١· وحدة بطل واحدة (primary) — الأداء + ملخّص الذكاء الاصطناعي مع بعض
     ٢· أربع قراءات ثانوية بكتلة وحدة مفصولة بخطوط شعرية
     ٣· عمودين ثم صفوف هادية

   المنطق الحسابي والاستعلامات ما تغيّر منها ولا سطر — نفس الأرقام بالضبط،
   بس معروضة بنظام.
   ============================================================================ */

const MARKETS = [
  { symbol: "EUR/USD", price: "1.0850", change: 0.12 },
  { symbol: "GBP/USD", price: "1.2700", change: -0.05 },
  { symbol: "XAU/USD", price: "2,045.50", change: 0.85 },
  { symbol: "BTC/USD", price: "43,250", change: 2.15 },
];

const SHORTCUTS_META = [
  { href: "/trading-radar", icon: Radar, labelKey: "nav.radar", descKey: "dashboard.shortcuts.radar" },
  { href: "/replay", icon: Target, labelKey: "nav.replay", descKey: "dashboard.shortcuts.replay" },
  { href: "/economic-calendar", icon: Calendar, labelKey: "nav.calendar", descKey: "dashboard.shortcuts.calendar" },
  { href: "/courses", icon: GraduationCap, labelKey: "nav.lectures", descKey: "dashboard.shortcuts.lectures" },
  { href: "/live-sessions", icon: Radio, labelKey: "nav.live", descKey: "dashboard.shortcuts.live" },
  { href: "/backtest", icon: BarChart3, labelKey: "nav.trades", descKey: "dashboard.shortcuts.trades" },
  { href: "/reports", icon: FileText, labelKey: "nav.reports", descKey: "dashboard.shortcuts.reports" },
  { href: "/trader-dna", icon: Dna, labelKey: "nav.traderDna", descKey: "dashboard.shortcuts.traderDna" },
  { href: "/affiliate", icon: Handshake, labelKey: "nav.affiliateNetwork", descKey: "dashboard.shortcuts.affiliateNetwork" },
];

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function rowToTrade(row) {
  return {
    id: row.id,
    asset: row.asset,
    date: row.trade_date,
    direction: row.direction,
    lot: Number(row.lot),
    entry: Number(row.entry),
    sl: Number(row.sl),
    tp: Number(row.tp),
    result: row.result,
    riskAmount: Number(row.risk_amount),
    rewardAmount: Number(row.reward_amount),
  };
}

export default function DashboardClient({
  username,
  isAdmin = false,
  subscriptionEnd = null,
  currentStreak = 0,
}) {
  const { t } = useLocale();
  const [trades, setTrades] = useState([]);
  const [rawTrades, setRawTrades] = useState([]);
  const [balance, setBalance] = useState(3000);
  const [loading, setLoading] = useState(true);

  const [liveSession, setLiveSession] = useState(null);
  useEffect(() => {
    let cancelled = false;
    async function checkLive() {
      try {
        const res = await fetch("/api/live");
        const data = await res.json();
        if (!cancelled && res.ok) setLiveSession(data.session || null);
      } catch (e) {}
    }
    checkLive();
    const interval = setInterval(checkLive, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(true);
  useEffect(() => {
    let active = true;
    async function loadNotifications() {
      try {
        const res = await fetch("/api/notifications?limit=5");
        const data = await res.json();
        if (active && res.ok) setNotifications(data.items || []);
      } catch (e) {}
      if (active) setNotifLoading(false);
    }
    loadNotifications();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;

      const [{ data: tradesRows }, { data: profile }] = await Promise.all([
        supabase.from("trades").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("profiles").select("backtest_balance").eq("id", user.id).single(),
      ]);

      if (!active) return;
      setRawTrades(tradesRows || []);
      setTrades((tradesRows || []).map(rowToTrade));
      setBalance(Number(profile?.backtest_balance ?? 3000));
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  /* ---------- الحسابات (بدون أي تغيير) ---------- */
  const total = trades.length;
  const wins = trades.filter((x) => x.result === "win").length;
  const losses = trades.filter((x) => x.result === "loss").length;
  const openTrades = trades.filter((x) => !x.result || x.result === "open").length;
  const decided = wins + losses;
  const winRate = decided > 0 ? ((wins / decided) * 100).toFixed(1) : "0.0";
  const netPnL = trades.reduce((acc, x) => {
    if (x.result === "win") return acc + (x.rewardAmount || 0);
    if (x.result === "loss") return acc - (x.riskAmount || 0);
    return acc;
  }, 0);

  const winTrades = trades.filter((x) => x.result === "win");
  const lossTrades = trades.filter((x) => x.result === "loss");
  const bestTrade = winTrades.length ? Math.max(...winTrades.map((x) => x.rewardAmount || 0)) : 0;
  const worstTrade = lossTrades.length ? Math.max(...lossTrades.map((x) => x.riskAmount || 0)) : 0;
  const avgWin = winTrades.length
    ? winTrades.reduce((a, x) => a + (x.rewardAmount || 0), 0) / winTrades.length
    : 0;
  const avgLoss = lossTrades.length
    ? lossTrades.reduce((a, x) => a + (x.riskAmount || 0), 0) / lossTrades.length
    : 0;

  const now = new Date();
  const monthTrades = trades.filter((x) => {
    const d = new Date(x.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthPnL = monthTrades.reduce((acc, x) => {
    if (x.result === "win") return acc + (x.rewardAmount || 0);
    if (x.result === "loss") return acc - (x.riskAmount || 0);
    return acc;
  }, 0);

  const startingCapital = balance - netPnL;

  let running = 0;
  const chartPoints = trades.map((x, i) => {
    if (x.result === "win") running += x.rewardAmount || 0;
    if (x.result === "loss") running -= x.riskAmount || 0;
    return { i, pnl: running, bal: startingCapital + running };
  });
  const maxBal = Math.max(1, startingCapital, ...chartPoints.map((p) => p.bal));
  const minBal = Math.min(startingCapital, ...chartPoints.map((p) => p.bal), 0);
  const balRange = Math.max(1, maxBal - minBal);
  const chartW = 560;
  const chartH = 200;

  function lineFor(key) {
    if (chartPoints.length < 2) return "";
    return chartPoints
      .map((p, idx) => {
        const x = (idx / (chartPoints.length - 1)) * chartW;
        const y = chartH - ((p[key] - minBal) / balRange) * (chartH - 20) - 10;
        return `${idx === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  }
  const balPath = lineFor("bal");
  const pnlPath = lineFor("pnl");
  const balArea = balPath ? `${balPath} L${chartW},${chartH} L0,${chartH} Z` : "";

  const allTradesDesc = [...trades].reverse();
  const recentTrades = allTradesDesc.slice(0, 5);
  const initials = (username || "؟").trim().charAt(0).toUpperCase();

  let daysLeft = null;
  if (subscriptionEnd) {
    const diffMs = new Date(subscriptionEnd) - new Date();
    daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  const monthPct = balance ? ((monthPnL / balance) * 100).toFixed(2) : "0.00";
  const netPct = startingCapital ? ((netPnL / startingCapital) * 100).toFixed(2) : "0.00";

  return (
    <AppShell
      username={username}
      initials={initials}
      isAdmin={isAdmin}
      daysLeft={daysLeft}
      balance={balance}
      showProfileHeader={false}
    >
      {/* ---------- ترويسة ---------- */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-edge pb-4">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Command Center</p>
          <h1 className="truncate text-xl font-semibold text-text-primary">
            {t("dashboard.greeting", { name: username })}
          </h1>
          <p className="mt-0.5 text-caption text-text-muted">{t("dashboard.subtitle")}</p>
        </div>

        {/* شريط الأسواق */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {MARKETS.map((m) => (
            <span key={m.symbol} className="flex items-baseline gap-1.5">
              <span className="font-mono text-micro text-text-muted">{m.symbol}</span>
              <span className="ltr-num font-num text-caption text-text-secondary">{m.price}</span>
              <Delta value={m.change} size="sm" />
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 w-full" />
          <SkeletonStatGrid cols={4} />
        </div>
      ) : (
        <div className="stagger flex flex-col gap-4">
          {/* ============ ١ · وحدة البطل ============ */}
          <Module level="primary">
            <ModuleHeader meta={t("dashboard.performance12Months")}>
              <ModuleTitle>{t("dashboard.performanceTitle")}</ModuleTitle>
            </ModuleHeader>

            <div className="grid gap-0 px-4 pb-4 pt-3 lg:grid-cols-[1.4fr_1fr]">
              {/* الأداء */}
              <div className="lg:pe-5">
                <Stat
                  label={t("dashboard.statCurrentCapital")}
                  value={`$${fmt(balance)}`}
                  tone="value"
                  size="hero"
                  delta={Number(monthPct)}
                  sub={t("dashboard.statCurrentCapitalSub", { amount: `$${fmt(startingCapital)}` })}
                />

                {chartPoints.length > 1 ? (
                  <svg
                    viewBox={`0 0 ${chartW} ${chartH}`}
                    className="mt-4 h-[168px] w-full"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={t("dashboard.performanceTitle")}
                  >
                    <defs>
                      <linearGradient id="qtaBal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#7C4DFF" stopOpacity="0.22" />
                        <stop offset="1" stopColor="#7C4DFF" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[0.25, 0.5, 0.75].map((f) => (
                      <line
                        key={f}
                        x1="0"
                        y1={chartH * f}
                        x2={chartW}
                        y2={chartH * f}
                        stroke="#1E1836"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    {balArea && <path d={balArea} fill="url(#qtaBal)" />}
                    <path
                      d={balPath}
                      fill="none"
                      stroke="#7C4DFF"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                    <path
                      d={pnlPath}
                      fill="none"
                      stroke="#10E5A0"
                      strokeWidth="1.2"
                      strokeDasharray="4 3"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                ) : (
                  <p className="mt-4 flex h-[168px] items-center justify-center text-caption text-text-faint">
                    {t("dashboard.performanceNoData")}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1.5 text-micro text-text-muted">
                    <span className="h-px w-3.5 bg-ice-200" aria-hidden />
                    {t("dashboard.performanceBalance")}
                  </span>
                  <span className="flex items-center gap-1.5 text-micro text-text-muted">
                    <span className="h-px w-3.5 bg-profit" aria-hidden />
                    {t("dashboard.performanceProfit")}
                  </span>
                </div>
              </div>

              {/* الملخّص الذكي + الملخّص السريع */}
              <div className="mt-5 border-t border-edge pt-4 lg:mt-0 lg:border-s lg:border-t-0 lg:ps-5 lg:pt-0">
                <p className="mb-2.5 text-micro uppercase text-text-muted">AI Daily Summary</p>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {total === 0
                    ? t("dashboard.aiSummaryEmpty")
                    : t("dashboard.aiSummaryText", {
                        sign:
                          monthPnL >= 0
                            ? t("dashboard.aiSummaryPositive")
                            : t("dashboard.aiSummaryNegative"),
                        amount: `${monthPnL >= 0 ? "$" : "-$"}${fmt(Math.abs(monthPnL))}`,
                        rate: winRate,
                        total,
                      })}
                </p>

                <div className="mt-4 border-t border-edge pt-3">
                  <p className="mb-1.5 text-micro uppercase text-text-muted">
                    {t("dashboard.quickSummaryTitle")}
                  </p>
                  {[
                    [t("dashboard.bestTrade"), `$${fmt(bestTrade)}`, "profit"],
                    [t("dashboard.worstTrade"), `$${fmt(worstTrade)}`, "loss"],
                    [t("dashboard.avgWin"), `$${fmt(avgWin)}`, "profit"],
                    [t("dashboard.avgLoss"), `$${fmt(avgLoss)}`, "loss"],
                  ].map(([label, value, tone]) => (
                    <div
                      key={label}
                      className="flex items-baseline justify-between gap-3 border-b border-edge py-1.5 last:border-b-0"
                    >
                      <span className="text-caption text-text-muted">{label}</span>
                      <span
                        dir="ltr"
                        className={`font-num text-sm font-medium tabular-nums ${
                          tone === "profit" ? "text-profit" : "text-loss"
                        }`}
                        style={{ unicodeBidi: "isolate" }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <Link href="/reports" className="flex-1">
                    <Button size="sm" variant="secondary" className="w-full">
                      {t("dashboard.viewFullReport")}
                    </Button>
                  </Link>
                  <Link href="/trading-radar" className="flex-1">
                    <Button size="sm" variant="ghost" className="w-full" icon={Radar}>
                      Radar
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </Module>

          {/* ============ ٢ · القراءات الثانوية ============ */}
          <StatGrid cols={4}>
            <StatCell>
              <Stat
                label={t("dashboard.statMonthProfit")}
                value={`${monthPnL >= 0 ? "$" : "-$"}${fmt(Math.abs(monthPnL))}`}
                tone={monthPnL >= 0 ? "profit" : "loss"}
                sub={t("dashboard.statMonthProfitSub", {
                  pct: `${monthPnL >= 0 ? "+" : ""}${monthPct}`,
                })}
              />
            </StatCell>
            <StatCell>
              <Stat
                label={t("dashboard.statNetPnl")}
                value={`${netPnL >= 0 ? "$" : "-$"}${fmt(Math.abs(netPnL))}`}
                tone={netPnL >= 0 ? "profit" : "loss"}
                sub={t("dashboard.statNetPnlSub", { pct: `${netPnL >= 0 ? "+" : ""}${netPct}` })}
              />
            </StatCell>
            <StatCell>
              <Stat
                label={t("dashboard.statWinRate")}
                value={`${winRate}%`}
                sub={t("dashboard.statWinRateSub")}
              />
            </StatCell>
            <StatCell>
              <Stat
                label={t("dashboard.statTotalTrades")}
                value={total}
                tone="ice"
                sub={t("dashboard.statOpenTradesSub", { count: openTrades })}
              />
            </StatCell>
          </StatGrid>

          {/* ============ ٣ · عمودين ============ */}
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            {/* آخر الصفقات */}
            <Module level="secondary">
              <ModuleHeader meta={total ? `${Math.min(5, total)} / ${total}` : undefined}>
                <ModuleTitle ring={false} tick="ice">
                  {t("dashboard.recentActivityAsset")}
                </ModuleTitle>
              </ModuleHeader>
              <div className="px-4 pb-2">
                <Table>
                  <TableHead>
                    <TableTh>{t("dashboard.recentActivityAsset")}</TableTh>
                    <TableTh>{t("dashboard.recentActivityDirection")}</TableTh>
                    <TableTh align="end">{t("dashboard.recentActivityLot")}</TableTh>
                    <TableTh align="end">{t("dashboard.recentActivityEntry")}</TableTh>
                    <TableTh align="end">{t("dashboard.recentActivityExit")}</TableTh>
                    <TableTh align="end">{t("dashboard.recentActivityDate")}</TableTh>
                  </TableHead>
                  <TableBody>
                    {recentTrades.length === 0 ? (
                      <TableEmpty colSpan={6}>
                        {t("dashboard.recentActivityEmpty1")}
                        <br />
                        {t("dashboard.recentActivityEmpty2")}
                      </TableEmpty>
                    ) : (
                      recentTrades.map((x) => (
                        <TableRow key={x.id}>
                          <TableTd strong className="font-mono">
                            {x.asset}
                          </TableTd>
                          <TableTd
                            className={x.direction === "buy" ? "text-profit" : "text-loss"}
                          >
                            {x.direction === "buy" ? t("dashboard.buy") : t("dashboard.sell")}
                          </TableTd>
                          <TableTd numeric align="end">
                            {x.lot}
                          </TableTd>
                          <TableTd numeric align="end">
                            {x.entry}
                          </TableTd>
                          <TableTd numeric align="end">
                            {x.tp}
                          </TableTd>
                          <TableTd numeric align="end" className="text-text-muted">
                            {x.date}
                          </TableTd>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="border-t border-edge p-3">
                <Link href="/backtest">
                  <Button variant="ghost" size="sm" className="w-full" icon={TrendingUp}>
                    {t("dashboard.viewAllTrades")}
                  </Button>
                </Link>
              </div>
            </Module>

            {/* التعلّم + الإشعارات */}
            <div className="flex flex-col gap-4">
              <Module level="secondary">
                <ModuleHeader
                  meta={
                    currentStreak > 0 ? (
                      <span className="flex items-center gap-1 text-au-200">
                        <Flame className="h-3 w-3" aria-hidden />
                        <span className="ltr-num">{currentStreak}</span>
                      </span>
                    ) : undefined
                  }
                >
                  <ModuleTitle ring={false} tick="au">
                    {t("nav.lectures")}
                  </ModuleTitle>
                </ModuleHeader>
                <ModuleBody>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {currentStreak > 0
                      ? t("dashboard.streakText", { days: currentStreak })
                      : t("dashboard.noStreakText")}
                  </p>
                  <Link href="/courses" className="mt-3 block">
                    <Button variant="secondary" size="sm" className="w-full" icon={GraduationCap}>
                      {t("dashboard.openWorkspace")}
                    </Button>
                  </Link>
                </ModuleBody>
              </Module>

              <Module level="secondary" className="flex-1">
                <ModuleHeader meta={notifications.length || undefined}>
                  <ModuleTitle ring={false} tick="ice">
                    <Bell className="me-1 inline h-3 w-3" aria-hidden />
                    {t("header.notifications")}
                  </ModuleTitle>
                </ModuleHeader>
                <div className="px-4 pb-3">
                  {notifLoading ? (
                    <div className="flex flex-col gap-2 py-1">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <p className="py-4 text-center text-caption text-text-faint">
                      {t("dashboard.notificationsEmpty")}
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <ModuleRow key={n.id}>
                        <span
                          className={`tick shrink-0 ${n.read ? "" : "tick-ice"}`}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-caption ${
                              n.read ? "text-text-muted" : "font-medium text-text-primary"
                            }`}
                          >
                            {n.title}
                          </span>
                          {n.message && (
                            <span className="block truncate text-micro text-text-faint">
                              {n.message}
                            </span>
                          )}
                        </span>
                      </ModuleRow>
                    ))
                  )}
                </div>
              </Module>
            </div>
          </div>

          {/* ============ ٤ · الاختصارات ============ */}
          <Module level="secondary">
            <ModuleHeader>
              <ModuleTitle ring={false} tick="">
                {t("dashboard.shortcutsTitle")}
              </ModuleTitle>
            </ModuleHeader>
            <div className="grid gap-px bg-edge p-px sm:grid-cols-2 lg:grid-cols-3">
              {SHORTCUTS_META.map((s) => {
                const Icon = s.icon;
                const isLive = s.href === "/live-sessions" && liveSession;
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="group flex items-start gap-3 bg-module-1 p-3.5 transition-colors duration-base ease-orbit hover:bg-module-2"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center border border-edge text-text-muted transition-colors duration-base group-hover:border-edge-lit group-hover:text-ice-200">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-caption font-medium text-text-primary">
                          {t(s.labelKey)}
                        </span>
                        {isLive && (
                          <Badge variant="live" size="sm">
                            {t("dashboard.liveNow")}
                          </Badge>
                        )}
                      </span>
                      <span className="mt-0.5 block text-micro leading-relaxed text-text-muted">
                        {t(s.descKey)}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </Module>
        </div>
      )}
    </AppShell>
  );
}
