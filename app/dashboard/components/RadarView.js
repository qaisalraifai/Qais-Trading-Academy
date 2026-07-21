"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Star,
  Settings,
  Bell,
  BellOff,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Clock,
  Target,
  Gauge,
  Activity,
  History,
  Radar as RadarIcon,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { ASSETS, getAssetByValue } from "@/lib/assets";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2D57E";
const GOLD_DIM = "#8a7332";
const BG_PANEL_FROM = "#1d2026";
const BG_PANEL_TO = "#15171c";
const BORDER = "#2a2d34";

/* ألوان حالة الرادار — مطابقة لكود الألوان المطلوب:
   أخضر=Strong Buy، أزرق=Buy Setup، أصفر=Neutral/Waiting، برتقالي=Sell Setup،
   أحمر=Strong Sell، رمادي=No Setup */
const STATUS_META = {
  green: { color: "#02C076", glow: "rgba(2,192,118,0.55)", label: "Strong Buy" },
  blue: { color: "#3B82F6", glow: "rgba(59,130,246,0.5)", label: "Buy Setup" },
  yellow: { color: "#eab308", glow: "rgba(234,179,8,0.45)", label: "Neutral / Waiting" },
  orange: { color: "#f97316", glow: "rgba(249,115,22,0.5)", label: "Sell Setup" },
  red: { color: "#F6465D", glow: "rgba(246,70,93,0.55)", label: "Strong Sell" },
  gray: { color: "#6b7280", glow: "rgba(107,114,128,0.25)", label: "No Setup" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "buy", label: "Buy" },
  { key: "sell", label: "Sell" },
  { key: "waiting", label: "Waiting" },
  { key: "high", label: "High Confidence" },
  { key: "fav", label: "Favorites" },
];

function statusMeta(status) {
  return STATUS_META[status] || STATUS_META.gray;
}
function assetLabel(symbol) {
  return getAssetByValue(symbol)?.label || symbol;
}
function isBuy(status) {
  return status === "green" || status === "blue";
}
function isSell(status) {
  return status === "orange" || status === "red";
}
function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function fmtPrice(p) {
  if (p == null) return "—";
  const n = Number(p);
  return n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 4 : 2 });
}

/* عداد أرقام ناعم — نفس القيم المحسوبة، فقط عرض بصري متحرك */
function useCountUp(target, duration = 700) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const isNumeric = typeof target === "number" && !Number.isNaN(target);

  useEffect(() => {
    if (!isNumeric) {
      setDisplay(target);
      return;
    }
    const start = prevRef.current;
    const startTime = performance.now();
    let raf;
    function tick(now) {
      const p = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = start + (target - start) * eased;
      setDisplay(Math.round(val));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevRef.current = target;
      }
    }
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, isNumeric]);

  return display;
}

