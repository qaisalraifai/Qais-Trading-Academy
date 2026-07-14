"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import BacktestClient from "../backtest/BacktestClient";
import ReplayClient from "../replay/ReplayClient";
import AccountsAdminView from "./components/AccountsAdminView";
import LiveView from "./components/LiveView";
import SettingsView from "./components/SettingsView";
import TraderDnaView from "./components/TraderDnaView";
import ReportsView from "./components/ReportsView";
import AffiliateClient from "../affiliate/AffiliateClient";
import MlmClient from "../mlm/MlmClient";
import AppShell from "../components/layout/AppShell";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2D57E";
const GOLD_DARK = "#9C7A22";
const GREEN = "#02C076";
const RED = "#F6465D";

const NAV_ITEMS = [
  { key: "accounts", label: "إدارة الحسابات", icon: "👥", view: "accounts" },
  { key: "live", label: "البث المباشر", icon: "🔴", view: "live" },
  { key: "trader-dna", label: "بصمتك كمتداول", icon: "🧬", view: "trader-dna" },
  { key: "lectures", label: "المحاضرات", icon: "🎓", view: "lectures" },
  { key: "calendar", label: "التقويم الاقتصادي", icon: "📅", view: "calendar" },
  { key: "replay", label: "Replay التدريب", icon: "🎯", view: "replay" },
  { key: "strategies", label: "الاستراتيجيات", icon: "🧩", view: "strategies" },
  { key: "trades", label: "الصفقات", icon: "📊", view: "backtest" },
  { key: "reports", label: "التقارير", icon: "📋", view: "reports" },
  { key: "settings", label: "الإعدادات", icon: "⚙️", view: "settings" },
];

const PLACEHOLDER_LABELS = {
  strategies: "الاستراتيجيات",
  reports: "التقارير",
};

const MARKETS = [
  { symbol: "EUR/USD", price: "1.0850", change: "+0.12%", up: true },
  { symbol: "GBP/USD", price: "1.2700", change: "-0.05%", up: false },
  { symbol: "XAU/USD", price: "2,045.50", change: "+0.85%", up: true },
  { symbol: "BTC/USD", price: "43,250", change: "+2.15%", up: true },
];

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* تحويل صف قاعدة البيانات (snake_case) لشكل الأداة الداخلي */
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

/* بطاقة عامة موحّدة بالتصميم الذهبي */
const cardStyle = {
  background: "linear-gradient(145deg, #22252B, #181A20)",
  border: `1px solid ${GOLD}26`,
  borderRadius: 18,
  boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
};

/* أيقونة عَلَم/شارة ذهبية صغيرة تُستخدم بزاوية بطاقات الإحصائيات - العنصر البصري المميز للتصميم */
function FlagBadge({ children }) {
  return (
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: 7,
        background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        flexShrink: 0,
        boxShadow: `0 2px 8px ${GOLD}55`,
      }}
    >
      {children}
    </div>
  );
}

