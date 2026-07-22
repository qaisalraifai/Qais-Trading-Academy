"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";
import AppShell from "../components/layout/AppShell";

/* ============================================================================
   DashboardClient — صارت "Overview" فقط (نظرة عامة سريعة)، مو داشبورد فيها كل
   الأدوات. كل أداة (Trading Radar, Market Intelligence, Replay, التقويم
   الاقتصادي, الكورسات...) أصبحت Workspace مستقلة بمسارها الخاص (راجع الروابط
   بقسم "الاختصارات" تحت). ما تغيّر أي منطق حسابي أو استعلام قاعدة بيانات هون —
   فقط أعيد تنظيم نفس البيانات المحسوبة أصلاً داخل كروت أوضح.
   ============================================================================ */

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2D57E";
const GOLD_DARK = "#9C7A22";
const GREEN = "#02C076";
const RED = "#F6465D";

const MARKETS = [
  { symbol: "EUR/USD", price: "1.0850", change: "+0.12%", up: true },
  { symbol: "GBP/USD", price: "1.2700", change: "-0.05%", up: false },
  { symbol: "XAU/USD", price: "2,045.50", change: "+0.85%", up: true },
  { symbol: "BTC/USD", price: "43,250", change: "+2.15%", up: true },
];

/* اختصارات لكل الـ Workspaces المستقلة — نفس الأدوات اللي كانت تبويبات قبل هيك */
const SHORTCUTS = [
  { href: "/trading-radar", icon: "📡", label: "Trading Radar", desc: "Heat Map, Liquidity, Session Map والفرص اللحظية" },
  { href: "/market-intelligence", icon: "🧠", label: "Market Intelligence", desc: "شارت مباشر + تحليل QAIS SK Engine الكامل" },
  { href: "/replay", icon: "🎯", label: "Replay التدريب", desc: "تدرّب على بيانات سابقة مع AI Coach" },
  { href: "/economic-calendar", icon: "📅", label: "التقويم الاقتصادي", desc: "الأخبار المؤثرة على السوق أول بأول" },
  { href: "/courses", icon: "🎓", label: "المحاضرات", desc: "أكمل رحلتك التعليمية بالأكاديمية" },
  { href: "/live-sessions", icon: "🔴", label: "البث المباشر", desc: "جلسات تداول حية مع المدربين" },
  { href: "/backtest", icon: "📊", label: "الصفقات", desc: "سجل وتابع صفقاتك بالتفصيل" },
  { href: "/reports", icon: "📋", label: "التقارير", desc: "تحليل أداءك الكامل كمتداول" },
  { href: "/trader-dna", icon: "🧬", label: "بصمتك كمتداول", desc: "نقاط قوتك وأخطاؤك المتكررة" },
  { href: "/mlm", icon: "🌐", label: "الشبكة (Network)", desc: "شجرتك الثنائية وعمولاتك" },
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

const cellStyle = { padding: "0.7rem", fontSize: 12, textAlign: "center", borderBottom: "1px solid #1a1a0f" };

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

/* زر "Open Workspace →" موحّد لكل الكروت */
function OpenWorkspaceLink({ href, label = "Open Workspace" }) {
  return (
    <Link
      href={href}
      style={{
        marginTop: "1rem",
        display: "block",
        textAlign: "center",
        border: `1px solid ${GOLD}44`,
        color: GOLD_LIGHT,
        fontSize: 12,
        fontWeight: 700,
        padding: "0.6rem",
        borderRadius: 10,
        textDecoration: "none",
      }}
    >
      {label} →
    </Link>
  );
}

function SectionTitle({ children }) {
  return <p style={{ color: GOLD, fontSize: 14, fontWeight: 700, margin: "0 0 1rem" }}>{children}</p>;
}

export default function DashboardClient({ username, isAdmin = false, subscriptionEnd = null, currentStreak = 0 }) {
  const [trades, setTrades] = useState([]);
  const [rawTrades, setRawTrades] = useState([]);
  const [balance, setBalance] = useState(3000);
  const [loading, setLoading] = useState(true);

  // بث مباشر نشط هلأ؟ (نفس المنطق القديم تماماً — بس هلأ فعلاً بنعرضه بكرت الاختصارات)
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

  // آخر الإشعارات — نفس API الموجود أصلاً (/api/notifications) والمستخدم بمركز
  // الإشعارات، فقط بنستهلكه هون كمان لعرض "آخر الإشعارات" بالـ Overview.
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

  const allTradesDesc = [...trades].reverse();
  const recentTrades = allTradesDesc.slice(0, 5);
  const initials = (username || "؟").trim().charAt(0).toUpperCase();

  let daysLeft = null;
  if (subscriptionEnd) {
    const diffMs = new Date(subscriptionEnd) - new Date();
    daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  return (
    <AppShell username={username} initials={initials} isAdmin={isAdmin} daysLeft={daysLeft} showProfileHeader={false}>
      <div style={{ flex: 1, padding: "1.6rem 2rem", overflowY: "auto" }}>
        {/* ============ Welcome Card ============ */}
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
          </div>
        </div>

        {loading ? (
          <div style={{ color: "#666", fontSize: 14, padding: "3rem 0", textAlign: "center" }}>...جاري تحميل بياناتك</div>
        ) : (
          <>
            {/* ============ AI Daily Summary ============ */}
            <div style={{ ...cardStyle, padding: "1.3rem", marginBottom: "1.4rem" }}>
              <SectionTitle>🧠 AI Daily Summary</SectionTitle>
              <p style={{ color: "#ccc", fontSize: 13, lineHeight: 1.9, margin: 0 }}>
                {total === 0
                  ? "لسا ما سجّلت صفقات — افتح Trading Radar لمتابعة الفرص اللحظية وابدأ ببناء سجلّك."
                  : `أداؤك هالشهر ${monthPnL >= 0 ? "إيجابي" : "سلبي"} بمقدار ${monthPnL >= 0 ? "$" : "-$"}${fmt(
                      Math.abs(monthPnL)
                    )}، ونسبة نجاحك الحالية ${winRate}% على ${total} صفقة. افتح Market Intelligence لمتابعة تحليل QAIS SK Engine اللحظي قبل أي دخول جديد.`}
              </p>
              <OpenWorkspaceLink href="/market-intelligence" label="Open Workspace" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem", marginBottom: "1.4rem" }}>
              {/* ============ Market Snapshot ============ */}
              <div style={{ ...cardStyle, padding: "1.3rem" }}>
                <SectionTitle>🌐 Market Snapshot</SectionTitle>
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
                <OpenWorkspaceLink href="/trading-radar" />
              </div>

              {/* ============ Today's Signals ============ */}
              <div style={{ ...cardStyle, padding: "1.3rem" }}>
                <SectionTitle>👀 Today's Signals</SectionTitle>
                <p style={{ color: "#ccc", fontSize: 13, lineHeight: 1.9, margin: 0 }}>
                  الفرص اللحظية وإشارات الدخول بتتحدّث بشكل مباشر داخل Trading Radar — Heat Map، Liquidity، وSession Map كلها
                  بمكان واحد.
                </p>
                <OpenWorkspaceLink href="/trading-radar" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.9rem", marginBottom: "1.4rem" }}>
              {/* ============ Quick Stats ============ */}
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
                <OpenWorkspaceLink href="/reports" label="عرض التقرير الكامل" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "0.9rem", marginBottom: "1.4rem" }}>
              {/* ============ Recent Activity ============ */}
              <div style={{ ...cardStyle, padding: "1.3rem" }}>
                <SectionTitle>📊 Recent Activity</SectionTitle>
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
                <OpenWorkspaceLink href="/backtest" label="عرض جميع الصفقات" />
              </div>

              {/* ============ Continue Learning ============ */}
              <div style={{ ...cardStyle, padding: "1.3rem", display: "flex", flexDirection: "column" }}>
                <SectionTitle>🎓 Continue Learning</SectionTitle>
                <p style={{ color: "#ccc", fontSize: 13, lineHeight: 1.9, margin: 0, flex: 1 }}>
                  {currentStreak > 0
                    ? `عندك ${currentStreak} يوم متتالي 🔥 — كمّل رحلتك التعليمية وحافظ على تتابعك.`
                    : "تابع محاضراتك وابنِ أساسك بالتحليل الفني والإدارة المالية من صفحة المحاضرات."}
                </p>
                <OpenWorkspaceLink href="/courses" />
              </div>
            </div>

            {/* ============ Latest Notifications ============ */}
            <div style={{ ...cardStyle, padding: "1.3rem", marginBottom: "1.4rem" }}>
              <SectionTitle>🔔 Latest Notifications</SectionTitle>
              {notifLoading ? (
                <p style={{ color: "#555", fontSize: 12, margin: 0 }}>...جاري التحميل</p>
              ) : notifications.length === 0 ? (
                <p style={{ color: "#555", fontSize: 12, margin: 0 }}>لا يوجد إشعارات جديدة حالياً.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.7rem 0.9rem",
                        background: "#181A20",
                        borderRight: `3px solid ${n.read ? "#333" : GOLD}`,
                        borderRadius: 8,
                        gap: 10,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: n.read ? "#999" : "#fff" }}>{n.title}</p>
                        {n.message && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#666" }}>{n.message}</p>}
                      </div>
                      {!n.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD_LIGHT, flexShrink: 0 }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ============ Shortcuts ============ */}
            <div style={{ ...cardStyle, padding: "1.3rem" }}>
              <SectionTitle>🚀 اختصارات إلى الأدوات</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.8rem" }}>
                {SHORTCUTS.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    style={{
                      display: "block",
                      background: "#181A20",
                      border: `1px solid ${GOLD}22`,
                      borderRadius: 12,
                      padding: "0.9rem 1rem",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 17 }}>{s.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{s.label}</span>
                      {s.href === "/live-sessions" && liveSession && (
                        <span style={{ fontSize: 9, fontWeight: 800, color: RED, border: `1px solid ${RED}55`, borderRadius: 20, padding: "1px 6px" }}>● مباشر الآن</span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 11.5, color: "#777", lineHeight: 1.6 }}>{s.desc}</p>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
