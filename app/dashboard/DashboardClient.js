"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

const GOLD = "#C9A24B";
const GOLD_DARK = "#a07a2e";
const GREEN = "#10b981";
const RED = "#ef4444";

const NAV_ITEMS = [
  { key: "dashboard", label: "لوحة التحكم", icon: "🏠", view: "dashboard" },
  { key: "accounts", label: "إدارة الحسابات", icon: "👥", view: "accounts" },
  { key: "lectures", label: "المحاضرات", icon: "🎓", view: "lectures" },
  { key: "strategies", label: "الاستراتيجيات", icon: "🧩", view: "strategies" },
  { key: "trades", label: "الصفقات", icon: "📊", href: "/backtest" },
  { key: "reports", label: "التقارير", icon: "📋", view: "reports" },
  { key: "settings", label: "الإعدادات", icon: "⚙️", view: "settings" },
];

const PLACEHOLDER_LABELS = {
  accounts: "إدارة الحسابات",
  strategies: "الاستراتيجيات",
  reports: "التقارير",
  settings: "الإعدادات",
};

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

export default function DashboardClient({ username }) {
  const [trades, setTrades] = useState([]); // بترتيب زمني تصاعدي (الأقدم أولاً) - للرسم البياني
  const [balance, setBalance] = useState(3000);
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

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;

      const [{ data: tradesRows }, { data: profile }] = await Promise.all([
        supabase
          .from("trades")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase.from("profiles").select("backtest_balance").eq("id", user.id).single(),
      ]);

      if (!active) return;
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
  const decided = wins + losses;
  const winRate = decided > 0 ? ((wins / decided) * 100).toFixed(1) : "0.0";
  const netPnL = trades.reduce((acc, t) => {
    if (t.result === "win") return acc + (t.rewardAmount || 0);
    if (t.result === "loss") return acc - (t.riskAmount || 0);
    return acc;
  }, 0);

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

  let running = 0;
  const chartPoints = trades.map((t, i) => {
    if (t.result === "win") running += t.rewardAmount || 0;
    if (t.result === "loss") running -= t.riskAmount || 0;
    return { i, value: running };
  });
  const maxVal = Math.max(1, ...chartPoints.map((p) => Math.abs(p.value)));
  const chartW = 560,
    chartH = 160;
  const pathD =
    chartPoints.length > 1
      ? chartPoints
          .map((p, idx) => {
            const x = (idx / (chartPoints.length - 1)) * chartW;
            const y = chartH / 2 - (p.value / maxVal) * (chartH / 2 - 10);
            return `${idx === 0 ? "M" : "L"}${x},${y}`;
          })
          .join(" ")
      : "";

  const allTradesDesc = [...trades].reverse(); // الأحدث أولاً للعرض بالجدول

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
          width: 230,
          flexShrink: 0,
          background: "linear-gradient(180deg, #111108 0%, #0a0a0a 100%)",
          borderLeft: "1px solid #C9A24B22",
          padding: "1.5rem 1rem",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "2rem" }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", border: `2px solid ${GOLD}`, overflow: "hidden", flexShrink: 0 }}>
            <img src="/logo.jpg" style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="QTA" />
          </div>
          <div>
            <p style={{ color: GOLD, fontSize: 10, letterSpacing: 2, margin: 0 }}>QAIS TRADING</p>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 700, margin: 0 }}>ACADEMY</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.view ? item.view === activeKey : false;
            const itemStyle = {
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0.7rem 0.9rem",
              borderRadius: 10,
              background: isActive ? `linear-gradient(135deg, ${GOLD}22, ${GOLD_DARK}11)` : "transparent",
              border: isActive ? `1px solid ${GOLD}55` : "1px solid transparent",
              color: isActive ? GOLD : "#888",
              fontSize: 13,
              fontWeight: isActive ? 700 : 400,
              cursor: "pointer",
            };

            if (item.href) {
              return (
                <Link key={item.key} href={item.href} style={{ textDecoration: "none" }}>
                  <div style={itemStyle}>
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            }

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

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 4, paddingTop: "1.5rem", borderTop: "1px solid #1a1a0a" }}>
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
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.8rem", marginBottom: "1.5rem" }}>
          <div>
            <p style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>👋 مرحباً بك مجدداً، {username}</p>
            <p style={{ color: "#555", fontSize: 13, margin: "4px 0 0" }}>نظرة عامة على أدائك في التداول</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ background: "#111", border: "1px solid #C9A24B22", color: "#888", fontSize: 12, padding: "0.5rem 1rem", borderRadius: 20 }}>⚙ السوق الحالي</div>
            <div style={{ background: "#0f3d2c", border: "1px solid #10b98133", color: GREEN, fontSize: 13, fontWeight: 700, padding: "0.5rem 1.1rem", borderRadius: 20 }}>💰 ${fmt(balance)}</div>
            <div style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}33`, color: GOLD, fontSize: 13, fontWeight: 700, padding: "0.5rem 1.1rem", borderRadius: 20 }}>👤 {username}</div>
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
        ) : activeKey !== "dashboard" ? (
          <div
            style={{
              background: "linear-gradient(145deg, #111108, #0d0d0a)",
              border: "1px solid #C9A24B22",
              borderRadius: 16,
              padding: "3rem",
              textAlign: "center",
              color: "#666",
              fontSize: 14,
            }}
          >
            {PLACEHOLDER_LABELS[activeKey]} — قريباً
          </div>
        ) : loading ? (
          <div style={{ color: "#666", fontSize: 14, padding: "3rem 0", textAlign: "center" }}>...جاري تحميل بياناتك</div>
        ) : (
          <>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.9rem", marginBottom: "1.5rem" }}>
              {[
                { label: "إجمالي الصفقات", value: total, icon: "📷", color: "#fff" },
                { label: "نسبة النجاح", value: `${winRate}%`, icon: "🎯", color: "#fff" },
                { label: "صافي الربح/الخسارة", value: `${netPnL >= 0 ? "$" : "-$"}${fmt(Math.abs(netPnL))}`, icon: "📈", color: netPnL >= 0 ? GREEN : RED },
                { label: "رأس المال الحالي", value: `$${fmt(balance)}`, icon: "💼", color: GOLD },
                { label: "ربح الشهر", value: `${monthPnL >= 0 ? "$" : "-$"}${fmt(Math.abs(monthPnL))}`, icon: "💵", color: monthPnL >= 0 ? GREEN : RED },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    background: "linear-gradient(145deg, #111108, #0d0d0a)",
                    border: "1px solid #C9A24B22",
                    borderRadius: 14,
                    padding: "1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  }}
                >
                  <div>
                    <p style={{ color: "#666", fontSize: 11, margin: "0 0 0.5rem" }}>{s.label}</p>
                    <p style={{ color: s.color, fontSize: 20, fontWeight: 800, margin: 0 }}>{s.value}</p>
                  </div>
                  <span style={{ fontSize: 18, opacity: 0.6 }}>{s.icon}</span>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div
              style={{
                background: "linear-gradient(145deg, #111108, #0d0d0a)",
                border: "1px solid #C9A24B22",
                borderRadius: 16,
                padding: "1.3rem",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                marginBottom: "1.5rem",
              }}
            >
              <p style={{ color: GOLD, fontSize: 14, fontWeight: 700, margin: "0 0 1rem" }}>📈 الأداء</p>
              {chartPoints.length > 1 ? (
                <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: "100%", height: 220 }}>
                  <line x1="0" y1={chartH / 2} x2={chartW} y2={chartH / 2} stroke="#222" strokeWidth="1" />
                  <path d={pathD} fill="none" stroke={netPnL >= 0 ? GREEN : RED} strokeWidth="2" />
                </svg>
              ) : (
                <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontSize: 12 }}>
                  لا توجد بيانات كافية بعد — ضيف صفقات من صفحة الباك تيست
                </div>
              )}
            </div>

            {/* All trades table */}
            <div
              style={{
                background: "linear-gradient(145deg, #111108, #0d0d0a)",
                border: "1px solid #C9A24B22",
                borderRadius: 16,
                padding: "1.3rem",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}
            >
              <p style={{ color: GOLD, fontSize: 14, fontWeight: 700, margin: "0 0 1rem" }}>📊 كل الصفقات ({total})</p>
              <div style={{ overflowX: "auto", maxHeight: 480, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                  <thead>
                    <tr>
                      {["الأصل", "التاريخ", "الاتجاه", "الحجم", "الدخول", "SL", "TP", "النتيجة"].map((h) => (
                        <th key={h} style={{ color: "#666", fontSize: 11, padding: "0.6rem", borderBottom: "1px solid #1a1a0a", textAlign: "center", position: "sticky", top: 0, background: "#111108" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allTradesDesc.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", color: "#444", padding: "2rem 0" }}>
                          لا توجد صفقات بعد — ضيف أول صفقة من صفحة الباك تيست
                        </td>
                      </tr>
                    ) : (
                      allTradesDesc.map((t) => (
                        <tr key={t.id}>
                          <td style={cellStyle}>{t.asset}</td>
                          <td style={cellStyle}>{t.date}</td>
                          <td style={{ ...cellStyle, color: t.direction === "buy" ? GREEN : RED }}>{t.direction === "buy" ? "▲ شراء" : "▼ بيع"}</td>
                          <td style={cellStyle}>{t.lot}</td>
                          <td style={cellStyle}>{t.entry}</td>
                          <td style={cellStyle}>{t.sl}</td>
                          <td style={cellStyle}>{t.tp}</td>
                          <td style={{ ...cellStyle, color: t.result === "win" ? GREEN : t.result === "loss" ? RED : "#888" }}>
                            {t.result === "win" ? "✓ رابحة" : t.result === "loss" ? "✗ خاسرة" : t.result === "breakeven" ? "تعادل" : "قيد التنفيذ"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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
      <div
        style={{
          background: "linear-gradient(145deg, #111108, #0d0d0a)",
          border: "1px solid #C9A24B22",
          borderRadius: 16,
          padding: "1.3rem",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
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
            border: "1px solid #C9A24B22",
          }}
        >
          <iframe
            src={`https://www.youtube.com/embed/${selectedLecture.youtube_video_id}?rel=0&modestbranding=1`}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "linear-gradient(145deg, #111108, #0d0d0a)",
        border: "1px solid #C9A24B22",
        borderRadius: 16,
        padding: "1.3rem",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      }}
    >
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
                border: "1px solid #C9A24B22",
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
                  background: "linear-gradient(135deg, #C9A24B, #a07a2e)",
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
}