export default function DashboardClient({ username, isAdmin = false, subscriptionEnd = null, currentStreak = 0 }) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [trades, setTrades] = useState([]); // بترتيب زمني تصاعدي (الأقدم أولاً) - للرسم البياني
  const [rawTrades, setRawTrades] = useState([]); // الشكل الخام من قاعدة البيانات - تحتاجه أداة الباك تيست
  const [balance, setBalance] = useState(3000);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  // التنقل الداخلي داخل نفس الصفحة (بدون الخروج من الداشبورد)
  // إذا الرابط جاي بـ ?tab=accounts (مثلاً من صفحة إدارة المحاضرات) نفتح على هاد التبويب مباشرة
  const [activeKey, setActiveKey] = useState(
    tabParam && (tabParam !== "accounts" || isAdmin) ? tabParam : "dashboard"
  );

  // بث مباشر نشط هلأ؟ (بنفحصها بكل الصفحة عشان نظهر شارة 🔴 بالقائمة الجانبية بغض النظر عن التبويب المفتوح)
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
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const [courses, setCourses] = useState([]);
  const [allLectures, setAllLectures] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedLecture, setSelectedLecture] = useState(null);

  const [economicEvents, setEconomicEvents] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  useEffect(() => {
    if (activeKey !== "calendar" || economicEvents.length > 0) return;
    let active = true;
    async function loadCalendar() {
      setCalendarLoading(true);
      const supabase = createClient();
      // نجيب بس من أمس فصاعدًا (مش كل الأرشيف المتراكم بقاعدة البيانات) —
      // هيك ما تضل أخبار الأسابيع الفاتت عالقة بأول القائمة وبفلتر الأيام.
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 1);
      const fromDateStr = fromDate.toISOString().split("T")[0];

      const { data } = await supabase
        .from("economic_events")
        .select("*")
        .gte("event_date", fromDateStr)
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true });
      if (!active) return;
      setEconomicEvents(data || []);
      setCalendarLoading(false);
    }
    loadCalendar();
    return () => {
      active = false;
    };
  }, [activeKey, economicEvents.length]);

  useEffect(() => {
    if (activeKey !== "lectures" || courses.length > 0) return;
    let active = true;
    async function loadLectures() {
      setLecturesLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const [{ data: coursesData }, { data: lecturesData }, progressResult] = await Promise.all([
        supabase.from("courses").select("*").order("order_index", { ascending: true }),
        supabase
          .from("lectures")
          .select("*")
          .order("chapter_order", { ascending: true })
          .order("order_index", { ascending: true }),
        user
          ? supabase.from("lecture_progress").select("*").eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
      ]);

      if (!active) return;
      const pMap = {};
      (progressResult.data || []).forEach((p) => {
        pMap[p.lecture_id] = p;
      });
      setCourses(coursesData || []);
      setAllLectures(lecturesData || []);
      setProgressMap(pMap);
      setLecturesLoading(false);
    }
    loadLectures();
    return () => {
      active = false;
    };
  }, [activeKey, courses.length]);

  // نحدّث بيانات لوحة التحكم كل مرة نرجع لها (مثلاً بعد إضافة صفقات من تبويب الباك تيست)
  useEffect(() => {
    if (activeKey !== "dashboard") return;
    let active = true;
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;
      setUserId(user.id);

      const [{ data: tradesRows }, { data: profile }] = await Promise.all([
        supabase
          .from("trades")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
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
  }, [activeKey]);

  const total = trades.length;
  const wins = trades.filter((t) => t.result === "win").length;
  const losses = trades.filter((t) => t.result === "loss").length;
  const openTrades = trades.filter((t) => !t.result || t.result === "open").length;
  const decided = wins + losses;
  const winRate = decided > 0 ? ((wins / decided) * 100).toFixed(1) : "0.0";
  const netPnL = trades.reduce((acc, t) => {
    if (t.result === "win") return acc + (t.rewardAmount || 0);
    if (t.result === "loss") return acc - (t.riskAmount || 0);
    return acc;
  }, 0);

  const winTrades = trades.filter((t) => t.result === "win");
  const lossTrades = trades.filter((t) => t.result === "loss");
  const bestTrade = winTrades.length ? Math.max(...winTrades.map((t) => t.rewardAmount || 0)) : 0;
  const worstTrade = lossTrades.length ? Math.max(...lossTrades.map((t) => t.riskAmount || 0)) : 0;
  const avgWin = winTrades.length ? winTrades.reduce((a, t) => a + (t.rewardAmount || 0), 0) / winTrades.length : 0;
  const avgLoss = lossTrades.length ? lossTrades.reduce((a, t) => a + (t.riskAmount || 0), 0) / lossTrades.length : 0;

  const now = new Date();
  const monthTrades = trades.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthPnL = monthTrades.reduce((acc, t) => {
    if (t.result === "win") return acc + (t.rewardAmount || 0);
    if (t.result === "loss") return acc - (t.riskAmount || 0);
    return acc;
  }, 0);

  const startingCapital = balance - netPnL;

  let running = 0;
  const chartPoints = trades.map((t, i) => {
    if (t.result === "win") running += t.rewardAmount || 0;
    if (t.result === "loss") running -= t.riskAmount || 0;
    return { i, pnl: running, bal: startingCapital + running };
  });
  const maxBal = Math.max(1, startingCapital, ...chartPoints.map((p) => p.bal));
  const minBal = Math.min(startingCapital, ...chartPoints.map((p) => p.bal), 0);
  const balRange = Math.max(1, maxBal - minBal);
  const chartW = 560,
    chartH = 200;

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

  const allTradesDesc = [...trades].reverse(); // الأحدث أولاً للعرض بالجدول
  const recentTrades = allTradesDesc.slice(0, 5);
  const initials = (username || "؟").trim().charAt(0).toUpperCase();

  let daysLeft = null;
  if (subscriptionEnd) {
    const diffMs = new Date(subscriptionEnd) - new Date();
    daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  return (
    <AppShell
      username={username}
      initials={initials}
      isAdmin={isAdmin}
      daysLeft={daysLeft}
      activeKey={activeKey}
      setActiveKey={setActiveKey}
      onNavToLectures={() => { setSelectedLecture(null); setSelectedCourseId(null); }}
      showProfileHeader={false}
    >
      <style>{`
        @keyframes pulseLive {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>

      {/* Main content */}
      <div style={{ flex: 1, padding: "1.6rem 2rem", overflowY: "auto" }}>
        {/* Header: بطاقة البروفايل + الترحيب - مخفي بتبويب المحاضرات لأنه إله بانر خاص فيه */}
        {activeKey !== "lectures" && activeKey !== "calendar" && (
        <div
          style={{
            ...cardStyle,
            padding: "1.1rem 1.6rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1.4rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 800,
                color: "#1a1608",
                flexShrink: 0,
                border: `2px solid ${GOLD}`,
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 800 }}>{username}</span>
                <span
                  style={{
                    background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})`,
                    color: "#1a1608",
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: 6,
                  }}
                >
                  VIP
                </span>
              </div>
              <p style={{ color: "#888", fontSize: 12, margin: "3px 0 0" }}>متداول محترف</p>
              <div
                style={{
                  marginTop: 6,
                  display: "inline-block",
                  background: "#0f3d2c",
                  border: `1px solid ${GREEN}33`,
                  color: GREEN,
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "0.3rem 0.8rem",
                  borderRadius: 20,
                }}
              >
                💰 ${fmt(balance)}
              </div>
            </div>
          </div>

          <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 10 }}>
            <div>
              <p style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>مرحباً بك {username}، 👋</p>
              <p style={{ color: "#555", fontSize: 13, margin: "4px 0 0" }}>نظرة عامة على أدائك في التداول</p>
            </div>
            <span style={{ fontSize: 22 }}>✨</span>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "#111",
                border: `1px solid ${GOLD}33`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                flexShrink: 0,
              }}
            >
              🔔
            </div>
          </div>
        </div>
        )}

        {activeKey === "accounts" && isAdmin ? (
          <AccountsAdminView username={username} />
        ) : activeKey === "live" ? (
          <LiveView isAdmin={isAdmin} username={username} />
        ) : activeKey === "trader-dna" ? (
          <TraderDnaView userId={userId} />
        ) : activeKey === "reports" ? (
          <ReportsView userId={userId} />
        ) : activeKey === "calendar" ? (
          <CalendarView events={economicEvents} loading={calendarLoading} isAdmin={isAdmin} />
        ) : activeKey === "lectures" ? (
          <LecturesView
            username={username}
            currentStreak={currentStreak}
            courses={courses}
            allLectures={allLectures}
            progressMap={progressMap}
            loading={lecturesLoading}
            selectedCourseId={selectedCourseId}
            onSelectCourse={setSelectedCourseId}
            onBackToCourses={() => setSelectedCourseId(null)}
            selectedLecture={selectedLecture}
            onSelect={setSelectedLecture}
            onBack={() => setSelectedLecture(null)}
          />
        ) : activeKey === "replay" ? (
          <ReplayClient userId={userId} />
        ) : activeKey === "settings" ? (
          <SettingsView username={username} />
        ) : activeKey === "affiliate" ? (
          <AffiliateClient embedded />
        ) : activeKey === "mlm" ? (
          <MlmClient embedded />
        ) : activeKey === "backtest" ? (
          userId ? (
            <BacktestClient
              key={userId}
              userId={userId}
              username={username}
              initialBalance={balance}
              initialTrades={rawTrades}
              onExit={() => setActiveKey("dashboard")}
            />
          ) : (
            <div style={{ color: "#666", fontSize: 14, padding: "3rem 0", textAlign: "center" }}>...جاري التحميل</div>
          )
        ) : activeKey !== "dashboard" ? (
          <div style={{ ...cardStyle, padding: "3rem", textAlign: "center", color: "#666", fontSize: 14 }}>
            {PLACEHOLDER_LABELS[activeKey]} — قريباً
          </div>
        ) : loading ? (
          <div style={{ color: "#666", fontSize: 14, padding: "3rem 0", textAlign: "center" }}>...جاري تحميل بياناتك</div>
        ) : (
          <>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.9rem", marginBottom: "1.4rem" }}>
              {[
                {
                  label: "ربح الشهر",
                  value: `${monthPnL >= 0 ? "$" : "-$"}${fmt(Math.abs(monthPnL))}`,
                  icon: "💵",
                  color: monthPnL >= 0 ? GREEN : RED,
                  sub: `${monthPnL >= 0 ? "+" : ""}${balance ? ((monthPnL / balance) * 100).toFixed(2) : "0.00"}% من رأس المال`,
                },
                {
                  label: "رأس المال الحالي",
                  value: `$${fmt(balance)}`,
                  icon: "💼",
                  color: GOLD_LIGHT,
                  sub: `بداية من $${fmt(startingCapital)}`,
                },
                {
                  label: "صافي الربح/الخسارة",
                  value: `${netPnL >= 0 ? "$" : "-$"}${fmt(Math.abs(netPnL))}`,
                  icon: "📈",
                  color: netPnL >= 0 ? GREEN : RED,
                  sub: `${netPnL >= 0 ? "+" : ""}${startingCapital ? ((netPnL / startingCapital) * 100).toFixed(2) : "0.00"}% من رأس مال البداية`,
                },
                {
                  label: "نسبة النجاح",
                  value: `${winRate}%`,
                  icon: "🎯",
                  color: "#fff",
                  sub: "الهدف القادم: 70%",
                },
                {
                  label: "إجمالي الصفقات",
                  value: total,
                  icon: "📷",
                  color: "#fff",
                  sub: `${openTrades} صفقة مفتوحة`,
                },
              ].map((s, i) => (
                <div key={i} style={{ ...cardStyle, padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <FlagBadge>{s.icon}</FlagBadge>
                  </div>
                  <p style={{ color: "#777", fontSize: 11, margin: "0.7rem 0 0.3rem" }}>{s.label}</p>
                  <p style={{ color: s.color, fontSize: 21, fontWeight: 800, margin: 0 }}>{s.value}</p>
                  <p style={{ color: "#555", fontSize: 10, margin: "0.4rem 0 0" }}>{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Chart + Quick summary */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.9rem", marginBottom: "1.4rem", alignItems: "stretch" }}>
              <div style={{ ...cardStyle, padding: "1.3rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: 8 }}>
                  <p style={{ color: GOLD, fontSize: 14, fontWeight: 700, margin: 0 }}>📈 الأداء</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#888", fontSize: 11 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: GOLD_LIGHT, display: "inline-block" }} /> الرصيد
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#888", fontSize: 11 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: GREEN, display: "inline-block" }} /> الربح
                    </span>
                    <div style={{ background: "#111", border: `1px solid ${GOLD}33`, color: "#aaa", fontSize: 11, padding: "0.35rem 0.8rem", borderRadius: 20 }}>تفصيلي ⌄</div>
                    <div style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD_LIGHT, fontSize: 11, fontWeight: 700, padding: "0.35rem 0.8rem", borderRadius: 20 }}>12 شهر</div>
                  </div>
                </div>
                {chartPoints.length > 1 ? (
                  <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: "100%", height: 230 }}>
                    <line x1="0" y1={chartH - 10} x2={chartW} y2={chartH - 10} stroke="#221c0c" strokeWidth="1" />
                    <path d={balPath} fill="none" stroke={GOLD_LIGHT} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                    <path d={pnlPath} fill="none" stroke={GREEN} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                ) : (
                  <div style={{ height: 190, display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontSize: 12 }}>
                    لا توجد بيانات كافية بعد — ضيف صفقات من صفحة الباك تيست
                  </div>
                )}
              </div>

              {/* Quick summary */}
              <div style={{ ...cardStyle, padding: "1.3rem", display: "flex", flexDirection: "column" }}>
                <p style={{ color: GOLD, fontSize: 14, fontWeight: 700, margin: "0 0 0.9rem" }}>⚡ ملخص سريع</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem", flex: 1 }}>
                  {[
                    { label: "أفضل صفقة", value: `$${fmt(bestTrade)}`, color: GREEN, icon: "🏆" },
                    { label: "أسوأ صفقة", value: `$${fmt(worstTrade)}`, color: RED, icon: "🛡️" },
                    { label: "متوسط الربح", value: `$${fmt(avgWin)}`, color: GREEN, icon: "📈" },
                    { label: "متوسط الخسارة", value: `$${fmt(avgLoss)}`, color: RED, icon: "📉" },
                  ].map((row, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < 3 ? "1px solid #1a1a0f" : "none", paddingBottom: "0.6rem" }}>
                      <div>
                        <p style={{ color: "#777", fontSize: 11, margin: 0 }}>{row.label}</p>
                        <p style={{ color: row.color, fontSize: 15, fontWeight: 800, margin: "2px 0 0" }}>{row.value}</p>
                      </div>
                      <span style={{ fontSize: 16, opacity: 0.7 }}>{row.icon}</span>
                    </div>
                  ))}
                </div>
                <div
                  onClick={() => setActiveKey("reports")}
                  style={{
                    marginTop: "1rem",
                    textAlign: "center",
                    border: `1px solid ${GOLD}44`,
                    color: GOLD_LIGHT,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "0.6rem",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  عرض التقرير الكامل
                </div>
              </div>
            </div>

            {/* Recent trades + Market summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "0.9rem" }}>
              <div style={{ ...cardStyle, padding: "1.3rem" }}>
                <p style={{ color: GOLD, fontSize: 14, fontWeight: 700, margin: "0 0 1rem" }}>📊 الصفقات الأخيرة</p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                    <thead>
                      <tr>
                        {["الأصل", "الاتجاه", "الحجم", "الدخول", "الخروج", "التاريخ"].map((h) => (
                          <th key={h} style={{ color: "#666", fontSize: 11, padding: "0.6rem", borderBottom: "1px solid #1a1a0a", textAlign: "center" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recentTrades.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: "center", color: "#444", padding: "2.2rem 0" }}>
                            📈
                            <br />
                            لا توجد صفقات حتى الآن
                            <br />
                            ابدأ التداول لرؤية صفقاتك هنا
                          </td>
                        </tr>
                      ) : (
                        recentTrades.map((t) => (
                          <tr key={t.id}>
                            <td style={cellStyle}>{t.asset}</td>
                            <td style={{ ...cellStyle, color: t.direction === "buy" ? GREEN : RED }}>{t.direction === "buy" ? "▲ شراء" : "▼ بيع"}</td>
                            <td style={cellStyle}>{t.lot}</td>
                            <td style={cellStyle}>{t.entry}</td>
                            <td style={cellStyle}>{t.tp}</td>
                            <td style={cellStyle}>{t.date}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div
                  onClick={() => setActiveKey("backtest")}
                  style={{
                    marginTop: "1rem",
                    textAlign: "center",
                    border: `1px solid ${GOLD}33`,
                    color: "#aaa",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "0.6rem",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  عرض جميع الصفقات
                </div>
              </div>

              <div style={{ ...cardStyle, padding: "1.3rem" }}>
                <p style={{ color: GOLD, fontSize: 14, fontWeight: 700, margin: "0 0 1rem" }}>🌐 ملخص الأسواق</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {MARKETS.map((m) => (
                    <div
                      key={m.symbol}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.7rem 0.9rem",
                        background: "#181A20",
                        borderRight: `3px solid ${m.up ? GREEN : RED}`,
                        borderRadius: 8,
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{m.symbol}</span>
                      <span style={{ fontSize: 13, color: "#ccc" }}>{m.price}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: m.up ? GREEN : RED }}>{m.change}</span>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: "1rem",
                    textAlign: "center",
                    border: `1px solid ${GOLD}33`,
                    color: "#aaa",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "0.6rem",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  عرض المزيد من الأسواق
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

const cellStyle = { padding: "0.7rem", fontSize: 12, textAlign: "center", borderBottom: "1px solid #1a1a0f" };

const DIFFICULTY_LABELS = {
  beginner: { label: "مبتدئ", color: "#4CAF50" },
  intermediate: { label: "متوسط", color: "#FFA726" },
  advanced: { label: "متقدم", color: "#EF5350" },
};

const LECTURE_FILTERS = [
  { key: "all", label: "الكل" },
  { key: "completed", label: "مكتملة" },
  { key: "incomplete", label: "غير مكتملة" },
  { key: "favorite", label: "المفضلة" },
];

function formatDuration(seconds) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatLastWatched(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  return date.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

const COURSE_COLORS = [
  { solid: "#3DDC84", soft: "#3DDC8422", border: "#3DDC8455" },
  { solid: "#B084F5", soft: "#B084F522", border: "#B084F555" },
  { solid: "#4FA0F5", soft: "#4FA0F522", border: "#4FA0F555" },
];

const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced"];
const DIFFICULTY_AR = { beginner: "مبتدئ", intermediate: "متوسط", advanced: "متقدم" };

const IMPACT_STYLE = {
  high: { label: "عالي التأثير", color: "#EF5350", bg: "#EF535022", dot: "🔴" },
  medium: { label: "متوسط", color: "#FFA726", bg: "#FFA72622", dot: "🟡" },
  low: { label: "منخفض", color: "#8BC34A", bg: "#8BC34A22", dot: "🟢" },
  holiday: { label: "عطلة", color: "#4FA0F5", bg: "#4FA0F522", dot: "🔵" },
};

const CURRENCY_FLAGS = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", CHF: "🇨🇭",
  CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿", CNY: "🇨🇳",
};

const DIRECTION_STYLE = {
  up: { arrow: "⬆️", color: "#3DDC84" },
  down: { arrow: "⬇️", color: "#EF5350" },
  neutral: { arrow: "➖", color: "#999" },
};

const STRENGTH_LABEL_AR = { strong: "قوي", medium: "متوسط", weak: "ضعيف" };

const CURRENCY_ANALYSIS_INFO = {
  USD: { name: "الدولار الأمريكي", assets: "الذهب (XAUUSD) والمؤشرات الأمريكية مثل ناسداك وS&P 500" },
  EUR: { name: "اليورو", assets: "زوج EURUSD والمؤشرات الأوروبية" },
  GBP: { name: "الجنيه الإسترليني", assets: "زوج GBPUSD ومؤشر FTSE" },
  JPY: { name: "الين الياباني", assets: "زوج USDJPY ومؤشر نيكاي" },
  CHF: { name: "الفرنك السويسري", assets: "زوج USDCHF" },
  CAD: { name: "الدولار الكندي", assets: "زوج USDCAD وأسعار النفط" },
  AUD: { name: "الدولار الأسترالي", assets: "زوج AUDUSD والمعادن الصناعية" },
  NZD: { name: "الدولار النيوزيلندي", assets: "زوج NZDUSD" },
  CNY: { name: "اليوان الصيني", assets: "الأسواق الآسيوية والذهب" },
};

// تحليل عام مبدئي يظهر فوراً لأي خبر إلى حين توفر التحليل التفصيلي بالذكاء الاصطناعي
function buildFallbackAnalysis(event) {
  const info = CURRENCY_ANALYSIS_INFO[event?.currency] || {
    name: event?.currency || "العملة المرتبطة بالخبر",
    assets: "الأصول والمؤشرات المرتبطة بها",
  };
  const impactLabel = event?.impact === "high" ? "مرتفع" : event?.impact === "medium" ? "متوسط" : "محدود";

  return `بشكل عام، إذا جاءت قراءة "${event?.event_title || "هذا الخبر"}" أعلى من التوقعات، فغالباً ما يدعم ذلك ${info.name} ويُشكّل ضغطاً على ${info.assets}. أما إذا جاءت القراءة أقل من المتوقع، فالسيناريو المعتاد هو العكس: ضعف نسبي في ${info.name} ودعم لتلك الأصول. باعتبار هذا خبراً ${impactLabel} التأثير، يُنصح بمتابعة الحركة السعرية عن كثب وقت صدور البيانات، والانتباه لاحتمال التقلب المفاجئ خصوصاً إذا جاءت النتيجة بعيدة عن التوقعات.`;
}

const GENERIC_TIPS_BEFORE = [
  "تجنّب فتح صفقات جديدة قبل دقائق من صدور الخبر مباشرة",
  "راقب اتساع السبريد (Spread) فقد يزيد بشكل كبير قبل الحدث",
  "قلّل حجم اللوت إذا كنت لسا داخل صفقة قبل الخبر",
];
const GENERIC_TIPS_AFTER = [
  "انتظر إغلاق الشمعة الأولى بعد الخبر قبل الدخول لتفادي الحركة الوهمية",
  "استخدم وقف خسارة (Stop Loss) واضح نظراً لاحتمال التقلب العالي",
  "قارن الرقم الفعلي بالتوقع لتحديد اتجاه السوق الأرجح",
];

function formatCountdown(diffMs) {
  if (diffMs <= 0) return null;
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days} يوم ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const PURPLE = "#7c5cff";
const PURPLE_LIGHT = "#B084F5";

/* Mini Sparkline */
function Sparkline({ data, color, width = 60, height = 24 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* عداد نصف دائري (Gauge) يُستخدم لقوة تأثير الخبر ومؤشر الخوف والطمع */
function SemiGauge({ value, size = 150, colors, gradId }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const w = size;
  const h = size * 0.58;
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = h;
  const circumference = Math.PI * r;
  const progress = v / 100;
  const dash = circumference * progress;
  const angleDeg = 180 - progress * 180;
  const angleRad = (angleDeg * Math.PI) / 180;
  const needleX = cx + r * 0.72 * Math.cos(angleRad);
  const needleY = cy - r * 0.72 * Math.sin(angleRad);
  const id = `grad-${gradId}`;
  return (
    <svg width={w} height={h + 14} viewBox={`0 0 ${w} ${h + 14}`}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          {colors.map((c, i) => (
            <stop key={i} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#1a1a12" strokeWidth="13" strokeLinecap="round" />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="13"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
      />
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4.5" fill="#fff" />
    </svg>
  );
}

const CCY_LIST = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD"];

/* صف تحميل/خطأ موحّد لبطاقات البيانات الحية */
function LiveCardStatus({ label }) {
  return <p style={{ margin: 0, fontSize: 11, color: "#666", textAlign: "center", padding: "0.6rem 0" }}>{label}</p>;
}

/* خريطة قوة العملات — بيانات حقيقية محسوبة من أزواج الفوركس الفعلية عبر Yahoo Finance */
function CurrencyStrengthMeter({ snapshot, loading, error }) {
  const values = useMemo(() => {
    if (!snapshot?.currencies) return [];
    return CCY_LIST.map((c) => ({ code: c, value: snapshot.currencies[c] }))
      .filter((v) => v.value != null)
      .sort((a, b) => b.value - a.value);
  }, [snapshot]);

  return (
    <div style={{ ...cardStyle, padding: "1.1rem 1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#fff" }}>💱 خريطة قوة العملات</p>
        <span style={{ fontSize: 8.5, color: "#555" }}>Yahoo Finance</span>
      </div>
      {loading && !snapshot ? (
        <LiveCardStatus label="⏳ جاري تحميل بيانات السوق الحية..." />
      ) : error && values.length === 0 ? (
        <LiveCardStatus label="⚠️ تعذر تحميل البيانات الحية حالياً" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          {values.map((v) => {
            const color = v.value >= 68 ? "#3DDC84" : v.value >= 42 ? GOLD_LIGHT : "#EF5350";
            return (
              <div key={v.code}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11.5, color: "#ccc", fontWeight: 700 }}>
                    {CURRENCY_FLAGS[v.code] || "🌐"} {v.code}
                  </span>
                  <span style={{ fontSize: 11.5, color, fontWeight: 700 }}>{v.value}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 6, background: "#1a1a12", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${v.value}%`, background: color, borderRadius: 6 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const HEATMAP_SECTORS = ["Forex", "Stocks", "Commodities", "Bonds", "Crypto", "Indices"];
const HEATMAP_SYMBOL_LABEL = { Forex: "DXY", Stocks: "S&P 500", Commodities: "Gold", Bonds: "TLT", Crypto: "Bitcoin", Indices: "Nasdaq" };

/* خريطة الحرارة للأسواق — نسبة تغيّر يومية حقيقية لرمز ممثّل بكل قطاع (Yahoo Finance) */
function MarketHeatmap({ snapshot, loading, error }) {
  const values = snapshot?.heatmap || [];
  const hasData = values.some((v) => v.pct != null);
  return (
    <div style={{ ...cardStyle, padding: "1.1rem 1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#fff" }}>🗺️ خريطة الحرارة للأسواق</p>
        <span style={{ fontSize: 8.5, color: "#555" }}>Yahoo Finance</span>
      </div>
      {loading && !snapshot ? (
        <LiveCardStatus label="⏳ جاري تحميل بيانات السوق الحية..." />
      ) : error && !hasData ? (
        <LiveCardStatus label="⚠️ تعذر تحميل البيانات الحية حالياً" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.55rem" }}>
          {HEATMAP_SECTORS.map((sector) => {
            const v = values.find((x) => x.sector === sector);
            if (!v || v.pct == null) {
              return (
                <div key={sector} style={{ background: "#181A20", border: `1px solid ${GOLD}18`, borderRadius: 10, padding: "0.7rem 0.4rem", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 10.5, color: "#666", fontWeight: 600 }}>{sector}</p>
                  <p style={{ margin: "5px 0 0", fontSize: 12, color: "#444" }}>--</p>
                </div>
              );
            }
            const up = v.pct >= 0;
            const bg = up ? `rgba(61,220,132,${Math.min(0.45, 0.15 + Math.abs(v.pct) / 8)})` : `rgba(239,83,80,${Math.min(0.45, 0.15 + Math.abs(v.pct) / 8)})`;
            const border = up ? "#3DDC8455" : "#EF535055";
            return (
              <div key={sector} title={HEATMAP_SYMBOL_LABEL[sector]} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "0.7rem 0.4rem", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 10.5, color: "#ddd", fontWeight: 600 }}>{sector}</p>
                <p style={{ margin: "5px 0 0", fontSize: 14, fontWeight: 800, color: up ? "#3DDC84" : "#EF5350", direction: "ltr" }}>
                  {up ? "+" : ""}
                  {v.pct}%
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* رسم بياني لتوقع حركة الدولار مع اختيار الفترة الزمنية */
/* رسم بياني حقيقي لحركة DXY (مؤشر الدولار) من Yahoo Finance + متوسط متحرك SMA(5) حقيقي مشتق من نفس البيانات */
function PriceChart() {
  const [tf, setTf] = useState("1D");
  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    setChartError(null);
    fetch(`/api/market-intelligence?type=chart&tf=${tf}`)
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data?.points?.length > 1) setChartData(data);
        else setChartError(data?.error || "لا تتوفر بيانات كافية حالياً");
      })
      .catch(() => {
        if (!cancelled) setChartError("تعذر الاتصال بمصدر البيانات");
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tf]);

  const points = chartData?.points?.map((p) => p.close) || [];
  const sma5 = useMemo(() => {
    if (points.length < 5) return [];
    return points.map((_, i) => {
      if (i < 4) return null;
      const slice = points.slice(i - 4, i + 1);
      return slice.reduce((a, b) => a + b, 0) / 5;
    });
  }, [points]);

  const w = 640;
  const h = 190;
  const pad = 10;
  const validSma = sma5.filter((v) => v != null);
  const all = [...points, ...validSma];
  const max = all.length ? Math.max(...all) : 1;
  const min = all.length ? Math.min(...all) : 0;
  const range = max - min || 1;
  const toXY = (i, v) => {
    const x = pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  };

  return (
    <div style={{ ...cardStyle, padding: "1.1rem 1.3rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem", flexWrap: "wrap", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#fff" }}>
          📈 حركة الدولار الأمريكي (DXY) {chartData?.points?.length ? <span style={{ color: GOLD_LIGHT }}>{points[points.length - 1]?.toFixed(2)}</span> : null}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 8.5, color: "#555" }}>Yahoo Finance</span>
          <div style={{ display: "flex", gap: 4 }}>
            {["1D", "1W", "1M"].map((t) => (
              <button
                key={t}
                onClick={() => setTf(t)}
                style={{
                  background: tf === t ? `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})` : "#181A20",
                  color: tf === t ? "#000" : "#999",
                  border: tf === t ? "none" : `1px solid ${GOLD}22`,
                  borderRadius: 6,
                  padding: "3px 10px",
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartLoading && !chartData ? (
        <LiveCardStatus label="⏳ جاري تحميل بيانات DXY الحية..." />
      ) : chartError && points.length < 2 ? (
        <LiveCardStatus label={`⚠️ ${chartError}`} />
      ) : (
        <>
          <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
            <polyline points={points.map((v, i) => toXY(i, v).join(",")).join(" ")} fill="none" stroke={GOLD_LIGHT} strokeWidth="2" />
            <polyline
              points={sma5.map((v, i) => (v == null ? null : toXY(i, v).join(","))).filter(Boolean).join(" ")}
              fill="none"
              stroke={PURPLE_LIGHT}
              strokeWidth="1.6"
              strokeDasharray="4 3"
            />
          </svg>
          <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
            <span style={{ fontSize: 10.5, color: "#888" }}>
              <span style={{ color: GOLD_LIGHT }}>●</span> السعر الفعلي
            </span>
            <span style={{ fontSize: 10.5, color: "#888" }}>
              <span style={{ color: PURPLE_LIGHT }}>●</span> متوسط متحرك SMA(5)
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/* مؤشر الخوف والطمع — مشتق من مؤشر VIX الحقيقي (Yahoo Finance): كل ما ارتفع VIX زاد الخوف، وكل ما انخفض زاد الطمع */
function FearGreedGauge({ snapshot, loading, error }) {
  const value = snapshot?.fearGreed;
  const label = value == null ? null : value >= 75 ? "طمع شديد" : value >= 55 ? "طمع" : value >= 45 ? "محايد" : value >= 25 ? "خوف" : "خوف شديد";
  const color = value == null ? "#888" : value >= 75 ? "#22c55e" : value >= 55 ? "#84cc16" : value >= 45 ? "#eab308" : value >= 25 ? "#f59e0b" : "#F6465D";
  return (
    <div style={{ ...cardStyle, padding: "1.1rem 1.2rem", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#fff" }}>😨 مؤشر الخوف والطمع</p>
        <span style={{ fontSize: 8.5, color: "#555" }}>VIX</span>
      </div>
      {loading && !snapshot ? (
        <LiveCardStatus label="⏳ جاري التحميل..." />
      ) : value == null ? (
        <LiveCardStatus label="⚠️ تعذر تحميل مؤشر VIX حالياً" />
      ) : (
        <>
          <SemiGauge value={value} colors={["#F6465D", "#f59e0b", "#eab308", "#84cc16", "#22c55e"]} gradId="fg" />
          <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800, color }}>{value}</p>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color, fontWeight: 700 }}>{label}</p>
          <p style={{ margin: "8px 0 0", fontSize: 10.5, color: "#777", lineHeight: 1.6 }}>
            محسوب من مؤشر التقلب VIX ({snapshot.vix?.price ?? "--"})، وهو مقياس تقريبي وليس مؤشر CNN الرسمي.
          </p>
        </>
      )}
    </div>
  );
}

/* مؤشر مفاجأة البيانات الاقتصادية — القيمة والاتجاه التاريخي محسوبان من أخبار حقيقية
   (actual مقابل forecast) المخزّنة فعلياً بقاعدة البيانات، وليست بيانات وهمية */
function EconomicSurpriseIndex({ events }) {
  const withActual = useMemo(
    () => events.filter((e) => e.actual && e.forecast && !isNaN(parseFloat(e.actual)) && !isNaN(parseFloat(e.forecast))),
    [events]
  );
  const value = useMemo(() => {
    if (withActual.length === 0) return null;
    const avg = withActual.reduce((acc, e) => acc + (parseFloat(e.actual) - parseFloat(e.forecast)), 0) / withActual.length;
    return Math.round(avg * 100) / 100;
  }, [withActual]);

  // اتجاه تاريخي حقيقي: متوسط المفاجأة لكل يوم فيه أخبار actual، مرتب زمنياً
  const series = useMemo(() => {
    const byDate = new Map();
    withActual.forEach((e) => {
      const diff = parseFloat(e.actual) - parseFloat(e.forecast);
      if (!byDate.has(e.event_date)) byDate.set(e.event_date, []);
      byDate.get(e.event_date).push(diff);
    });
    return Array.from(byDate.entries())
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([, diffs]) => diffs.reduce((a, b) => a + b, 0) / diffs.length);
  }, [withActual]);

  const positive = value != null && value >= 0;
  return (
    <div style={{ ...cardStyle, padding: "1.1rem 1.2rem" }}>
      <p style={{ margin: "0 0 0.4rem", fontSize: 12.5, fontWeight: 700, color: "#fff" }}>📊 مفاجأة البيانات الاقتصادية</p>
      {value == null ? (
        <LiveCardStatus label="لا توجد أخبار صدر لها رقم فعلي بعد ضمن النطاق المعروض" />
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: positive ? "#3DDC84" : "#EF5350", direction: "ltr" }}>
            {positive ? "+" : ""}
            {value}
          </p>
          {series.length >= 2 && (
            <div style={{ margin: "8px 0" }}>
              <Sparkline data={series} color={positive ? "#3DDC84" : "#EF5350"} width={140} height={34} />
            </div>
          )}
          <p style={{ margin: 0, fontSize: 10.5, color: "#888", lineHeight: 1.6 }}>
            {positive
              ? "البيانات الاقتصادية اللي صدرت جاءت بمعدّل أعلى من التوقعات، ما يدعم الدولار نسبياً."
              : "البيانات الاقتصادية اللي صدرت جاءت بمعدّل أقل من التوقعات، ما يشكّل ضغطاً على الدولار."}
          </p>
        </>
      )}
    </div>
  );
}

/* لوحة التحليل الفني — مؤشرات RSI/MACD/EMA/دعم/مقاومة محسوبة فعلياً من شموع يومية
   حقيقية (Yahoo Finance) للرمز المرتبط بعملة الخبر المختار */
function TechnicalAnalysisPanel({ currency }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/market-intelligence?type=technical&currency=${encodeURIComponent(currency || "USD")}`)
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
      .then(({ ok, data: d }) => {
        if (cancelled) return;
        if (ok) setData(d);
        else setError(d?.error || "تعذر حساب التحليل الفني");
      })
      .catch(() => {
        if (!cancelled) setError("تعذر الاتصال بمصدر البيانات");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currency]);

  const rows = data && [
    { label: "RSI (14)", value: data.rsi ?? "--", color: data.rsi > 70 ? "#EF5350" : data.rsi < 30 ? "#3DDC84" : "#eee" },
    { label: "MACD", value: data.macd || "--", color: data.macd === "Bullish" ? "#3DDC84" : "#EF5350" },
    { label: "EMA 20", value: data.emaUp == null ? "--" : data.emaUp ? "فوق EMA 50" : "تحت EMA 50", color: data.emaUp ? "#3DDC84" : "#EF5350" },
    { label: "الاتجاه العام", value: data.trend || "--", color: GOLD_LIGHT },
    { label: "الدعم", value: data.support ?? "--", color: "#4FA0F5" },
    { label: "المقاومة", value: data.resistance ?? "--", color: "#EF5350" },
  ];

  return (
    <div style={{ ...cardStyle, padding: "1.1rem 1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.7rem" }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#fff" }}>🎯 التحليل الفني ({data?.symbol || currency})</p>
        <span style={{ fontSize: 8.5, color: "#555" }}>يومي · Yahoo Finance</span>
      </div>
      {loading && !data ? (
        <LiveCardStatus label="⏳ جاري حساب المؤشرات..." />
      ) : error && !data ? (
        <LiveCardStatus label={`⚠️ ${error}`} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {rows.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11.5,
                borderBottom: i < rows.length - 1 ? "1px solid #1a1a0f" : "none",
                paddingBottom: 5,
              }}
            >
              <span style={{ color: "#999" }}>{r.label}</span>
              <span style={{ color: r.color, fontWeight: 700 }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TRADING_PLAN_ITEMS = [
  "انتظار صدور الخبر قبل اتخاذ القرار",
  "عدم الدخول في صفقات قبل الخبر مباشرة",
  "إدارة رأس المال (لا يتجاوز 1% من الحساب)",
  "تحديد وقف الخسارة (Stop Loss) بوضوح",
  "تحديد مستوى جني الأرباح (Take Profit)",
  "تجنّب التداول العشوائي بعد التقلب المفاجئ",
];

/* خطة التداول - Checklist تفاعلية */
function TradingPlanChecklist() {
  const [checked, setChecked] = useState({});
  return (
    <div style={{ ...cardStyle, padding: "1.1rem 1.2rem" }}>
      <p style={{ margin: "0 0 0.7rem", fontSize: 12.5, fontWeight: 700, color: "#fff" }}>✅ Trading Plan</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
        {TRADING_PLAN_ITEMS.map((item, i) => (
          <label
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 11.5,
              color: checked[i] ? "#666" : "#ccc",
              cursor: "pointer",
              textDecoration: checked[i] ? "line-through" : "none",
            }}
          >
            <input
              type="checkbox"
              checked={!!checked[i]}
              onChange={() => setChecked((p) => ({ ...p, [i]: !p[i] }))}
              style={{ marginTop: 2, accentColor: GOLD }}
            />
            {item}
          </label>
        ))}
      </div>
    </div>
  );
}

const CCY_ASSET_LABEL = { USD: "DXY", EUR: "EURUSD", GBP: "GBPUSD", JPY: "USDJPY", AUD: "AUDUSD", CAD: "USDCAD", CHF: "USDCHF", NZD: "NZDUSD" };

/* أفضل فرص التداول — الإشارة (شراء/بيع) والثقة مشتقّتان من قوة العملة الفعلية
   (نفس بيانات خريطة قوة العملات الحية) للأخبار عالية/متوسطة التأثير اليوم،
   وليست عشوائية. إشارة اتجاهية تقريبية وليست توصية استثمارية. */
function BestOpportunitiesPanel({ events, snapshot }) {
  const opportunities = useMemo(() => {
    if (!snapshot?.currencies) return [];
    const relevant = [...events].filter((e) => (e.impact === "high" || e.impact === "medium") && snapshot.currencies[e.currency] != null);
    const seen = new Set();
    const out = [];
    for (const e of relevant) {
      if (seen.has(e.currency)) continue;
      seen.add(e.currency);
      const strength = snapshot.currencies[e.currency];
      out.push({
        asset: CCY_ASSET_LABEL[e.currency] || e.currency,
        buy: strength >= 50,
        confidence: Math.round(50 + Math.abs(strength - 50)),
      });
      if (out.length >= 4) break;
    }
    return out;
  }, [events, snapshot]);

  if (!snapshot) {
    return (
      <div style={{ ...cardStyle, padding: "1.1rem 1.2rem", textAlign: "center", color: "#666", fontSize: 12 }}>
        ⏳ جاري تحميل بيانات السوق الحية لاستنتاج الفرص...
      </div>
    );
  }
  if (opportunities.length === 0) {
    return (
      <div style={{ ...cardStyle, padding: "1.1rem 1.2rem", textAlign: "center", color: "#666", fontSize: 12 }}>
        🏆 لا توجد فرص كافية اليوم لعرضها بعد.
      </div>
    );
  }
  return (
    <div style={{ ...cardStyle, padding: "1.1rem 1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#fff" }}>🏆 أفضل فرص التداول</p>
        <span style={{ fontSize: 8.5, color: "#555" }}>مبني على قوة العملة الحية</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {opportunities.map((o, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#181A20",
              border: `1px solid ${GOLD}1a`,
              borderRadius: 10,
              padding: "0.6rem 0.8rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: `${GOLD}22`,
                  color: GOLD_LIGHT,
                  fontSize: 10,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#eee" }}>{o.asset}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: o.buy ? "#3DDC84" : "#EF5350" }}>{o.buy ? "شراء" : "بيع"}</span>
              <span style={{ fontSize: 11, color: GOLD_LIGHT, fontWeight: 700 }}>{o.confidence}%</span>
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 9.5, color: "#555" }}>* إشارة اتجاهية تقريبية مبنية على قوة حركة العملة الفعلية اليوم، وليست توصية استثمارية.</p>
    </div>
  );
}

/* شريط الهيدر العلوي الجديد */
function MICHeaderBar({ search, setSearch, tzOffset, setTzOffset, now, onRefresh, highImpactUpcomingCount }) {
  const marketOpen = useMemo(() => {
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    if (day === 6) return false;
    if (day === 0 && hour < 21) return false;
    if (day === 5 && hour >= 21) return false;
    return true;
  }, [now]);
  const displayTime = new Date(now.getTime() + tzOffset * 3600 * 1000);
  const timeStr = displayTime.toISOString().slice(11, 19);

  return (
    <div
      style={{
        ...cardStyle,
        padding: "0.9rem 1.3rem",
        marginBottom: "1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "#000",
            background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${PURPLE_LIGHT})`,
            padding: "4px 10px",
            borderRadius: 8,
          }}
        >
          MIC
        </span>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#fff" }}>Market Intelligence Center</p>
          <p style={{ margin: 0, fontSize: 10, color: "#888" }}>التقويم الاقتصادي وتحليل تأثير الأخبار على الأسواق</p>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 180, maxWidth: 320 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍  ابحث عن خبر، أصل، أو مؤشر..."
          style={{
            width: "100%",
            background: "#181A20",
            border: `1px solid ${GOLD}2a`,
            borderRadius: 9,
            padding: "0.5rem 0.8rem",
            color: "#ccc",
            fontSize: 11.5,
            outline: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 16, cursor: "pointer" }} title="المفضلة">⭐</span>
        <span style={{ fontSize: 16, cursor: "pointer", position: "relative" }} title="التنبيهات">
          🔔
          {highImpactUpcomingCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -6,
                right: -8,
                background: "#EF5350",
                color: "#fff",
                fontSize: 8,
                fontWeight: 800,
                borderRadius: 8,
                padding: "1px 4px",
              }}
            >
              {highImpactUpcomingCount}
            </span>
          )}
        </span>
        <select
          value={tzOffset}
          onChange={(e) => setTzOffset(Number(e.target.value))}
          style={{ background: "#181A20", border: `1px solid ${GOLD}2a`, borderRadius: 8, padding: "0.35rem 0.5rem", color: "#ccc", fontSize: 11 }}
        >
          {[-5, 0, 1, 2, 3, 4].map((o) => (
            <option key={o} value={o}>
              UTC{o >= 0 ? `+${o}` : o}
            </option>
          ))}
        </select>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: marketOpen ? "#3DDC84" : "#EF5350" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: marketOpen ? "#3DDC84" : "#EF5350" }} />
          {marketOpen ? "السوق مفتوح" : "السوق مغلق"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#888" }}>
          <span>
            آخر تحديث: <span style={{ direction: "ltr", display: "inline-block" }}>{timeStr}</span>
          </span>
          <button
            onClick={onRefresh}
            title="تحديث"
            style={{
              background: "transparent",
              border: `1px solid ${GOLD}33`,
              borderRadius: 7,
              width: 24,
              height: 24,
              color: GOLD_LIGHT,
              cursor: "pointer",
            }}
          >
            ⟳
          </button>
        </div>
      </div>
    </div>
  );
}

/* بطاقات KPI العلوية مع Sparkline */
/* بطاقات KPI — كل الأرقام هون حقيقية 100%: محسوبة من أخبار قاعدة البيانات
   الفعلية لليوم الحالي، وعدد فرص التداول مشتق من نفس منطق BestOpportunitiesPanel
   (عملات لها أخبار عالية/متوسطة التأثير اليوم وبيانات قوة حية متوفرة لها).
   ما في Sparkline وهمي هون لأنه ما في مصدر بيانات حقيقي لتاريخ عدد الأخبار. */
function KPICardsRow({ todayStats, activeCurrenciesCount, opportunitiesCount, opportunitiesReady }) {
  const cards = [
    { label: "عملات نشطة اليوم", value: activeCurrenciesCount, sub: "عملة لها خبر اليوم", color: PURPLE_LIGHT, icon: "🎯" },
    { label: "أخبار منخفضة التأثير", value: todayStats.low, sub: "اليوم", color: "#3DDC84", icon: "🟢" },
    { label: "أخبار متوسطة التأثير", value: todayStats.medium, sub: "اليوم", color: "#FFA726", icon: "🟡" },
    { label: "أخبار عالية التأثير", value: todayStats.high, sub: "اليوم", color: "#EF5350", icon: "🔴" },
    { label: "فرص التداول", value: opportunitiesReady ? opportunitiesCount : "--", sub: "مبنية على قوة العملة الحية", color: GOLD_LIGHT, icon: "💡" },
    { label: "أخبار اليوم", value: todayStats.total, sub: `${todayStats.upcoming} متبقية`, color: "#4FA0F5", icon: "🗓️" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "0.7rem", marginBottom: "1.1rem" }}>
      {cards.map((c, i) => (
        <div key={i} style={{ ...cardStyle, padding: "0.85rem 0.9rem" }}>
          <p style={{ margin: 0, fontSize: 10, color: "#888" }}>
            {c.icon} {c.label}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 21, fontWeight: 800, color: c.color }}>{c.value}</p>
          <p style={{ margin: "2px 0 0", fontSize: 9.5, color: "#666" }}>{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* تذييل الصفحة */
function MICFooter({ tzOffset, lastUpdated }) {
  return (
    <div
      style={{
        ...cardStyle,
        padding: "0.7rem 1.3rem",
        marginTop: "1rem",
        display: "flex",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
        fontSize: 10.5,
        color: "#777",
      }}
    >
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>
          🟢 API Status: <span style={{ color: "#3DDC84" }}>Live</span>
        </span>
        <span>
          🟢 Data Feed: <span style={{ color: "#3DDC84" }}>متصل</span>
        </span>
        <span>آخر مزامنة: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString("ar-EG") : "--"}</span>
        <span>
          المنطقة الزمنية: UTC{tzOffset >= 0 ? `+${tzOffset}` : tzOffset}
        </span>
      </div>
      <span>الإصدار 2.1.0</span>
    </div>
  );
}

function CalendarView({ events, loading, isAdmin }) {
  const [dayFilter, setDayFilter] = useState("all");
  const [impactFilter, setImpactFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [analysisTab, setAnalysisTab] = useState("overview");
  const [now, setNow] = useState(() => new Date());
  const [search, setSearch] = useState("");
  const [tzOffset, setTzOffset] = useState(3);

  // تحليل الذكاء الاصطناعي التلقائي: أول مشترك يفتح خبر عالي/متوسط التأثير من غير تحليل
  // بيشغّل الطلب تلقائياً، والنتيجة تنخزن بقاعدة البيانات وتظهر لباقي المشتركين مباشرة.
  const [localAiData, setLocalAiData] = useState({});
  const [analyzingId, setAnalyzingId] = useState(null);
  const [analysisFailedIds, setAnalysisFailedIds] = useState({});

  // لقطة بيانات السوق الحية (قوة العملات + الخريطة الحرارية + VIX/الخوف والطمع)
  // مصدرها Yahoo Finance عبر /api/market-intelligence — تتحدث تلقائياً كل دقيقتين
  // وكمان عند الضغط على زر التحديث بالهيدر.
  const [marketSnapshot, setMarketSnapshot] = useState(null);
  const [marketSnapshotLoading, setMarketSnapshotLoading] = useState(true);
  const [marketSnapshotError, setMarketSnapshotError] = useState(null);
  const [snapshotRefreshTick, setSnapshotRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setMarketSnapshotLoading(true);
    fetch("/api/market-intelligence?type=snapshot")
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok) {
          setMarketSnapshot(data);
          setMarketSnapshotError(null);
        } else {
          setMarketSnapshotError(data?.error || "تعذر تحميل بيانات السوق");
        }
      })
      .catch(() => {
        if (!cancelled) setMarketSnapshotError("تعذر الاتصال بمصدر البيانات");
      })
      .finally(() => {
        if (!cancelled) setMarketSnapshotLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [snapshotRefreshTick]);

  useEffect(() => {
    const t = setInterval(() => setSnapshotRefreshTick((n) => n + 1), 120000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setAnalysisTab("overview");
  }, [selectedId]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => impactFilter === "all" || ev.impact === impactFilter);
  }, [events, impactFilter]);

  const days = useMemo(
    () => events.map((e) => e.event_date).filter((v, i, a) => a.indexOf(v) === i).sort(),
    [events]
  );

  const dayScopedEvents = dayFilter === "all" ? filteredEvents : filteredEvents.filter((e) => e.event_date === dayFilter);

  const visibleEvents = useMemo(() => {
    if (!search.trim()) return dayScopedEvents;
    const q = search.trim().toLowerCase();
    return dayScopedEvents.filter(
      (e) => (e.event_title || "").toLowerCase().includes(q) || (e.currency || "").toLowerCase().includes(q)
    );
  }, [dayScopedEvents, search]);

  const grouped = useMemo(() => {
    const map = new Map();
    visibleEvents.forEach((ev) => {
      if (!map.has(ev.event_date)) map.set(ev.event_date, []);
      map.get(ev.event_date).push(ev);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] > b[0] ? 1 : -1));
  }, [visibleEvents]);

  // اختيار افتراضي: أهم خبر قادم، وإلا أول خبر بالقائمة
  const selectedEvent = useMemo(() => {
    let found = null;
    if (selectedId) {
      found = events.find((e) => e.id === selectedId) || null;
    }
    if (!found) {
      const upcoming = events
        .filter((e) => e.event_datetime && new Date(e.event_datetime) > now && (e.impact === "high" || e.impact === "medium"))
        .sort((a, b) => new Date(a.event_datetime) - new Date(b.event_datetime));
      found = upcoming[0] || events[0] || null;
    }
    if (found && localAiData[found.id]) {
      return { ...found, ai_data: localAiData[found.id] };
    }
    return found;
  }, [selectedId, events, now, localAiData]);

  // لما تنفتح شاشة خبر ما إله تحليل بعد، شغّل التحليل تلقائياً بمجرد الضغط عليه.
  useEffect(() => {
    if (!selectedEvent) return;
    if (selectedEvent.ai_data) return;
    if (selectedEvent.impact !== "high" && selectedEvent.impact !== "medium") return;
    if (analyzingId === selectedEvent.id) return;
    if (analysisFailedIds[selectedEvent.id]) return;

    let cancelled = false;
    setAnalyzingId(selectedEvent.id);

    fetch(`/api/economic-events/${selectedEvent.id}/analyze`, { method: "POST" })
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data?.event?.ai_data) {
          setLocalAiData((prev) => ({ ...prev, [data.event.id]: data.event.ai_data }));
        } else {
          setAnalysisFailedIds((prev) => ({ ...prev, [selectedEvent.id]: true }));
        }
      })
      .catch(() => {
        if (!cancelled) setAnalysisFailedIds((prev) => ({ ...prev, [selectedEvent.id]: true }));
      })
      .finally(() => {
        if (!cancelled) setAnalyzingId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEvent, analyzingId, analysisFailedIds]);

  // Polling: لو الخبر لسا ما إله ai_data (سواء إحنا يلي طلبنا التحليل أو مشترك
  // تاني بجلسة ثانية، أو الـ cron)، نتأكد كل كم ثانية إذا خلص التحليل بقاعدة
  // البيانات ونحدّث الواجهة تلقائياً — بدون ما يحتاج المستخدم يعمل Refresh يدوي.
  useEffect(() => {
    if (!selectedEvent) return;
    if (selectedEvent.ai_data) return;
    if (selectedEvent.impact !== "high" && selectedEvent.impact !== "medium") return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20; // حد أقصى تقريبي دقيقتين قبل ما نوقف المحاولة

    const interval = setInterval(async () => {
      attempts += 1;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        return;
      }
      try {
        const res = await fetch(`/api/economic-events/${selectedEvent.id}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data?.event?.ai_data) {
          setLocalAiData((prev) => ({ ...prev, [data.event.id]: data.event.ai_data }));
          clearInterval(interval);
        }
      } catch {
        // تجاهل الخطأ وحاول بالمرة الجاية
      }
    }, 6000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedEvent?.id, selectedEvent?.ai_data]);

  const lastUpdated = useMemo(() => {
    const sorted = [...events].filter((e) => e.updated_at).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    return sorted[0]?.updated_at || null;
  }, [events]);

  const todayStr = useMemo(() => now.toISOString().slice(0, 10), [now]);

  const todayEvents = useMemo(
    () => events.filter((e) => e.event_date === todayStr),
    [events, todayStr]
  );

  const todayStats = useMemo(() => ({
    total: todayEvents.length,
    high: todayEvents.filter((e) => e.impact === "high").length,
    medium: todayEvents.filter((e) => e.impact === "medium").length,
    low: todayEvents.filter((e) => e.impact === "low").length,
    completed: todayEvents.filter((e) => e.actual).length,
    upcoming: todayEvents.filter((e) => !e.actual).length,
  }), [todayEvents]);

  const nextHighImpactEvent = useMemo(() => {
    return events
      .filter((e) => e.event_datetime && new Date(e.event_datetime) > now && e.impact === "high")
      .sort((a, b) => new Date(a.event_datetime) - new Date(b.event_datetime))[0] || null;
  }, [events, now]);

  const nextHighImpactCountdown = nextHighImpactEvent
    ? formatCountdown(new Date(nextHighImpactEvent.event_datetime) - now)
    : null;

  const highImpactUpcomingCount = useMemo(
    () => events.filter((e) => e.event_datetime && new Date(e.event_datetime) > now && e.impact === "high").length,
    [events, now]
  );

  // عدد العملات النشطة فعلياً اليوم (لها خبر واحد على الأقل بقاعدة البيانات)
  const activeCurrenciesCount = useMemo(
    () => new Set(todayEvents.map((e) => e.currency).filter(Boolean)).size,
    [todayEvents]
  );

  // عدد فرص التداول = نفس منطق BestOpportunitiesPanel بالضبط (عملات لأخبار
  // عالية/متوسطة التأثير اليوم وموجود لها قوة عملة حقيقية بلقطة السوق الحية)
  const opportunitiesCount = useMemo(() => {
    if (!marketSnapshot?.currencies) return 0;
    const relevant = todayEvents.filter((e) => (e.impact === "high" || e.impact === "medium") && marketSnapshot.currencies[e.currency] != null);
    return new Set(relevant.map((e) => e.currency)).size;
  }, [todayEvents, marketSnapshot]);
  const opportunitiesReady = !!marketSnapshot?.currencies;

  function formatArabicDate(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
  }

  if (loading) {
    return (
      <div style={{ color: "#666", fontSize: 14, padding: "3rem 0", textAlign: "center" }}>
        ...جاري تحميل التقويم الاقتصادي
      </div>
    );
  }

  const impact = selectedEvent ? (IMPACT_STYLE[selectedEvent.impact] || IMPACT_STYLE.low) : null;
  const flag = selectedEvent ? (CURRENCY_FLAGS[selectedEvent.currency] || "🌐") : null;
  const countdownMs = selectedEvent?.event_datetime ? new Date(selectedEvent.event_datetime) - now : null;
  const countdown = countdownMs !== null ? formatCountdown(countdownMs) : null;
  const aiData = selectedEvent?.ai_data || null;

  const impactPct = !selectedEvent ? 0 : selectedEvent.impact === "high" ? 85 : selectedEvent.impact === "medium" ? 55 : 25;
  const impactStrengthLabel = impactPct >= 75 ? "قوي جداً" : impactPct >= 45 ? "متوسط" : "محدود";

  // ملاحظة: حساب عادي (وليس useMemo) عن قصد، لأنه واقع بعد شرط "if (loading) return"
  // أعلاه؛ استخدام hook هنا كان سيكسر ترتيب الـ Hooks بين الرندرات (قاعدة Hooks في React).
  const assetDistribution = (() => {
    if (aiData?.assets?.length) {
      return aiData.assets.slice(0, 4).map((a) => ({
        name: a.symbol || a.name,
        pct: a.strength === "strong" ? 85 : a.strength === "medium" ? 55 : 30,
      }));
    }
    if (!selectedEvent) return [];
    const base = selectedEvent.impact === "high" ? 80 : selectedEvent.impact === "medium" ? 55 : 30;
    return [
      { name: selectedEvent.currency || "USD", pct: base },
      { name: "Gold", pct: Math.max(15, base - 20) },
      { name: "Stocks", pct: Math.max(15, base - 15) },
      { name: "Oil", pct: Math.max(10, base - 40) },
    ];
  })();

  return (
    <div>
      <MICHeaderBar
        search={search}
        setSearch={setSearch}
        tzOffset={tzOffset}
        setTzOffset={setTzOffset}
        now={now}
        onRefresh={() => {
          setNow(new Date());
          setSnapshotRefreshTick((n) => n + 1);
        }}
        highImpactUpcomingCount={highImpactUpcomingCount}
      />

      <KPICardsRow
        todayStats={todayStats}
        activeCurrenciesCount={activeCurrenciesCount}
        opportunitiesCount={opportunitiesCount}
        opportunitiesReady={opportunitiesReady}
      />

      {/* الصف الرئيسي: العمود الرئيسي (الخبر + AI + Tabs + الأدوات) والشريط الجانبي */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.1rem", alignItems: "start" }}>
        {/* العمود الرئيسي */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0 }}>
          {!selectedEvent ? (
            <div style={{ ...cardStyle, padding: "3rem", textAlign: "center", color: "#666", fontSize: 13 }}>
              اختاري خبر من القائمة لعرض التحليل
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "1rem", alignItems: "start" }}>
                {/* بطاقة الخبر المختار */}
                <div style={{ ...cardStyle, padding: "1.2rem 1.4rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{
                        background: impact.bg, color: impact.color, fontSize: 11, fontWeight: 700,
                        padding: "4px 12px", borderRadius: 20, whiteSpace: "nowrap",
                      }}>
                        {impact.dot} {impact.label}
                      </span>
                      <div>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>
                          {flag} {selectedEvent.event_title}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>
                          {selectedEvent.currency} · {formatArabicDate(selectedEvent.event_date)} · {selectedEvent.event_time}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* السابق / التوقع / الفعلي / العد التنازلي */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem" }}>
                    {[
                      { label: "السابق", value: selectedEvent.previous },
                      { label: "التوقع", value: selectedEvent.forecast },
                      { label: "الفعلي", value: selectedEvent.actual, gold: true },
                      { label: "العد التنازلي", value: countdown, live: true },
                    ].map((s, i) => (
                      <div key={i} style={{ background: "#181A20", border: `1px solid ${GOLD}22`, borderRadius: 10, padding: "0.6rem", textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: 10, color: "#888" }}>{s.label}</p>
                        <p style={{
                          margin: "5px 0 0", fontSize: 14, fontWeight: 800, direction: s.live ? "ltr" : undefined,
                          color: s.value ? (s.gold ? GOLD_LIGHT : s.live ? impact.color : "#fff") : "#444",
                        }}>
                          {s.value || "--"}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* قوة التأثير + توزيع التأثير على الأصول */}
                  <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ textAlign: "center" }}>
                      <SemiGauge value={impactPct} size={116} colors={["#3DDC84", "#FFA726", "#EF5350"]} gradId="impact" />
                      <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 800, color: impact.color }}>{impactPct}%</p>
                      <p style={{ margin: 0, fontSize: 10, color: "#888" }}>{impactStrengthLabel}</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 6 }}>
                      <p style={{ margin: "0 0 2px", fontSize: 10.5, color: "#888" }}>توزيع التأثير المتوقع على الأصول</p>
                      {assetDistribution.map((a, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 10, color: "#aaa", minWidth: 46 }}>{a.name}</span>
                          <div style={{ flex: 1, height: 5, borderRadius: 5, background: "#1a1a12", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${a.pct}%`, borderRadius: 5, background: GOLD_LIGHT }} />
                          </div>
                          <span style={{ fontSize: 9.5, color: "#888", minWidth: 26, textAlign: "left" }}>{a.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* بطاقة تحليل الذكاء الاصطناعي */}
                <div style={{
                  ...cardStyle, padding: "1.2rem 1.4rem",
                  background: "linear-gradient(135deg, #1a1030, #181A20)", border: "1px solid #7c5cff33",
                }}>
                  <p style={{ color: PURPLE_LIGHT, fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>🤖 تحليل الذكاء الاصطناعي</p>
                  {!aiData ? (
                    <>
                      <p style={{ margin: 0, fontSize: 12.5, color: "#ccc", lineHeight: 1.85 }}>{buildFallbackAnalysis(selectedEvent)}</p>
                      {(selectedEvent.impact === "high" || selectedEvent.impact === "medium") && (
                        <p style={{ margin: "12px 0 0", fontSize: 11, color: analyzingId === selectedEvent.id ? PURPLE_LIGHT : "#666" }}>
                          {analyzingId === selectedEvent.id
                            ? "🤖 جاري إعداد تحليل الذكاء الاصطناعي المفصّل الآن..."
                            : analysisFailedIds[selectedEvent.id]
                            ? "⚠️ تعذر إعداد التحليل التفصيلي حالياً، رح تنعرض النتيجة تلقائياً بأقرب محاولة ناجحة."
                            : "🤖 التحليل التفصيلي بيظهر تلقائياً خلال لحظات..."}
                        </p>
                      )}
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{
                        width: 76, height: 76, borderRadius: "50%", flexShrink: 0,
                        background: `conic-gradient(${PURPLE} ${aiData.confidence * 3.6}deg, #1a1a2a 0deg)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <div style={{ width: 58, height: 58, borderRadius: "50%", background: "#0d0d14", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{aiData.confidence}%</span>
                          <span style={{ fontSize: 8, color: "#999" }}>ثقة</span>
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <p style={{ margin: "0 0 4px", fontSize: 11.5, color: "#eee" }}>
                          الاتجاه: <span style={{ color: PURPLE_LIGHT, fontWeight: 700 }}>
                            {aiData.direction === "down" ? "سلبي" : aiData.direction === "up" ? "إيجابي" : "محايد"}
                          </span>
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: "#ccc", lineHeight: 1.75 }}>{aiData.summary}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs التحليل */}
              <div style={{ ...cardStyle, padding: "1.2rem 1.3rem" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: "1.1rem", flexWrap: "wrap" }}>
                  {[
                    { key: "overview", label: "Overview", icon: "🧭" },
                    { key: "technical", label: "Technical View", icon: "🎯" },
                    { key: "historical", label: "Historical Data", icon: "📜" },
                    { key: "plan", label: "Trading Plan", icon: "⚠️" },
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setAnalysisTab(t.key)}
                      style={{
                        background: analysisTab === t.key ? `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})` : "#181A20",
                        color: analysisTab === t.key ? "#000" : "#999",
                        border: analysisTab === t.key ? "none" : `1px solid ${GOLD}22`,
                        borderRadius: 8, padding: "0.5rem 0.9rem", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                {analysisTab === "overview" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {aiData?.scenarios?.length > 0 ? (
                      <div>
                        <p style={{ color: GOLD, fontSize: 13, fontWeight: 700, margin: "0 0 0.9rem" }}>📊 السيناريوهات المتوقعة</p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.8rem" }}>
                          {aiData.scenarios.map((sc, i) => (
                            <div key={i} style={{ background: "#181A20", border: `1px solid ${GOLD}22`, borderRadius: 10, padding: "0.9rem" }}>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#eee" }}>{sc.title}</p>
                              <p style={{ margin: "8px 0 4px", fontSize: 20, fontWeight: 800, color: GOLD_LIGHT }}>{sc.probability}%</p>
                              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#f5c542" }}>{"⭐".repeat(Math.max(1, Math.min(5, sc.stars || 1)))}</p>
                              <p style={{ margin: 0, fontSize: 11, color: "#888", lineHeight: 1.6 }}>{sc.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: "1.5rem", textAlign: "center", color: "#666", fontSize: 12.5 }}>
                        📊 السيناريوهات المتوقعة (إيجابي / سلبي / محايد) بتظهر هون تلقائياً بمجرد اكتمال تحليل الذكاء الاصطناعي.
                      </div>
                    )}
                  </div>
                )}

                {analysisTab === "technical" && (
                  aiData?.assets?.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      {aiData.assets.map((a, i) => {
                        const dir = DIRECTION_STYLE[a.direction] || DIRECTION_STYLE.neutral;
                        const strengthPct = a.strength === "strong" ? 90 : a.strength === "medium" ? 55 : 25;
                        return (
                          <div key={i} style={{ padding: "0.6rem 0", borderBottom: i < aiData.assets.length - 1 ? "1px solid #1a1a0f" : "none" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span>{dir.arrow}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#eee" }}>{a.name}</span>
                                <span style={{ fontSize: 11, color: "#666" }}>{a.symbol}</span>
                              </div>
                              <span style={{ fontSize: 11.5, color: dir.color, fontWeight: 700 }}>
                                {a.direction === "up" ? "إيجابي" : a.direction === "down" ? "سلبي" : "محايد"} {STRENGTH_LABEL_AR[a.strength] || ""}
                              </span>
                            </div>
                            <div style={{ height: 6, borderRadius: 6, background: "#1a1a12", overflow: "hidden" }}>
                              <div style={{ height: "100%", borderRadius: 6, background: dir.color, width: `${strengthPct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "#666", fontSize: 12.5 }}>
                      لا يتوفر تحليل فني تفصيلي لهذا الخبر بعد.
                    </div>
                  )
                )}

                {analysisTab === "historical" && (
                  <div>
                    {(aiData?.historical_examples || []).length === 0 ? (
                      <div style={{ padding: "1.5rem", textAlign: "center", color: "#666", fontSize: 12.5 }}>
                        📜 التحليل الذكي بيولّد أمثلة تاريخية تلقائياً للأخبار متوسطة وعالية التأثير — رح تظهر هون بعد أول تحديث.
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                          {[...aiData.historical_examples]
                            .sort((a, b) => (b.year || "").localeCompare(a.year || ""))
                            .map((h, i) => {
                              const dir = DIRECTION_STYLE[h.direction] || DIRECTION_STYLE.neutral;
                              return (
                                <div key={i} style={{
                                  display: "flex", alignItems: "center", gap: 12, background: "#181A20",
                                  border: `1px solid ${GOLD}22`, borderRadius: 10, padding: "0.7rem 0.9rem",
                                }}>
                                  <span style={{
                                    fontSize: 12, fontWeight: 800, color: GOLD_LIGHT, minWidth: 44, textAlign: "center",
                                    border: `1px solid ${GOLD}33`, borderRadius: 8, padding: "3px 6px",
                                  }}>
                                    {h.year}
                                  </span>
                                  <span style={{ fontSize: 15 }}>{dir.arrow}</span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#eee" }}>
                                      {h.asset} {h.symbol && <span style={{ color: "#666", fontWeight: 400 }}>({h.symbol})</span>}
                                    </p>
                                    {h.note && <p style={{ margin: "3px 0 0", fontSize: 11, color: "#888" }}>{h.note}</p>}
                                  </div>
                                  {h.change_pct && (
                                    <span style={{ fontSize: 13, fontWeight: 800, color: dir.color, direction: "ltr" }}>
                                      {h.direction === "down" ? "-" : "+"}{h.change_pct}%
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                        <p style={{ margin: "0.9rem 0 0", fontSize: 10.5, color: "#555" }}>
                          * أمثلة توضيحية تقريبية مولّدة بالذكاء الاصطناعي لأخبار مشابهة، وليست بيانات موثّقة مضمونة الدقة.
                        </p>
                      </>
                    )}
                  </div>
                )}

                {analysisTab === "plan" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.2rem" }}>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 11.5, color: "#888", fontWeight: 700 }}>قبل الخبر</p>
                      {(aiData?.tips_before?.length > 0 ? aiData.tips_before : GENERIC_TIPS_BEFORE).map((tip, i) => (
                        <p key={i} style={{ margin: "0 0 5px", fontSize: 12, color: "#ccc" }}>❌ {tip}</p>
                      ))}
                    </div>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 11.5, color: "#888", fontWeight: 700 }}>بعد الخبر</p>
                      {(aiData?.tips_after?.length > 0 ? aiData.tips_after : GENERIC_TIPS_AFTER).map((tip, i) => (
                        <p key={i} style={{ margin: "0 0 5px", fontSize: 12, color: "#ccc" }}>✅ {tip}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* قوة العملات + الخريطة الحرارية */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <CurrencyStrengthMeter snapshot={marketSnapshot} loading={marketSnapshotLoading} error={marketSnapshotError} />
                <MarketHeatmap snapshot={marketSnapshot} loading={marketSnapshotLoading} error={marketSnapshotError} />
              </div>

              {/* الرسم البياني */}
              <PriceChart />

              {/* Trading Plan / التحليل الفني / الخوف والطمع / مفاجأة البيانات */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
                <TradingPlanChecklist />
                <TechnicalAnalysisPanel currency={selectedEvent.currency} />
                <FearGreedGauge snapshot={marketSnapshot} loading={marketSnapshotLoading} error={marketSnapshotError} />
                <EconomicSurpriseIndex events={events} />
              </div>
            </>
          )}
        </div>

        {/* الشريط الجانبي: التقويم الاقتصادي + أفضل فرص التداول */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ ...cardStyle, padding: "1rem 1.1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#fff" }}>📅 التقويم الاقتصادي</p>
              {nextHighImpactEvent && (
                <span style={{ fontSize: 9.5, color: "#EF5350", fontWeight: 700, direction: "ltr" }}>
                  ⏱ {nextHighImpactCountdown || "--"}
                </span>
              )}
            </div>

            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              style={{
                width: "100%", background: "#181A20", border: `1px solid ${GOLD}33`, borderRadius: 8,
                padding: "0.5rem 0.6rem", color: "#ccc", fontSize: 11.5, marginBottom: 8,
              }}
            >
              <option value="all">كل الأيام</option>
              {days.map((d) => (
                <option key={d} value={d}>{formatArabicDate(d)}</option>
              ))}
            </select>

            <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
              {[
                { key: "all", label: "الكل", color: GOLD_LIGHT },
                { key: "high", label: "🔴 عالي", color: "#EF5350" },
                { key: "medium", label: "🟡 متوسط", color: "#FFA726" },
                { key: "low", label: "🟢 منخفض", color: "#8BC34A" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setImpactFilter(f.key)}
                  style={{
                    flex: 1,
                    background: impactFilter === f.key ? `${f.color}22` : "#181A20",
                    color: impactFilter === f.key ? f.color : "#999",
                    border: impactFilter === f.key ? `1px solid ${f.color}66` : `1px solid ${GOLD}22`,
                    borderRadius: 8, padding: "0.4rem 0.2rem", fontSize: 9.5, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", maxHeight: 560, overflowY: "auto", paddingLeft: 2 }}>
              {grouped.length === 0 && (
                <div style={{ padding: "2rem 0.5rem", textAlign: "center", color: "#666", fontSize: 12 }}>
                  لا توجد أحداث مطابقة حالياً.
                </div>
              )}
              {grouped.map(([date, dayEvents]) => (
                <div key={date}>
                  <p style={{ color: "#666", fontSize: 11, fontWeight: 700, margin: "0 0 0.5rem" }}>{formatArabicDate(date)}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {dayEvents.map((ev) => {
                      const impactStyle = IMPACT_STYLE[ev.impact] || IMPACT_STYLE.low;
                      const isSelected = selectedEvent?.id === ev.id;
                      const evCountdown = ev.event_datetime && new Date(ev.event_datetime) > now
                        ? formatCountdown(new Date(ev.event_datetime) - now)
                        : null;
                      return (
                        <div
                          key={ev.id}
                          onClick={() => setSelectedId(ev.id)}
                          style={{
                            background: isSelected ? `${GOLD}14` : "#181A20",
                            border: isSelected ? `1px solid ${GOLD}66` : `1px solid ${GOLD}1a`,
                            borderRadius: 10, padding: "0.65rem 0.8rem", cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              <span style={{ fontSize: 11, color: "#888" }}>{ev.event_time}</span>
                              <span style={{ fontSize: 15 }}>{CURRENCY_FLAGS[ev.currency] || "🌐"}</span>
                            </div>
                            <span style={{ fontSize: 12 }}>{impactStyle.dot}</span>
                          </div>
                          <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 700, color: "#eee", lineHeight: 1.4 }}>{ev.event_title}</p>
                          <div style={{ display: "flex", gap: "0.7rem", marginTop: 6, fontSize: 10, color: "#777", flexWrap: "wrap" }}>
                            {ev.previous && <span>السابق: {ev.previous}</span>}
                            {ev.forecast && <span>التوقع: {ev.forecast}</span>}
                            {ev.actual && <span style={{ color: GOLD_LIGHT }}>الفعلي: {ev.actual}</span>}
                            {!ev.actual && evCountdown && <span style={{ color: impactStyle.color, direction: "ltr" }}>⏱ {evCountdown}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <BestOpportunitiesPanel events={todayEvents} snapshot={marketSnapshot} />
        </div>
      </div>

      <MICFooter tzOffset={tzOffset} lastUpdated={lastUpdated} />
    </div>
  );
}





function LecturesView({
  username, currentStreak = 0,
  courses, allLectures, progressMap, loading,
  selectedCourseId, onSelectCourse, onBackToCourses,
  selectedLecture, onSelect, onBack,
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid");

  const courseStats = useMemo(() => {
    return courses.map((course, index) => {
      const courseLectures = allLectures.filter((l) => l.course_id === course.id);
      const totalLessons = courseLectures.length;
      const totalSeconds = courseLectures.reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
      const completedCount = courseLectures.filter((l) => progressMap[l.id]?.completed).length;
      const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

      const presentDifficulties = DIFFICULTY_ORDER.filter((d) => courseLectures.some((l) => l.difficulty === d));
      let difficultyLabel = null;
      if (presentDifficulties.length === 1) difficultyLabel = DIFFICULTY_AR[presentDifficulties[0]];
      else if (presentDifficulties.length > 1) {
        difficultyLabel = `${DIFFICULTY_AR[presentDifficulties[0]]} - ${DIFFICULTY_AR[presentDifficulties[presentDifficulties.length - 1]]}`;
      }

      return {
        ...course,
        totalLessons,
        totalHours: totalSeconds / 3600,
        completedCount,
        progressPct,
        difficultyLabel,
        color: COURSE_COLORS[index % COURSE_COLORS.length],
      };
    });
  }, [courses, allLectures, progressMap]);

  // إحصائيات عامة للبانر
  const overallStats = useMemo(() => {
    const totalLessons = allLectures.length;
    const completedSeconds = allLectures
      .filter((l) => progressMap[l.id]?.completed)
      .reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
    const completedCount = allLectures.filter((l) => progressMap[l.id]?.completed).length;
    const overallPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
    return { totalLessons, completedHours: completedSeconds / 3600, overallPct };
  }, [allLectures, progressMap]);

  // آخر محاضرة عم يتابعها الطالب (لزر "متابعة التعلم")
  const continueLecture = useMemo(() => {
    const inProgress = allLectures
      .filter((l) => {
        const p = progressMap[l.id];
        return p && !p.completed && p.last_watched_at;
      })
      .sort((a, b) => new Date(progressMap[b.id].last_watched_at) - new Date(progressMap[a.id].last_watched_at));
    if (inProgress.length > 0) return { ...inProgress[0], progress: progressMap[inProgress[0].id] };
    return null;
  }, [allLectures, progressMap]);

  const selectedCourse = courseStats.find((c) => c.id === selectedCourseId) || null;

  const chapters = useMemo(() => {
    if (!selectedCourseId) return [];
    const courseLectures = allLectures.filter((l) => l.course_id === selectedCourseId);
    const order = [];
    const map = new Map();
    courseLectures.forEach((lecture) => {
      const chapterName = lecture.chapter || "عام";
      if (!map.has(chapterName)) {
        map.set(chapterName, { name: chapterName, order: lecture.chapter_order ?? 999, lectures: [] });
        order.push(chapterName);
      }
      map.get(chapterName).lectures.push({ ...lecture, progress: progressMap[lecture.id] || null });
    });
    return order.map((name) => map.get(name)).sort((a, b) => a.order - b.order);
  }, [selectedCourseId, allLectures, progressMap]);

  const filteredChapters = useMemo(() => {
    return chapters
      .map((chapter) => {
        const filteredLectures = chapter.lectures.filter((lecture) => {
          const matchesSearch = !search.trim() || lecture.title?.toLowerCase().includes(search.trim().toLowerCase());
          const isCompleted = !!lecture.progress?.completed;
          const isFavorite = !!lecture.progress?.favorite;
          let matchesFilter = true;
          if (filter === "completed") matchesFilter = isCompleted;
          else if (filter === "incomplete") matchesFilter = !isCompleted;
          else if (filter === "favorite") matchesFilter = isFavorite;
          return matchesSearch && matchesFilter;
        });
        return { ...chapter, filteredLectures };
      })
      .filter((chapter) => chapter.filteredLectures.length > 0);
  }, [chapters, search, filter]);

  if (loading) {
    return (
      <div style={{ color: "#666", fontSize: 14, padding: "3rem 0", textAlign: "center" }}>
        ...جاري تحميل البرامج التعليمية
      </div>
    );
  }

  /* المستوى 3: مشغل الفيديو */
  if (selectedLecture) {
    return (
      <div style={{ ...cardStyle, padding: "1.3rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{selectedLecture.title}</h2>
            {selectedLecture.description && (
              <p style={{ color: "#666", margin: "6px 0 0", fontSize: 13 }}>{selectedLecture.description}</p>
            )}
          </div>
          <div onClick={onBack} style={{ color: GOLD, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
            ← رجوع للمحاضرات
          </div>
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            paddingTop: "56.25%",
            background: "#000",
            borderRadius: 12,
            overflow: "hidden",
            border: `1px solid ${GOLD}22`,
          }}
        >
          <iframe
            src={
              selectedLecture.video_provider === "drive"
                ? `https://drive.google.com/file/d/${selectedLecture.youtube_video_id}/preview`
                : `https://www.youtube.com/embed/${selectedLecture.youtube_video_id}?rel=0&modestbranding=1`
            }
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  /* المستوى 2: فصول ومحاضرات كورس معيّن */
  if (selectedCourse) {
    return (
      <div style={{ ...cardStyle, padding: "1.3rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 26 }}>{selectedCourse.icon}</div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{selectedCourse.title}</h2>
          </div>
          <div onClick={onBackToCourses} style={{ color: GOLD, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
            ← البرامج التعليمية
          </div>
        </div>

        {/* بحث وفلترة */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginBottom: "1.5rem" }}>
          <input
            type="text"
            placeholder="🔍 البحث عن محاضرة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: "1 1 200px",
              background: "#181A20",
              border: `1px solid ${GOLD}33`,
              borderRadius: 10,
              padding: "0.6rem 1rem",
              color: "#fff",
              fontSize: 13,
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {LECTURE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  background: filter === f.key ? `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})` : "#181A20",
                  color: filter === f.key ? "#000" : "#999",
                  border: filter === f.key ? "none" : `1px solid ${GOLD}22`,
                  borderRadius: 8,
                  padding: "0.55rem 0.9rem",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {filteredChapters.map((chapter) => {
            const total = chapter.lectures.length;
            const completed = chapter.lectures.filter((l) => l.progress?.completed).length;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            return (
              <div key={chapter.name}>
                <div style={{ marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>{chapter.name}</h3>
                    <span style={{ fontSize: 11, color: GOLD, fontWeight: 700 }}>
                      {pct}% &nbsp;·&nbsp; {completed} / {total} درس
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 5, background: "#1a1a0a", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`, borderRadius: 3 }} />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                  {chapter.filteredLectures.map((lecture) => {
                    const diff = DIFFICULTY_LABELS[lecture.difficulty];
                    const isCompleted = !!lecture.progress?.completed;
                    const watchedPct = lecture.progress?.watched_pct || 0;
                    const lastWatched = formatLastWatched(lecture.progress?.last_watched_at);
                    const duration = formatDuration(lecture.duration_seconds);

                    return (
                      <div
                        key={lecture.id}
                        onClick={() => onSelect(lecture)}
                        style={{
                          background: "#181A20",
                          border: isCompleted ? "1px solid #4CAF5044" : `1px solid ${GOLD}22`,
                          borderRadius: 12,
                          padding: "0.9rem 1.1rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "1rem",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: isCompleted ? "#4CAF5022" : `${GOLD}22`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 15, flexShrink: 0,
                        }}>
                          {isCompleted ? "✅" : "▶️"}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{lecture.title}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem", marginTop: 4, fontSize: 11, color: "#777" }}>
                            {duration && <span>⏱ {duration}</span>}
                            {diff && <span style={{ color: diff.color }}>🟢 {diff.label}</span>}
                            {lecture.practice_type && <span>🧪 تمرين تطبيقي</span>}
                            {lastWatched && <span>📅 آخر مشاهدة: {lastWatched}</span>}
                          </div>
                          {!isCompleted && watchedPct > 0 && (
                            <div style={{ width: "100%", height: 3, background: "#1a1a0a", borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
                              <div style={{ width: `${watchedPct}%`, height: "100%", background: `${GOLD}88`, borderRadius: 2 }} />
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                          {lecture.progress?.favorite && <span style={{ fontSize: 13 }}>⭐</span>}
                          <div style={{ color: GOLD, fontSize: 14 }}>←</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredChapters.length === 0 && (
            <div style={{ color: "#444", fontSize: 13, textAlign: "center", padding: "2rem 0" }}>
              لا توجد نتائج مطابقة.
            </div>
          )}
        </div>
      </div>
    );
  }

  /* المستوى 1: بانر الترحيب + الإحصائيات + بطاقات البرامج */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>

      {/* بانر الترحيب */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          background: `linear-gradient(135deg, #2B2F36 0%, #181A20 60%)`,
          border: `1px solid ${GOLD}33`,
          borderRadius: 16,
          padding: "1.6rem 1.8rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1.2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, zIndex: 1 }}>
          <div
            style={{
              width: 54, height: 54, borderRadius: "50%",
              background: `${GOLD}18`, border: `2px solid ${GOLD}55`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0,
            }}
          >
            🎓
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>مرحباً {username} 👋</p>
            <p style={{ margin: "5px 0 0", color: "#999", fontSize: 13 }}>واصل رحلتك التعليمية وتعلم التداول باحترافية</p>
          </div>
        </div>

        {/* رسم زخرفي: أعمدة متصاعدة */}
        <svg width="150" height="70" viewBox="0 0 150 70" style={{ opacity: 0.55, flexShrink: 0 }}>
          {[14, 24, 18, 34, 26, 46, 60].map((h, i) => (
            <rect key={i} x={i * 21} y={70 - h} width="12" height={h} rx="3" fill={GOLD} opacity={0.25 + i * 0.09} />
          ))}
          <polyline points="0,55 21,45 42,50 63,30 84,38 105,15 126,5" fill="none" stroke={GOLD_LIGHT} strokeWidth="2" />
        </svg>

        <div
          onClick={() => {
            if (continueLecture) onSelect(continueLecture);
            else if (courseStats[0]) onSelectCourse(courseStats[0].id);
          }}
          style={{
            background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})`,
            color: "#1a1608", fontWeight: 800, fontSize: 13,
            padding: "0.8rem 1.4rem", borderRadius: 10, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8, zIndex: 1, whiteSpace: "nowrap",
          }}
        >
          <span>{continueLecture ? "متابعة التعلم" : "ابدأ الآن"}</span>
          <span>▶️</span>
        </div>
      </div>

      {/* إحصائيات عامة */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.9rem" }}>
        {[
          { label: "إجمالي الدروس", value: overallStats.totalLessons, icon: null },
          { label: "الساعات المكتملة", value: `${overallStats.completedHours.toFixed(1)} ساعة`, icon: null },
          { label: "نسبة التقدم الإجمالية", value: `${overallStats.overallPct}%`, ring: overallStats.overallPct },
          { label: "أيام متتالية 🔥", value: `${currentStreak} يوم`, icon: null },
        ].map((s, i) => (
          <div key={i} style={{ ...cardStyle, padding: "1rem 1.2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ color: "#888", fontSize: 11, margin: 0 }}>{s.label}</p>
              <p style={{ color: "#fff", fontSize: 19, fontWeight: 800, margin: "4px 0 0" }}>{s.value}</p>
            </div>
            {s.ring !== undefined && (
              <div
                style={{
                  width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                  background: `conic-gradient(${GOLD} ${s.ring * 3.6}deg, #1a1a0a 0deg)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#181A20" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* عنوان القسم + تبديل العرض */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
        <div>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>البرامج التعليمية</p>
          <p style={{ margin: "4px 0 0", color: "#777", fontSize: 12.5 }}>اختر البرنامج الذي تريد متابعته</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { key: "grid", icon: "▦" },
            { key: "list", icon: "☰" },
          ].map((v) => (
            <div
              key={v.key}
              onClick={() => setViewMode(v.key)}
              style={{
                width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                background: viewMode === v.key ? `${GOLD}22` : "#181A20",
                border: viewMode === v.key ? `1px solid ${GOLD}66` : `1px solid ${GOLD}22`,
                color: viewMode === v.key ? GOLD_LIGHT : "#666",
                cursor: "pointer", fontSize: 14,
              }}
            >
              {v.icon}
            </div>
          ))}
        </div>
      </div>

      {/* بطاقات البرامج */}
      <div
        style={{
          display: viewMode === "grid" ? "grid" : "flex",
          flexDirection: viewMode === "grid" ? undefined : "column",
          gridTemplateColumns: viewMode === "grid" ? "repeat(auto-fit, minmax(240px, 1fr))" : undefined,
          gap: "1rem",
        }}
      >
        {courseStats.length === 0 ? (
          <div style={{ color: "#444", fontSize: 13, textAlign: "center", padding: "2rem 0" }}>
            لا توجد برامج تعليمية بعد
          </div>
        ) : (
          courseStats.map((course) => (
            <div
              key={course.id}
              onClick={() => onSelectCourse(course.id)}
              style={{
                background: "#181A20",
                border: `1px solid ${course.color.border}`,
                borderRadius: 14,
                padding: "1.25rem",
                cursor: "pointer",
                display: "flex",
                flexDirection: viewMode === "grid" ? "column" : "row",
                alignItems: viewMode === "grid" ? "stretch" : "center",
                gap: "0.9rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
                <div
                  style={{
                    width: 46, height: 46, borderRadius: 10, background: course.color.soft,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0,
                  }}
                >
                  {course.icon}
                </div>
                {course.difficultyLabel && (
                  <span
                    style={{
                      background: course.color.soft, color: course.color.solid,
                      fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                      border: `1px solid ${course.color.border}`, whiteSpace: "nowrap",
                    }}
                  >
                    {course.difficultyLabel}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>{course.title}</div>
                {course.description && (
                  <div style={{ color: "#777", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>{course.description}</div>
                )}
                <div style={{ display: "flex", gap: "0.9rem", fontSize: 11.5, color: "#999", marginTop: 8 }}>
                  <span>📖 {course.totalLessons} درس</span>
                  <span>⏱ {course.totalHours.toFixed(1)} ساعة</span>
                </div>
              </div>

              <div style={{ minWidth: viewMode === "grid" ? undefined : 200, flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: course.color.solid, marginBottom: 5 }}>
                  <span>التقدم</span>
                  <span>{course.progressPct}%</span>
                </div>
                <div style={{ width: "100%", minWidth: 140, height: 6, background: "#1a1a0a", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${course.progressPct}%`, height: "100%", background: course.color.solid, borderRadius: 4 }} />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: viewMode === "grid" ? "column" : "row", gap: "0.5rem", flexShrink: 0 }}>
                <div
                  style={{
                    border: `1px solid ${course.color.solid}66`, color: course.color.solid,
                    fontWeight: 700, fontSize: 12, textAlign: "center",
                    padding: "0.55rem 1rem", borderRadius: 8, whiteSpace: "nowrap",
                  }}
                >
                  متابعة البرنامج ‹
                </div>
                <div style={{ color: "#888", fontSize: 11.5, textAlign: "center", padding: "0.3rem", textDecoration: "underline", whiteSpace: "nowrap" }}>
                  عرض المحتوى
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* شريط الميزات */}
      <div style={{ ...cardStyle, padding: "1.2rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
        {[
          { icon: "🎓", label: "شهادة معتمدة", sub: "احصل على شهادة عند إكمال جميع البرامج" },
          { icon: "🏆", label: "اختبارات وتقييمات", sub: "اختبر معلوماتك بعد كل فصل وتابع تقدمك" },
          { icon: "📈", label: "تطبيق عملي", sub: "طبق ما تتعلمه مباشرة على الشارت" },
          { icon: "⭐", label: "إنجازات ومكافآت", sub: "حقق الإنجازات وارتقِ في المستويات" },
        ].map((f, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6 }}>
            <div
              style={{
                width: 46, height: 46, borderRadius: "50%", background: `${GOLD}18`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}
            >
              {f.icon}
            </div>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#eee" }}>{f.label}</p>
            <p style={{ margin: 0, fontSize: 10.5, color: "#666", lineHeight: 1.4 }}>{f.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
