"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";
import BacktestClient from "../backtest/BacktestClient";
import ReplayClient from "../replay/ReplayClient";

const GOLD = "#C9A24B";
const GOLD_LIGHT = "#E8C468";
const GOLD_DARK = "#a07a2e";
const GREEN = "#10b981";
const RED = "#ef4444";

const NAV_ITEMS = [
  { key: "accounts", label: "إدارة الحسابات", icon: "👥", view: "accounts" },
  { key: "lectures", label: "المحاضرات", icon: "🎓", view: "lectures" },
  { key: "replay", label: "Replay التدريب", icon: "🎯", view: "replay" },
  { key: "strategies", label: "الاستراتيجيات", icon: "🧩", view: "strategies" },
  { key: "trades", label: "الصفقات", icon: "📊", view: "backtest" },
  { key: "reports", label: "التقارير", icon: "📋", view: "reports" },
  { key: "settings", label: "الإعدادات", icon: "⚙️", view: "settings" },
];

const PLACEHOLDER_LABELS = {
  accounts: "إدارة الحسابات",
  strategies: "الاستراتيجيات",
  reports: "التقارير",
  settings: "الإعدادات",
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
  background: "linear-gradient(145deg, #14120a, #0d0d0a)",
  border: 1px solid ${GOLD}26,
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
        background: linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK}),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        flexShrink: 0,
        boxShadow: 0 2px 8px ${GOLD}55,
      }}
    >
      {children}
    </div>
  );
}