export default function RadarView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [history, setHistory] = useState([]);
  const [now, setNow] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef(null);
  const clockRef = useRef(null);

  async function loadRadar() {
    try {
      const res = await fetch("/api/radar");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setItems(data.items || []);
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load radar");
    } finally {
      setLoading(false);
    }
  }

  async function loadNotifications() {
    try {
      const res = await fetch("/api/notifications?limit=8");
      const data = await res.json();
      setNotifications((data.items || []).filter((n) => n.type === "qais_radar_signal"));
    } catch {}
  }

  async function loadHistory() {
    try {
      const res = await fetch("/api/radar/history?limit=15");
      const data = await res.json();
      setHistory(data.items || []);
    } catch {}
  }

  async function handleManualRefresh() {
    setRefreshing(true);
    await Promise.all([loadRadar(), loadNotifications(), loadHistory()]);
    setTimeout(() => setRefreshing(false), 500);
  }

  useEffect(() => {
    loadRadar();
    loadNotifications();
    loadHistory();
    // بولينغ خفيف من قاعدة بياناتنا — التحديث الفعلي يصير بالكرون بالخلفية،
    // فمنكفي نحدّث الواجهة كل دقيقة عشان تلحق أي تغيير محفوظ
    pollRef.current = setInterval(() => {
      loadRadar();
      loadNotifications();
      loadHistory();
    }, 60_000);
    clockRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(pollRef.current);
      clearInterval(clockRef.current);
    };
  }, []);

  useEffect(() => {
    if (selected) {
      const fresh = items.find((i) => i.symbol === selected.symbol);
      if (fresh) setSelected(fresh);
    }
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleWatch(symbol, add) {
    await fetch("/api/radar/watchlist", {
      method: add ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
    loadRadar();
  }

  async function toggleFavorite(symbol, e) {
    e?.stopPropagation();
    const it = items.find((i) => i.symbol === symbol);
    const nowFav = !it?.favorite;
    setItems((prev) => prev.map((i) => (i.symbol === symbol ? { ...i, favorite: nowFav } : i)));
    await fetch("/api/radar/favorites", {
      method: nowFav ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
  }

  const filtered = useMemo(() => {
    let list = [...items];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) => i.symbol.toLowerCase().includes(q) || assetLabel(i.symbol).toLowerCase().includes(q));
    }
    if (filter === "buy") list = list.filter((i) => isBuy(i.radar_status));
    else if (filter === "sell") list = list.filter((i) => isSell(i.radar_status));
    else if (filter === "waiting") list = list.filter((i) => i.radar_status === "yellow");
    else if (filter === "high") list = list.filter((i) => (i.radar_score || 0) >= 90);
    else if (filter === "fav") list = list.filter((i) => i.favorite);

    // ترتيب تلقائي: الفرص الأقوى أولاً (score تنازلياً)
    list.sort((a, b) => (b.radar_score || 0) - (a.radar_score || 0));
    return list;
  }, [items, filter, search]);

  const stats = useMemo(() => {
    const buy = items.filter((i) => isBuy(i.radar_status)).length;
    const sell = items.filter((i) => isSell(i.radar_status)).length;
    const waiting = items.filter((i) => i.radar_status === "yellow").length;
    const active = items.filter((i) => isBuy(i.radar_status) || isSell(i.radar_status)).length;
    const scored = items.filter((i) => (i.radar_score || 0) > 0);
    const avgConfidence = scored.length ? Math.round(scored.reduce((s, i) => s + (i.radar_score || 0), 0) / scored.length) : 0;
    const bullScore = items.filter((i) => isBuy(i.radar_status)).reduce((s, i) => s + (i.radar_score || 0), 0);
    const bearScore = items.filter((i) => isSell(i.radar_status)).reduce((s, i) => s + (i.radar_score || 0), 0);
    const totalDir = bullScore + bearScore;
    const sentimentPct = totalDir > 0 ? Math.round((bullScore / totalDir) * 100) : 50;
    let sentimentLabel = "Neutral";
    if (sentimentPct >= 60) sentimentLabel = "Bullish";
    else if (sentimentPct <= 40) sentimentLabel = "Bearish";
    return { buy, sell, waiting, active, avgConfidence, sentimentPct, sentimentLabel };
  }, [items]);

  const opportunities = useMemo(
    () => items.filter((i) => isBuy(i.radar_status) || isSell(i.radar_status)).sort((a, b) => (b.radar_score || 0) - (a.radar_score || 0)),
    [items]
  );

  return (
    <div className="qradar">
      <style jsx>{`
        .qradar {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 22px;
          padding-bottom: 8px;
        }
        .qradar::before {
          content: "";
          position: absolute;
          top: -40px;
          left: 50%;
          transform: translateX(-50%);
          width: min(1100px, 140%);
          height: 520px;
          background: radial-gradient(ellipse at center, rgba(212, 175, 55, 0.1) 0%, rgba(212, 175, 55, 0.035) 38%, transparent 72%);
          pointer-events: none;
          z-index: 0;
        }
        .qradar > :global(*) {
          position: relative;
          z-index: 1;
        }

        @keyframes radarSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes radarSpinReverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.045); opacity: 1; }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.06); }
        }
        @keyframes pulseRing {
          0% { box-shadow: 0 0 0 0 var(--pulse-color); }
          70% { box-shadow: 0 0 0 14px rgba(0, 0, 0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: scale(0.94); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes sweep {
          0% { transform: rotate(0deg); opacity: 0.6; }
          100% { transform: rotate(360deg); opacity: 0.6; }
        }

        .fade-in { animation: fadeIn 0.4s ease both; }
        .fade-scale-in { animation: fadeScaleIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }

        .hero-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 4px;
          padding: 6px 0 2px;
        }
        .hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 11.5px;
          color: ${GOLD_LIGHT};
          background: ${GOLD}14;
          border: 1px solid ${GOLD}3a;
          border-radius: 999px;
          padding: 4px 14px;
          letter-spacing: 0.4px;
        }
        .hero-title {
          margin: 10px 0 2px;
          font-size: clamp(22px, 3vw, 30px);
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #f6f6f6;
          font-family: var(--font-num), var(--font-arabic), sans-serif;
        }
        .hero-sub {
          font-size: 12.5px;
          color: #8a8d94;
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          background: linear-gradient(145deg, ${BG_PANEL_FROM}, ${BG_PANEL_TO});
          border: 1px solid ${GOLD}22;
          border-radius: 16px;
          padding: 12px 16px;
        }
        .search-box {
          position: relative;
          flex: 1;
          min-width: 200px;
          max-width: 320px;
        }
        .search-box input {
          width: 100%;
          background: #0f1114;
          border: 1px solid ${GOLD}2e;
          border-radius: 10px;
          padding: 9px 14px 9px 36px;
          color: #f0f0f0;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          box-sizing: border-box;
        }
        .search-box input:focus {
          border-color: ${GOLD}90;
          box-shadow: 0 0 0 3px ${GOLD}14;
        }
        .toolbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .icon-btn {
          background: transparent;
          border: 1px solid ${GOLD}3a;
          color: ${GOLD_LIGHT};
          border-radius: 10px;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .icon-btn:hover {
          background: ${GOLD}16;
          border-color: ${GOLD}70;
          transform: translateY(-1px);
        }
        .icon-btn.spinning svg {
          animation: radarSpin 0.7s linear infinite;
        }

        .filters-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .filter-chip {
          border-radius: 999px;
          padding: 7px 15px;
          font-size: 12.5px;
          cursor: pointer;
          border: 1px solid #2c2f36;
          background: #14161b;
          color: #9a9da4;
          font-weight: 600;
          transition: all 0.16s ease;
        }
        .filter-chip:hover {
          border-color: ${GOLD}55;
          color: ${GOLD_LIGHT};
          transform: translateY(-1px);
        }
        .filter-chip.active {
          background: linear-gradient(135deg, ${GOLD}2c, ${GOLD}14);
          border-color: ${GOLD};
          color: ${GOLD_LIGHT};
          box-shadow: 0 0 0 1px ${GOLD}30, 0 4px 14px ${GOLD}18;
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        @media (min-width: 640px) {
          .stats-row { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 1100px) {
          .stats-row { grid-template-columns: repeat(6, 1fr); }
        }
        .stat-card {
          background: linear-gradient(150deg, ${BG_PANEL_FROM}, ${BG_PANEL_TO});
          border: 1px solid ${GOLD}20;
          border-radius: 14px;
          padding: 13px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: border-color 0.2s ease, transform 0.2s ease;
        }
        .stat-card:hover {
          border-color: ${GOLD}45;
          transform: translateY(-2px);
        }
        .stat-icon-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .stat-label {
          font-size: 10px;
          color: #83868d;
          letter-spacing: 0.5px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .stat-value {
          font-size: 19px;
          font-weight: 800;
          font-family: var(--font-num), sans-serif;
        }

        .radar-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
        }
        @media (min-width: 1100px) {
          .radar-grid {
            grid-template-columns: 2.05fr 1fr;
            align-items: start;
          }
        }

        .section-card {
          background: linear-gradient(150deg, ${BG_PANEL_FROM}, ${BG_PANEL_TO});
          border: 1px solid ${GOLD}20;
          border-radius: 18px;
          box-shadow: 0 8px 26px rgba(0, 0, 0, 0.32);
          padding: 1.15rem 1.25rem;
        }
        .section-head {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .section-title {
          font-size: 13px;
          font-weight: 700;
          color: #eee;
          letter-spacing: 0.2px;
        }
        .section-count {
          margin-inline-start: auto;
          font-size: 11px;
          color: #777;
          background: #0f1114;
          border: 1px solid #2a2d34;
          border-radius: 999px;
          padding: 2px 9px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 8px;
          padding: 2.4rem 1rem;
          color: #767a82;
        }
        .empty-state-icon {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${GOLD}0e;
          border: 1px solid ${GOLD}28;
          color: ${GOLD_DIM};
          margin-bottom: 4px;
        }
        .empty-state-title {
          font-size: 13px;
          font-weight: 700;
          color: #aaa;
        }
        .empty-state-sub {
          font-size: 12px;
          color: #6d7077;
          max-width: 280px;
        }

        .node-btn:hover .node-tooltip {
          opacity: 1;
          transform: translate(-50%, -6px);
          pointer-events: auto;
        }

        .side-col {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        @media (min-width: 1100px) {
          .side-col {
            position: sticky;
            top: 12px;
          }
        }
      `}</style>

      {/* ---------- Hero: Market Radar ---------- */}
      <div className="hero-wrap fade-in">
        <span className="hero-eyebrow">⚡ Powered by Qais SK Engine</span>
        <h2 className="hero-title">TRADING RADAR</h2>
        <span className="hero-sub">{now.toLocaleTimeString("en-US", { hour12: false })} · Live scan across your watchlist</span>
      </div>

      <div className="fade-scale-in" style={{ display: "flex", justifyContent: "center", padding: "6px 0 4px" }}>
        {loading ? (
          <HeroEmptyState icon={<RadarIcon size={22} />} title="Scanning the markets…" sub="Loading your radar data" />
        ) : filtered.length === 0 ? (
          <HeroEmptyState
            icon={<RadarIcon size={22} />}
            title={items.length === 0 ? "Your radar is empty" : "No matches for this filter"}
            sub={items.length === 0 ? "Tap the settings icon to add symbols to your watchlist." : "Try a different filter or clear your search."}
          />
        ) : (
          <RadarCircle items={filtered} selected={selected} onSelect={setSelected} sentiment={stats} />
        )}
      </div>

      {error && (
        <div className="section-card fade-in" style={{ padding: "0.8rem 1rem", color: "#F6465D", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ---------- Stats ---------- */}
      <StatsBar stats={stats} />

      {/* ---------- Toolbar: search / refresh / settings / filters ---------- */}
      <div className="toolbar fade-in">
        <div className="search-box">
          <Search size={15} style={{ position: "absolute", top: 10, insetInlineStart: 12, color: "#777" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search symbol…" />
        </div>
        <div className="filters-row" style={{ flex: 1 }}>
          {FILTERS.map((f) => (
            <button key={f.key} className={`filter-chip${filter === f.key ? " active" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          <button className={`icon-btn${refreshing ? " spinning" : ""}`} onClick={handleManualRefresh} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button className="icon-btn" onClick={() => setManageOpen(true)} title="Manage watched assets">
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* ---------- Selected symbol panel + below-radar sections ---------- */}
      <div className="radar-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <LiveOpportunitiesTable items={opportunities} onSelect={setSelected} />
          <SignalHistoryTable history={history} />
        </div>

        <div className="side-col">
          <DetailPanel item={selected} onToggleFavorite={toggleFavorite} />
          <NotificationsPanel notifications={notifications} />
        </div>
      </div>

      {manageOpen && (
        <ManageWatchlist
          watched={items.map((i) => i.symbol)}
          onToggle={toggleWatch}
          onClose={() => {
            setManageOpen(false);
            loadRadar();
          }}
        />
      )}
    </div>
  );
}

const cardStyle = {
  background: `linear-gradient(145deg, ${BG_PANEL_FROM}, ${BG_PANEL_TO})`,
  border: `1px solid ${GOLD}26`,
  borderRadius: 18,
  boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
};

/* -------------------------------- Hero empty state -------------------------------- */
function HeroEmptyState({ icon, title, sub }) {
  return (
    <div
      style={{
        ...cardStyle,
        width: 380,
        maxWidth: "100%",
        aspectRatio: "1 / 1",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 10,
        padding: "2rem",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: `${GOLD}0e`,
          border: `1px solid ${GOLD}30`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: GOLD_LIGHT,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#ddd" }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "#777", maxWidth: 240 }}>{sub}</div>
    </div>
  );
}

/* -------------------------------- Stats bar -------------------------------- */
function StatCard({ icon, label, value, color, animate }) {
  const animated = useCountUp(animate ? value : null);
  const display = animate ? animated : value;
  return (
    <div className="stat-card fade-in">
      <div className="stat-icon-row">
        <span className="stat-label">{label}</span>
        <span style={{ color, opacity: 0.85 }}>{icon}</span>
      </div>
      <div className="stat-value" style={{ color }}>
        {display}
      </div>
    </div>
  );
}

function StatsBar({ stats }) {
  const sentimentColor = stats.sentimentLabel === "Bullish" ? "#02C076" : stats.sentimentLabel === "Bearish" ? "#F6465D" : "#eab308";
  return (
    <div className="stats-row">
      <StatCard icon={<TrendingUp size={15} />} label="Buy Signals" value={stats.buy} color="#02C076" animate />
      <StatCard icon={<TrendingDown size={15} />} label="Sell Signals" value={stats.sell} color="#F6465D" animate />
      <StatCard icon={<Clock size={15} />} label="Waiting" value={stats.waiting} color="#eab308" animate />
      <StatCard icon={<Target size={15} />} label="Active Opportunities" value={stats.active} color={GOLD_LIGHT} animate />
      <StatCard icon={<Gauge size={15} />} label="Avg Confidence" value={stats.avgConfidence} color="#3B82F6" animate />
      <div className="stat-card fade-in">
        <div className="stat-icon-row">
          <span className="stat-label">Market Sentiment</span>
          <span style={{ color: sentimentColor, opacity: 0.85 }}>
            <Activity size={15} />
          </span>
        </div>
        <div className="stat-value" style={{ color: sentimentColor, fontSize: 16 }}>
          {stats.sentimentLabel}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Radar circle -------------------------------- */
function RadarCircle({ items, selected, onSelect, sentiment }) {
  const size = 440;
  const radius = 172;
  const center = size / 2;
  const bullish = sentiment.sentimentPct >= 50;

  return (
    <div style={{ position: "relative", width: size, height: size, maxWidth: "100%" }}>
      {/* توهج خلفي ناعم حول الرادار */}
      <div
        style={{
          position: "absolute",
          inset: -30,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${bullish ? "rgba(2,192,118,0.16)" : "rgba(246,70,93,0.14)"} 0%, transparent 68%)`,
          animation: "glowPulse 5s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      {/* حلقات دوّارة خلفية للإحساس بالحيوية */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: `1px dashed ${GOLD}20`,
          animation: "radarSpin 60s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: center - radius * 0.66,
          left: center - radius * 0.66,
          width: radius * 1.32,
          height: radius * 1.32,
          borderRadius: "50%",
          border: `1px solid ${GOLD}18`,
          animation: "radarSpinReverse 80s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: center - radius * 0.33,
          left: center - radius * 0.33,
          width: radius * 0.66,
          height: radius * 0.66,
          borderRadius: "50%",
          border: `1px solid ${GOLD}14`,
        }}
      />
      {/* شعاع ماسح خفيف */}
      <div
        style={{
          position: "absolute",
          top: center,
          left: center,
          width: radius,
          height: 1.5,
          background: `linear-gradient(90deg, ${GOLD}55, transparent)`,
          transformOrigin: "0 0",
          animation: "sweep 8s linear infinite",
        }}
      />

      {/* المركز — Market Sentiment الحي */}
      <div
        style={{
          position: "absolute",
          top: center - 68,
          left: center - 68,
          width: 136,
          height: 136,
          borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, #262a31, #14161b)",
          border: `1.5px solid ${bullish ? "#02C07688" : "#F6465D88"}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          boxShadow: `0 0 46px ${bullish ? "rgba(2,192,118,0.32)" : "rgba(246,70,93,0.28)"}`,
          animation: "breathe 4s ease-in-out infinite",
          zIndex: 2,
        }}
      >
        <div style={{ fontSize: 9.5, color: "#888", letterSpacing: 0.5 }}>MARKET SENTIMENT</div>
        <div style={{ fontSize: 21, fontWeight: 800, color: bullish ? "#02C076" : "#F6465D", marginTop: 2 }}>
          {sentiment.sentimentLabel.toUpperCase()}
        </div>
        <div style={{ fontSize: 12.5, color: "#ccc", marginTop: 1 }}>{sentiment.sentimentPct}%</div>
      </div>

      {items.map((it, i) => (
        <RadarNode
          key={it.symbol}
          item={it}
          angle={(2 * Math.PI * i) / items.length - Math.PI / 2}
          radius={radius}
          center={center}
          isSelected={selected?.symbol === it.symbol}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function RadarNode({ item, angle, radius, center, isSelected, onSelect }) {
  const x = center + radius * Math.cos(angle);
  const y = center + radius * Math.sin(angle);
  const meta = statusMeta(item.radar_status);
  const score = item.radar_score || 0;
  const R = 27;
  const circumference = 2 * Math.PI * R;
  const dash = (Math.min(100, Math.max(0, score)) / 100) * circumference;
  const strong = item.radar_status === "green" || item.radar_status === "red";

  return (
    <button
      className="node-btn"
      onClick={() => onSelect(item)}
      style={{
        position: "absolute",
        top: y - 33,
        left: x - 33,
        width: 66,
        height: 66,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        zIndex: isSelected ? 5 : 3,
        "--pulse-color": meta.glow,
        animation: strong ? "pulseRing 2.2s ease-out infinite" : "none",
        borderRadius: "50%",
        transition: "transform .15s ease",
      }}
    >
      <svg width="66" height="66" viewBox="0 0 66 66" style={{ position: "absolute", top: 0, left: 0 }}>
        <circle cx="33" cy="33" r={R} fill="#14161B" stroke="#2a2d34" strokeWidth="3" />
        <circle
          cx="33"
          cy="33"
          r={R}
          fill="none"
          stroke={meta.color}
          strokeWidth="3"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 33 33)"
          style={{ transition: "stroke-dasharray .6s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 66,
          height: 66,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: isSelected ? `1.5px solid ${GOLD_LIGHT}` : "none",
          borderRadius: "50%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {isBuy(item.radar_status) && <TrendingUp size={10} color={meta.color} />}
          {isSell(item.radar_status) && <TrendingDown size={10} color={meta.color} />}
          {!isBuy(item.radar_status) && !isSell(item.radar_status) && <Minus size={10} color={meta.color} />}
          <span style={{ fontSize: 10.5, color: "#eee", fontWeight: 700 }}>{item.symbol}</span>
        </div>
        <span style={{ fontSize: 9.5, color: meta.color, fontWeight: 700, marginTop: 1 }}>
          {score > 0 ? `${score}%` : "—"}
        </span>
      </div>

      {/* Tooltip سريع عند الهوفر (ديسكتوب) */}
      <div
        className="node-tooltip"
        style={{
          position: "absolute",
          bottom: "calc(100% + 6px)",
          left: "50%",
          transform: "translate(-50%, 0)",
          background: "#0c0d10",
          border: `1px solid ${meta.color}66`,
          borderRadius: 10,
          padding: "8px 10px",
          fontSize: 11,
          color: "#eee",
          whiteSpace: "nowrap",
          opacity: 0,
          transition: "all .15s ease",
          pointerEvents: "none",
          zIndex: 20,
          textAlign: "left",
        }}
      >
        <div style={{ fontWeight: 700, color: meta.color }}>{meta.label}</div>
        <div style={{ color: "#999" }}>{assetLabel(item.symbol)}</div>
        {item.entry_status && <div style={{ color: "#999" }}>Entry: {item.entry_status}</div>}
      </div>
    </button>
  );
}

/* -------------------------------- Detail panel (Selected Symbol) -------------------------------- */
function QuickStat({ label, value, color }) {
  return (
    <div style={{ background: "#0f1114", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontSize: 9.5, color: "#767a82", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: color || "#e8e8e8", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function DetailPanel({ item, onToggleFavorite }) {
  if (!item) {
    return (
      <div className="section-card fade-in">
        <div className="empty-state" style={{ padding: "1.6rem 0.5rem" }}>
          <div className="empty-state-icon">
            <RadarIcon size={20} />
          </div>
          <div className="empty-state-title">No symbol selected</div>
          <div className="empty-state-sub">Tap any node on the radar to see its full signal breakdown here.</div>
        </div>
      </div>
    );
  }
  const meta = statusMeta(item.radar_status);
  const trendLabel = item.direction === "up" ? "Bullish" : item.direction === "down" ? "Bearish" : "—";
  const trendColor = item.direction === "up" ? "#02C076" : item.direction === "down" ? "#F6465D" : "#aaa";

  const rows = [
    ["HTF Trend", item.htf_trend === "up" ? "Bullish" : item.htf_trend === "down" ? "Bearish" : "—"],
    ["Market Structure", item.market_structure || "—"],
    ["BOS", item.bos_status || "—"],
    ["CHOCH", item.choch_status || "—"],
    ["Order Block", item.entry_status || "—"],
    ["Fair Value Gap", item.fvg_status || "—"],
    ["Liquidity", item.liquidity_status || "—"],
    ["Premium / Discount", item.premium_discount || "—"],
    ["Session", item.session_label || "—"],
    ["Risk / Reward", item.risk_reward ? `1 : ${item.risk_reward}` : "—"],
  ];

  return (
    <div className="section-card fade-in" style={{ animation: "fadeIn .25s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#f5f5f5" }}>{item.symbol}</span>
            <button onClick={(e) => onToggleFavorite(item.symbol, e)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <Star size={16} color={item.favorite ? GOLD : "#555"} fill={item.favorite ? GOLD : "none"} />
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{assetLabel(item.symbol)}</div>
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: meta.color,
            background: `${meta.color}18`,
            border: `1px solid ${meta.color}55`,
            borderRadius: 999,
            padding: "4px 10px",
            whiteSpace: "nowrap",
          }}
        >
          {item.radar_signal_label || meta.label}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "#888" }}>Price</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0" }}>{fmtPrice(item.price)}</div>
        </div>
        <ConfidenceRing score={item.radar_score || 0} color={meta.color} />
      </div>

      {/* لمحة سريعة: Selected Symbol / Confidence / Trend / Timeframe / Last Update / Strategy Status */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <QuickStat label="Confidence" value={item.radar_score != null ? `${item.radar_score}%` : "—"} color={meta.color} />
        <QuickStat label="Trend" value={trendLabel} color={trendColor} />
        <QuickStat label="Timeframe" value={item.timeframe || "—"} />
        <QuickStat label="Last Update" value={timeAgo(item.updated_at)} />
        <QuickStat label="Strategy Status" value={item.radar_signal_strength || item.entry_status || "—"} />
        <QuickStat label="Signal" value={item.radar_signal_label || meta.label} color={meta.color} />
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ background: "#0f1114", borderRadius: 9, padding: "7px 9px" }}>
            <div style={{ fontSize: 10, color: "#767a82" }}>{label}</div>
            <div style={{ fontSize: 12.5, color: "#e8e8e8", fontWeight: 600, marginTop: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {item.why?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>
            Why {isBuy(item.radar_status) ? "Buy" : isSell(item.radar_status) ? "Sell" : "Waiting"}?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {item.why.map((w) => (
              <div key={w} style={{ fontSize: 12.5, color: "#ddd", display: "flex", gap: 6 }}>
                <span style={{ color: "#02C076" }}>✔</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <a
          href={`/dashboard?tab=replay&asset=${encodeURIComponent(item.symbol)}`}
          style={{
            flex: 1,
            textAlign: "center",
            background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
            color: "#181A20",
            fontWeight: 700,
            borderRadius: 10,
            padding: "10px 0",
            textDecoration: "none",
            fontSize: 13.5,
          }}
        >
          Open Chart
        </a>
        <a
          href={`/dashboard?tab=replay&asset=${encodeURIComponent(item.symbol)}&mode=replay`}
          style={{
            flex: 1,
            textAlign: "center",
            background: "transparent",
            border: `1px solid ${GOLD}55`,
            color: GOLD_LIGHT,
            fontWeight: 700,
            borderRadius: 10,
            padding: "10px 0",
            textDecoration: "none",
            fontSize: 13.5,
          }}
        >
          Replay
        </a>
      </div>
    </div>
  );
}

function ConfidenceRing({ score, color }) {
  const R = 26;
  const circumference = 2 * Math.PI * R;
  const dash = (Math.min(100, Math.max(0, score)) / 100) * circumference;
  return (
    <div style={{ position: "relative", width: 64, height: 64 }}>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={R} fill="none" stroke="#2a2d34" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 800,
          color,
        }}
      >
        {score}%
      </div>
    </div>
  );
}

/* -------------------------------- Live opportunities -------------------------------- */
function LiveOpportunitiesTable({ items, onSelect }) {
  return (
    <div className="section-card fade-in">
      <div className="section-head">
        <Target size={14} color={GOLD_LIGHT} />
        <span className="section-title">Live Opportunities</span>
        {items.length > 0 && <span className="section-count">{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Target size={20} />
          </div>
          <div className="empty-state-title">No active setups right now</div>
          <div className="empty-state-sub">Qualified buy/sell opportunities will appear here as soon as the engine finds one.</div>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: "#777", textAlign: "left" }}>
                {["Symbol", "Direction", "Confidence", "RR", "Status"].map((h) => (
                  <th key={h} style={{ padding: "6px 8px", fontWeight: 500, fontSize: 11 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const meta = statusMeta(it.radar_status);
                return (
                  <tr key={it.symbol} onClick={() => onSelect(it)} className="row-hover" style={{ cursor: "pointer", borderTop: "1px solid #23262c" }}>
                    <td style={{ padding: "8px", color: "#eee", fontWeight: 600 }}>{it.symbol}</td>
                    <td style={{ padding: "8px", color: meta.color, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                      {isBuy(it.radar_status) ? <ArrowUpRight size={13} /> : isSell(it.radar_status) ? <ArrowDownRight size={13} /> : null}
                      {isBuy(it.radar_status) ? "BUY" : isSell(it.radar_status) ? "SELL" : "—"}
                    </td>
                    <td style={{ padding: "8px", color: "#ddd" }}>{it.radar_score}%</td>
                    <td style={{ padding: "8px", color: "#ddd" }}>{it.risk_reward ? `1:${it.risk_reward}` : "—"}</td>
                    <td style={{ padding: "8px", color: "#ddd" }}>{it.entry_status || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Signal history -------------------------------- */
function SignalHistoryTable({ history }) {
  return (
    <div className="section-card fade-in">
      <div className="section-head">
        <History size={14} color={GOLD_LIGHT} />
        <span className="section-title">Signal History</span>
        {history.length > 0 && <span className="section-count">{history.length}</span>}
      </div>
      {history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <History size={20} />
          </div>
          <div className="empty-state-title">No closed signals yet</div>
          <div className="empty-state-sub">Completed trade signals will be logged here once a setup closes.</div>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: "#777", textAlign: "left" }}>
                {["Symbol", "Direction", "Entry", "Exit", "Result", "PnL %"].map((h) => (
                  <th key={h} style={{ padding: "6px 8px", fontWeight: 500, fontSize: 11 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((h) => {
                const win = h.status === "win";
                const open = h.status === "open";
                const resultColor = open ? "#eab308" : win ? "#02C076" : "#F6465D";
                return (
                  <tr key={h.id} style={{ borderTop: "1px solid #23262c" }}>
                    <td style={{ padding: "8px", color: "#eee", fontWeight: 600 }}>{h.symbol}</td>
                    <td style={{ padding: "8px", color: h.direction === "up" ? "#02C076" : "#F6465D", fontWeight: 700 }}>
                      {h.direction === "up" ? "BUY" : "SELL"}
                    </td>
                    <td style={{ padding: "8px", color: "#ddd" }}>{new Date(h.entry_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td style={{ padding: "8px", color: "#ddd" }}>
                      {h.exit_time ? new Date(h.exit_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td style={{ padding: "8px", color: resultColor, fontWeight: 700 }}>{open ? "Open" : win ? "Win" : "Loss"}</td>
                    <td style={{ padding: "8px", color: h.pnl_pct > 0 ? "#02C076" : h.pnl_pct < 0 ? "#F6465D" : "#ddd" }}>
                      {h.pnl_pct != null ? `${h.pnl_pct > 0 ? "+" : ""}${h.pnl_pct}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Recent alerts -------------------------------- */
function NotificationsPanel({ notifications }) {
  return (
    <div className="section-card fade-in">
      <div className="section-head">
        <Bell size={14} color={GOLD_LIGHT} />
        <span className="section-title">Recent Alerts</span>
        {notifications.length > 0 && <span className="section-count">{notifications.length}</span>}
      </div>
      {notifications.length === 0 ? (
        <div className="empty-state" style={{ padding: "1.6rem 0.5rem" }}>
          <div className="empty-state-icon">
            <BellOff size={18} />
          </div>
          <div className="empty-state-title">No new high-confidence signals</div>
          <div className="empty-state-sub">You'll be alerted here the moment a strong opportunity appears.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifications.map((n) => (
            <a
              key={n.id}
              href={n.link || "#"}
              style={{
                display: "block",
                background: "#0f1114",
                border: `1px solid ${GOLD}22`,
                borderRadius: 10,
                padding: "9px 11px",
                textDecoration: "none",
                transition: "border-color .15s ease, transform .15s ease",
              }}
            >
              <div style={{ fontSize: 12.5, color: "#eee", fontWeight: 700 }}>{n.title}</div>
              <div style={{ fontSize: 11.5, color: "#999", marginTop: 2 }}>{n.message}</div>
              <div style={{ fontSize: 10.5, color: "#666", marginTop: 3 }}>{timeAgo(n.created_at)}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Manage watchlist -------------------------------- */
function ManageWatchlist({ watched, onToggle, onClose }) {
  const watchedSet = new Set(watched);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "1rem",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ ...cardStyle, padding: "1.4rem", width: 420, maxWidth: "100%", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0" }}>Watched assets on your radar</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>
        {ASSETS.map((group) => (
          <div key={group.group} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{group.group}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {group.items
                .filter((i) => i.yahoo)
                .map((asset) => {
                  const on = watchedSet.has(asset.v);
                  return (
                    <button
                      key={asset.v}
                      onClick={() => onToggle(asset.v, !on)}
                      style={{
                        background: on ? `${GOLD}22` : "#181A20",
                        border: `1px solid ${on ? GOLD : "#333"}`,
                        color: on ? GOLD_LIGHT : "#aaa",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontSize: 12.5,
                        cursor: "pointer",
                      }}
                    >
                      {on ? "✓ " : "+ "}
                      {asset.label}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
