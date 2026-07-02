"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const GOLD = "#C9A24B";
const GOLD_DARK = "#a07a2e";
const GREEN = "#10b981";
const RED = "#ef4444";

const NAV_ITEMS = [
  { key: "dashboard", label: "لوحة التحكم", icon: "🏠", href: "/dashboard" },
  { key: "accounts", label: "إدارة الحسابات", icon: "👥", href: "/dashboard" },
  { key: "lectures", label: "المحاضرات", icon: "🎓", href: "/lecture" },
  { key: "strategies", label: "الاستراتيجيات", icon: "🧩", href: "/dashboard" },
  { key: "trades", label: "الصفقات", icon: "📊", href: "/backtest" },
  { key: "reports", label: "التقارير", icon: "📋", href: "/dashboard" },
  { key: "settings", label: "الإعدادات", icon: "⚙️", href: "/dashboard" },
];

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DashboardClient({ username }) {
  const [trades, setTrades] = useState([]);
  const [balance, setBalance] = useState(3000);
  const [form, setForm] = useState({
    asset: "XAUUSD", direction: "buy", timeframe: "1H",
    date: new Date().toISOString().slice(0, 10),
    entry: "5000", sl: "4997", tp: "5020", lot: "0.01",
  });

  const storageKey = `qta_backtest_trades_${username}`;
  const balanceKey = `qta_backtest_balance_${username}`;

  useEffect(() => {
    const t = JSON.parse(localStorage.getItem(storageKey) || "[]");
    const b = parseFloat(localStorage.getItem(balanceKey) || "3000");
    setTrades(t);
    setBalance(b);
  }, [storageKey, balanceKey]);

  const saveState = useCallback((newTrades, newBalance) => {
    localStorage.setItem(storageKey, JSON.stringify(newTrades));
    localStorage.setItem(balanceKey, newBalance);
  }, [storageKey, balanceKey]);

  const total = trades.length;
  const wins = trades.filter(t => t.result === "win").length;
  const losses = trades.filter(t => t.result === "loss").length;
  const decided = wins + losses;
  const winRate = decided > 0 ? ((wins / decided) * 100).toFixed(1) : "0.0";
  const netPnL = trades.reduce((acc, t) => {
    if (t.result === "win") return acc + (t.rewardAmount || 0);
    if (t.result === "loss") return acc - (t.riskAmount || 0);
    return acc;
  }, 0);

  const now = new Date();
  const monthTrades = trades.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthPnL = monthTrades.reduce((acc, t) => {
    if (t.result === "win") return acc + (t.rewardAmount || 0);
    if (t.result === "loss") return acc - (t.riskAmount || 0);
    return acc;
  }, 0);

  function handleAddTrade() {
    const entry = parseFloat(form.entry) || 0;
    const sl = parseFloat(form.sl) || 0;
    const tp = parseFloat(form.tp) || 0;
    const lot = parseFloat(form.lot) || 0;
    if (!entry || !sl || !tp || !lot) {
      alert("يرجى تعبئة كل الحقول");
      return;
    }
    const riskAmount = Math.abs(entry - sl) * lot * 100;
    const rewardAmount = Math.abs(tp - entry) * lot * 100;
    const rr = riskAmount > 0 ? rewardAmount / riskAmount : 0;
    const riskPercent = balance > 0 ? (riskAmount / balance) * 100 : 0;

    const trade = {
      id: Date.now().toString(),
      asset: form.asset, date: form.date, direction: form.direction,
      timeframe: form.timeframe, lot, entry, sl, tp,
      result: "pending", setup: "", reason: "",
      riskAmount, rewardAmount, rr, riskPercent, isLive: false,
    };
    const newTrades = [...trades, trade];
    setTrades(newTrades);
    saveState(newTrades, balance);
  }

  let running = 0;
  const chartPoints = trades.map((t, i) => {
    if (t.result === "win") running += t.rewardAmount || 0;
    if (t.result === "loss") running -= t.riskAmount || 0;
    return { i, value: running };
  });
  const maxVal = Math.max(1, ...chartPoints.map(p => Math.abs(p.value)));
  const chartW = 560, chartH = 160;
  const pathD = chartPoints.length > 1
    ? chartPoints.map((p, idx) => {
        const x = (idx / (chartPoints.length - 1)) * chartW;
        const y = chartH / 2 - (p.value / maxVal) * (chartH / 2 - 10);
        return `${idx === 0 ? "M" : "L"}${x},${y}`;
      }).join(" ")
    : "";

  const recent = [...trades].slice(-6).reverse();

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #1a1200 0%, #0a0a0a 60%)",
      color: "#fff", fontFamily: "'Segoe UI', sans-serif", direction: "rtl",
      display: "flex",
    }}>
      {/* Sidebar */}
      <div style={{
        width: 230, flexShrink: 0,
        background: "linear-gradient(180deg, #111108 0%, #0a0a0a 100%)",
        borderLeft: "1px solid #C9A24B22",
        padding: "1.5rem 1rem", display: "flex", flexDirection: "column",
      }}>
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
          {NAV_ITEMS.map((item, idx) => (
            <Link key={item.key} href={item.href} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "0.7rem 0.9rem", borderRadius: 10,
                background: idx === 0 ? `linear-gradient(135deg, ${GOLD}22, ${GOLD_DARK}11)` : "transparent",
                border: idx === 0 ? `1px solid ${GOLD}55` : "1px solid transparent",
                color: idx === 0 ? GOLD : "#888", fontSize: 13, fontWeight: idx === 0 ? 700 : 400,
              }}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 4, paddingTop: "1.5rem", borderTop: "1px solid #1a1a0a" }}>
          <Link href="/discord" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.7rem 0.9rem", color: "#5865F2", fontSize: 13 }}>
              <span>🎮</span><span>مجتمع Discord</span>
            </div>
          </Link>
          <div
            onClick={async () => {
              const { createClient } = await import("@/lib/supabase-browser");
              const supabase = createClient();
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.7rem 0.9rem", color: "#888", fontSize: 13, cursor: "pointer" }}
          >
            <span>🚪</span><span>تسجيل الخروج</span>
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

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.9rem", marginBottom: "1.5rem" }}>
          {[
            { label: "إجمالي الصفقات", value: total, icon: "📷", color: "#fff" },
            { label: "نسبة النجاح", value: `${winRate}%`, icon: "🎯", color: "#fff" },
            { label: "صافي الربح/الخسارة", value: `${netPnL >= 0 ? "$" : "-$"}${fmt(Math.abs(netPnL))}`, icon: "📈", color: netPnL >= 0 ? GREEN : RED },
            { label: "رأس المال الحالي", value: `$${fmt(balance)}`, icon: "💼", color: GOLD },
            { label: "ربع الشهر", value: `${monthPnL >= 0 ? "$" : "-$"}${fmt(Math.abs(monthPnL))}`, icon: "💵", color: monthPnL >= 0 ? GREEN : RED },
          ].map((s, i) => (
            <div key={i} style={{
              background: "linear-gradient(145deg, #111108, #0d0d0a)",
              border: "1px solid #C9A24B22", borderRadius: 14, padding: "1rem",
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}>
              <div>
                <p style={{ color: "#666", fontSize: 11, margin: "0 0 0.5rem" }}>{s.label}</p>
                <p style={{ color: s.color, fontSize: 20, fontWeight: 800, margin: 0 }}>{s.value}</p>
              </div>
              <span style={{ fontSize: 18, opacity: 0.6 }}>{s.icon}</span>
            </div>
          ))}
        </div>

        {/* Form + Chart row */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>

          {/* Add trade form */}
          <div style={{ background: "linear-gradient(145deg, #111108, #0d0d0a)", border: "1px solid #C9A24B22", borderRadius: 16, padding: "1.3rem", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <p style={{ color: GOLD, fontSize: 14, fontWeight: 700, margin: "0 0 1rem" }}>➕ إضافة صفقة جديدة</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.7rem", marginBottom: "0.7rem" }}>
              <Field label="الأصل">
                <select value={form.asset} onChange={e => setForm({ ...form, asset: e.target.value })} style={inputStyle}>
                  <option value="XAUUSD">XAUUSD (ذهب)</option>
                  <option value="EURUSD">EUR/USD</option>
                  <option value="BTCUSD">BTC/USD</option>
                </select>
              </Field>
              <Field label="الاتجاه">
                <div style={{ display: "flex", background: "#0d0d0a", border: "1px solid #C9A24B22", borderRadius: 8, overflow: "hidden" }}>
                  <button onClick={() => setForm({ ...form, direction: "sell" })} style={{
                    flex: 1, padding: "0.55rem", border: "none", cursor: "pointer",
                    background: form.direction === "sell" ? RED : "transparent",
                    color: form.direction === "sell" ? "#fff" : "#888", fontSize: 12, fontWeight: 700,
                  }}>بيع</button>
                  <button onClick={() => setForm({ ...form, direction: "buy" })} style={{
                    flex: 1, padding: "0.55rem", border: "none", cursor: "pointer",
                    background: form.direction === "buy" ? GREEN : "transparent",
                    color: form.direction === "buy" ? "#fff" : "#888", fontSize: 12, fontWeight: 700,
                  }}>▲ شراء</button>
                </div>
              </Field>
              <Field label="الوقت / الإطار">
                <select value={form.timeframe} onChange={e => setForm({ ...form, timeframe: e.target.value })} style={inputStyle}>
                  <option value="5M">5M</option>
                  <option value="15M">15M</option>
                  <option value="1H">1H</option>
                  <option value="4H">4H</option>
                  <option value="1D">1D</option>
                </select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.7rem", marginBottom: "0.7rem" }}>
              <Field label="التاريخ">
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="سعر الدخول">
                <input type="number" value={form.entry} onChange={e => setForm({ ...form, entry: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="وقف الخسارة (SL)">
                <input type="number" value={form.sl} onChange={e => setForm({ ...form, sl: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="الهدف (TP)">
                <input type="number" value={form.tp} onChange={e => setForm({ ...form, tp: e.target.value })} style={inputStyle} />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem", marginBottom: "1rem" }}>
              <Field label="حجم الصفقة">
                <input type="number" step="0.01" value={form.lot} onChange={e => setForm({ ...form, lot: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="النتيجة">
                <div style={{ ...inputStyle, color: "#555" }}>—</div>
              </Field>
            </div>
            <button onClick={handleAddTrade} style={{
              width: "100%", background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
              color: "#000", fontWeight: 700, fontSize: 14, border: "none",
              borderRadius: 10, padding: "0.8rem", cursor: "pointer",
              boxShadow: `0 4px 12px ${GOLD}44`,
            }}>حفظ الصفقة</button>
          </div>

          {/* Chart */}
          <div style={{ background: "linear-gradient(145deg, #111108, #0d0d0a)", border: "1px solid #C9A24B22", borderRadius: 16, padding: "1.3rem", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <p style={{ color: GOLD, fontSize: 14, fontWeight: 700, margin: "0 0 1rem" }}>📈 الأداء</p>
            {chartPoints.length > 1 ? (
              <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: "100%", height: 160 }}>
                <line x1="0" y1={chartH / 2} x2={chartW} y2={chartH / 2} stroke="#222" strokeWidth="1" />
                <path d={pathD} fill="none" stroke={netPnL >= 0 ? GREEN : RED} strokeWidth="2" />
              </svg>
            ) : (
              <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontSize: 12 }}>
                لا توجد بيانات كافية بعد
              </div>
            )}
          </div>
        </div>

        {/* Recent trades table */}
        <div style={{ background: "linear-gradient(145deg, #111108, #0d0d0a)", border: "1px solid #C9A24B22", borderRadius: 16, padding: "1.3rem", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
          <p style={{ color: GOLD, fontSize: 14, fontWeight: 700, margin: "0 0 1rem" }}>🕒 أحدث الصفقات</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead>
                <tr>
                  {["الأصل", "الاتجاه", "الحجم", "الدخول", "SL", "TP", "النتيجة"].map(h => (
                    <th key={h} style={{ color: "#666", fontSize: 11, padding: "0.6rem", borderBottom: "1px solid #1a1a0a", textAlign: "center" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "#444", padding: "2rem 0" }}>لا توجد صفقات بعد</td></tr>
                ) : recent.map(t => (
                  <tr key={t.id}>
                    <td style={cellStyle}>{t.asset}</td>
                    <td style={{ ...cellStyle, color: t.direction === "buy" ? GREEN : RED }}>{t.direction === "buy" ? "▲ شراء" : "▼ بيع"}</td>
                    <td style={cellStyle}>{t.lot}</td>
                    <td style={cellStyle}>{t.entry}</td>
                    <td style={cellStyle}>{t.sl}</td>
                    <td style={cellStyle}>{t.tp}</td>
                    <td style={{ ...cellStyle, color: t.result === "win" ? GREEN : t.result === "loss" ? RED : "#888" }}>
                      {t.result === "win" ? "✓ رابحة" : t.result === "loss" ? "✗ خاسرة" : "قيد التنفيذ"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", background: "#0d0d0a", border: "1px solid #C9A24B22",
  color: "#fff", padding: "0.55rem 0.6rem", borderRadius: 8, fontSize: 13,
};
const cellStyle = { padding: "0.7rem", fontSize: 12, textAlign: "center", borderBottom: "1px solid #1a1a0f" };

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", color: "#666", fontSize: 11, marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