export default function DashboardClient({ username }) {
  const [trades, setTrades] = useState([]); // بترتيب زمني تصاعدي (الأقدم أولاً) - للرسم البياني
  const [rawTrades, setRawTrades] = useState([]); // الشكل الخام من قاعدة البيانات - تحتاجه أداة الباك تيست
  const [balance, setBalance] = useState(3000);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  // التنقل الداخلي داخل نفس الصفحة (بدون الخروج من الداشبورد)
  const [activeKey, setActiveKey] = useState("dashboard");
  const [lectures, setLectures] = useState([]);
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [selectedLecture, setSelectedLecture] = useState(null);

  useEffect(() => {
    if (activeKey !== "lectures" || lectures.length > 0) return;
    let active = true;
    async function loadLectures() {
      setLecturesLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("lectures")
        .select("*")
        .order("order_index", { ascending: true });
      if (!active) return;
      setLectures(data || []);
      setLecturesLoading(false);
    }
    loadLectures();
    return () => {
      active = false;
    };
  }, [activeKey, lectures.length]);

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
        return ${idx === 0 ? "M" : "L"}${x},${y};
      })
      .join(" ");
  }
  const balPath = lineFor("bal");
  const pnlPath = lineFor("pnl");

  const allTradesDesc = [...trades].reverse(); // الأحدث أولاً للعرض بالجدول
  const recentTrades = allTradesDesc.slice(0, 5);
  const initials = (username || "؟").trim().charAt(0).toUpperCase();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at top, #1a1200 0%, #0a0a0a 60%)",
        color: "#fff",
        fontFamily: "'Segoe UI', sans-serif",
        direction: "rtl",
        display: "flex",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: 240,
          flexShrink: 0,
          background: "linear-gradient(180deg, #111108 0%, #0a0a0a 100%)",
          borderLeft: 1px solid ${GOLD}22,
          padding: "1.5rem 1rem",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.6rem" }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", border: 2px solid ${GOLD}, overflow: "hidden", flexShrink: 0 }}>
            <img src="/logo.jpg" style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="QTA" />
          </div>
          <div>
            <p style={{ color: GOLD, fontSize: 10, letterSpacing: 2, margin: 0 }}>QAIS TRADING</p>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 700, margin: 0 }}>ACADEMY</p>
          </div>
        </div>

        {/* زر لوحة التحكم - دائماً بارز بالذهبي كنقطة انطلاق رئيسية */}
        <div
          onClick={() => setActiveKey("dashboard")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "0.75rem 0.9rem",
            borderRadius: 12,
            background: linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK}),
            color: "#1a1200",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            marginBottom: "1.1rem",
            boxShadow: 0 4px 16px ${GOLD}44,
          }}
        >
          <span>🏠</span>
          <span>لوحة التحكم</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.view === activeKey;
            const itemStyle = {
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0.7rem 0.9rem",
              borderRadius: 10,
              background: isActive ? linear-gradient(135deg, ${GOLD}22, ${GOLD_DARK}11) : "transparent",
              border: isActive ? 1px solid ${GOLD}55 : "1px solid transparent",
              color: isActive ? GOLD : "#888",
              fontSize: 13,
              fontWeight: isActive ? 700 : 400,
              cursor: "pointer",
            };

            return (
              <div
                key={item.key}
                onClick={() => {
                  setActiveKey(item.view);
                  if (item.view === "lectures") setSelectedLecture(null);
                }}
                style={itemStyle}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>

        {/* بطاقة Elite Access */}
        <div
          style={{
            marginTop: "1.4rem",
            background: linear-gradient(135deg, ${GOLD}1a, #0d0d0a),
            border: 1px solid ${GOLD}44,
            borderRadius: 14,
            padding: "0.9rem 1rem",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 20 }}>💎</span>
          <div>
            <p style={{ color: GOLD_LIGHT, fontSize: 13, fontWeight: 800, margin: 0 }}>Elite Access</p>
            <p style={{ color: "#888", fontSize: 10, margin: "2px 0 0" }}>وصول كامل لجميع الميزات الاحترافية</p>
          </div>
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 4, paddingTop: "1.4rem", borderTop: "1px solid #1a1a0a" }}>
          <Link href="/discord" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.7rem 0.9rem", color: "#5865F2", fontSize: 13 }}>
              <span>🎮</span>
              <span>مجتمع Discord</span>
            </div>
          </Link>
          <div
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.7rem 0.9rem", color: "#888", fontSize: 13, cursor: "pointer" }}
          >
            <span>🚪</span>
            <span>تسجيل الخروج</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: "1.6rem 2rem", overflowY: "auto" }}>
        {/* Header: بطاقة البروفايل + الترحيب */}
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
                background: linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK}),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 800,
                color: "#1a1200",
                flexShrink: 0,
                border: 2px solid ${GOLD},
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 800 }}>{username}</span>
                <span
                  style={{
                    background: linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK}),
                    color: "#1a1200",
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
                  border: 1px solid ${GREEN}33,
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
                border: 1px solid ${GOLD}33,
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

        {activeKey === "lectures" ? (
          <LecturesView
            lectures={lectures}
            loading={lecturesLoading}
            selectedLecture={selectedLecture}
            onSelect={setSelectedLecture}
            onBack={() => setSelectedLecture(null)}
          />
        ) : activeKey === "replay" ? (
          <ReplayClient />
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
                  value: ${monthPnL >= 0 ? "$" : "-$"}${fmt(Math.abs(monthPnL))},
                  icon: "💵",
                  color: monthPnL >= 0 ? GREEN : RED,
                  sub: ${monthPnL >= 0 ? "+" : ""}${balance ? ((monthPnL / balance) * 100).toFixed(2) : "0.00"}% من رأس المال,
                },
                {
                  label: "رأس المال الحالي",
                  value: $${fmt(balance)},
                  icon: "💼",
                  color: GOLD_LIGHT,
                  sub: بداية من $${fmt(startingCapital)},
                },
                {
                  label: "صافي الربح/الخسارة",
                  value: ${netPnL >= 0 ? "$" : "-$"}${fmt(Math.abs(netPnL))},
                  icon: "📈",
                  color: netPnL >= 0 ? GREEN : RED,
                  sub: ${netPnL >= 0 ? "+" : ""}${startingCapital ? ((netPnL / startingCapital) * 100).toFixed(2) : "0.00"}% من رأس مال البداية,
                },
                {
                  label: "نسبة النجاح",
                  value: ${winRate}%,
                  icon: "🎯",
                  color: "#fff",
                  sub: "الهدف القادم: 70%",
                },
                {
                  label: "إجمالي الصفقات",
                  value: total,
                  icon: "📷",
                  color: "#fff",
                  sub: ${openTrades} صفقة مفتوحة,
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
                    <div style={{ background: "#111", border: 1px solid ${GOLD}33, color: "#aaa", fontSize: 11, padding: "0.35rem 0.8rem", borderRadius: 20 }}>تفصيلي ⌄</div>
                    <div style={{ background: ${GOLD}18, border: 1px solid ${GOLD}44, color: GOLD_LIGHT, fontSize: 11, fontWeight: 700, padding: "0.35rem 0.8rem", borderRadius: 20 }}>12 شهر</div>
                  </div>
                </div>
                {chartPoints.length > 1 ? (
                  <svg viewBox={0 0 ${chartW} ${chartH}} style={{ width: "100%", height: 230 }}>
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
                    { label: "أفضل صفقة", value: $${fmt(bestTrade)}, color: GREEN, icon: "🏆" },
                    { label: "أسوأ صفقة", value: $${fmt(worstTrade)}, color: RED, icon: "🛡️" },
                    { label: "متوسط الربح", value: $${fmt(avgWin)}, color: GREEN, icon: "📈" },
                    { label: "متوسط الخسارة", value: $${fmt(avgLoss)}, color: RED, icon: "📉" },
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
                    border: 1px solid ${GOLD}44,
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
                    border: 1px solid ${GOLD}33,
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
                        background: "#0d0d0a",
                        borderRight: 3px solid ${m.up ? GREEN : RED},
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
                    border: 1px solid ${GOLD}33,
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
    </div>
  );
}

const cellStyle = { padding: "0.7rem", fontSize: 12, textAlign: "center", borderBottom: "1px solid #1a1a0f" };

function LecturesView({ lectures, loading, selectedLecture, onSelect, onBack }) {
  if (loading) {
    return (
      <div style={{ color: "#666", fontSize: 14, padding: "3rem 0", textAlign: "center" }}>
        ...جاري تحميل المحاضرات
      </div>
    );
  }

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
            ← قائمة المحاضرات
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
            border: 1px solid ${GOLD}22,
          }}
        >
          <iframe
            src={https://www.youtube.com/embed/${selectedLecture.youtube_video_id}?rel=0&modestbranding=1}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...cardStyle, padding: "1.3rem" }}>
      <p style={{ color: GOLD, fontSize: 14, fontWeight: 700, margin: "0 0 1rem" }}>🎓 المحاضرات</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
        {lectures.length === 0 ? (
          <div style={{ color: "#444", fontSize: 13, textAlign: "center", padding: "2rem 0" }}>
            لا توجد محاضرات بعد
          </div>
        ) : (
          lectures.map((lecture, index) => (
            <div
              key={lecture.id}
              onClick={() => onSelect(lecture)}
              style={{
                background: "#0d0d0a",
                border: 1px solid ${GOLD}22,
                borderRadius: 12,
                padding: "1rem 1.2rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: linear-gradient(135deg, ${GOLD}, ${GOLD_DARK}),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  color: "#000",
                  fontSize: 15,
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{lecture.title}</div>
                {lecture.description && (
                  <div style={{ color: "#666", fontSize: 12, marginTop: 3 }}>{lecture.description}</div>
                )}
              </div>
              <div style={{ color: GOLD, fontSize: 14 }}>←</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
