"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Star,
  Settings,
  Bell,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
} from "lucide-react";
import { ASSETS, getAssetByValue } from "@/lib/assets";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2D57E";

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
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <style jsx>{`
        @keyframes radarSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes radarSpinReverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }
        @keyframes breathe {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
        }
        @keyframes pulseRing {
          0% {
            box-shadow: 0 0 0 0 var(--pulse-color);
          }
          70% {
            box-shadow: 0 0 0 14px rgba(0, 0, 0, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes sweep {
          0% {
            transform: rotate(0deg);
            opacity: 0.6;
          }
          100% {
            transform: rotate(360deg);
            opacity: 0.6;
          }
        }
        .radar-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
        }
        @media (min-width: 1100px) {
          .radar-grid {
            grid-template-columns: 2.1fr 1fr;
            align-items: start;
          }
        }
        .stats-row {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        @media (min-width: 720px) {
          .stats-row {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (min-width: 1100px) {
          .stats-row {
            grid-template-columns: repeat(6, 1fr);
          }
        }
        .node-btn:hover .node-tooltip {
          opacity: 1;
          transform: translate(-50%, -6px);
          pointer-events: auto;
        }
      `}</style>

      <RadarHeader
        search={search}
        setSearch={setSearch}
        onManage={() => setManageOpen(true)}
        onRefresh={loadRadar}
        now={now}
      />

      {error && (
        <div style={{ ...cardStyle, padding: "0.8rem 1rem", color: "#F6465D", fontSize: 13 }}>{error}</div>
      )}

      <FilterChips filter={filter} setFilter={setFilter} />

      <StatsBar stats={stats} />

      <div className="radar-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ ...cardStyle, padding: "1.6rem", display: "flex", justifyContent: "center" }}>
            {loading ? (
              <div style={{ color: "#888", padding: "3rem 0" }}>Loading radar…</div>
            ) : filtered.length === 0 ? (
              <div style={{ color: "#888", padding: "3rem 0", textAlign: "center", maxWidth: 320 }}>
                {items.length === 0
                  ? "No assets on your watchlist yet — press the gear icon to add symbols."
                  : "No symbols match this filter/search."}
              </div>
            ) : (
              <RadarCircle items={filtered} selected={selected} onSelect={setSelected} sentiment={stats} />
            )}
          </div>

          <LiveOpportunitiesTable items={opportunities} onSelect={setSelected} />
          <SignalHistoryTable history={history} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, position: "sticky", top: 12 }}>
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
  background: "linear-gradient(145deg, #22252B, #181A20)",
  border: `1px solid ${GOLD}26`,
  borderRadius: 18,
  boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
};

/* -------------------------------- Header -------------------------------- */
function RadarHeader({ search, setSearch, onManage, onRefresh, now }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 21, color: "#f5f5f5", letterSpacing: 0.3 }}>TRADING RADAR</h2>
          <span
            style={{
              fontSize: 11.5,
              color: GOLD_LIGHT,
              background: `${GOLD}18`,
              border: `1px solid ${GOLD}40`,
              borderRadius: 999,
              padding: "3px 10px",
              whiteSpace: "nowrap",
            }}
          >
            ⚡ Powered by Qais SK Engine
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: "#888", marginTop: 5 }}>
          {now.toLocaleTimeString("en-US", { hour12: false })} · Live scan across your watchlist
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <Search size={15} style={{ position: "absolute", top: 9, left: 12, color: "#777" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search any symbol…"
            style={{
              background: "#14161B",
              border: `1px solid ${GOLD}30`,
              borderRadius: 10,
              padding: "8px 12px 8px 32px",
              color: "#f0f0f0",
              fontSize: 13,
              width: 190,
              outline: "none",
            }}
          />
        </div>
        <button onClick={onRefresh} style={iconBtnStyle} title="Refresh">
          <RefreshCw size={15} />
        </button>
        <button onClick={onManage} style={iconBtnStyle} title="Manage watched assets">
          <Settings size={15} />
        </button>
      </div>
    </div>
  );
}

const iconBtnStyle = {
  background: "transparent",
  border: `1px solid ${GOLD}40`,
  color: GOLD_LIGHT,
  borderRadius: 10,
  padding: "8px 10px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
};

/* ------------------------------ Filter chips ------------------------------ */
function FilterChips({ filter, setFilter }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {FILTERS.map((f) => {
        const active = filter === f.key;
        return (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              background: active ? `${GOLD}22` : "#181A20",
              border: `1px solid ${active ? GOLD : "#2c2f36"}`,
              color: active ? GOLD_LIGHT : "#aaa",
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 12.5,
              cursor: "pointer",
              fontWeight: active ? 700 : 500,
              transition: "all .15s ease",
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------- Stats bar -------------------------------- */
function StatsBar({ stats }) {
  const items = [
    { label: "BUY SIGNALS", value: stats.buy, color: "#02C076" },
    { label: "SELL SIGNALS", value: stats.sell, color: "#F6465D" },
    { label: "WAITING", value: stats.waiting, color: "#eab308" },
    { label: "ACTIVE OPPORTUNITIES", value: stats.active, color: GOLD_LIGHT },
    { label: "AVG CONFIDENCE", value: `${stats.avgConfidence}%`, color: "#3B82F6" },
    { label: "MARKET SENTIMENT", value: stats.sentimentLabel, color: stats.sentimentLabel === "Bullish" ? "#02C076" : stats.sentimentLabel === "Bearish" ? "#F6465D" : "#eab308" },
  ];
  return (
    <div className="stats-row">
      {items.map((s) => (
        <div key={s.label} style={{ ...cardStyle, padding: "10px 14px" }}>
          <div style={{ fontSize: 10.5, color: "#888", letterSpacing: 0.4 }}>{s.label}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: s.color, marginTop: 3 }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Radar circle -------------------------------- */
function RadarCircle({ items, selected, onSelect, sentiment }) {
  const size = 380;
  const radius = 148;
  const center = size / 2;
  const bullish = sentiment.sentimentPct >= 50;

  return (
    <div style={{ position: "relative", width: size, height: size, maxWidth: "100%" }}>
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
          top: center - 62,
          left: center - 62,
          width: 124,
          height: 124,
          borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, #23262d, #14161b)",
          border: `1.5px solid ${bullish ? "#02C07677" : "#F6465D77"}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          boxShadow: `0 0 40px ${bullish ? "rgba(2,192,118,0.28)" : "rgba(246,70,93,0.25)"}`,
          animation: "breathe 4s ease-in-out infinite",
          zIndex: 2,
        }}
      >
        <div style={{ fontSize: 9.5, color: "#888", letterSpacing: 0.5 }}>MARKET SENTIMENT</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: bullish ? "#02C076" : "#F6465D", marginTop: 2 }}>
          {sentiment.sentimentLabel.toUpperCase()}
        </div>
        <div style={{ fontSize: 12, color: "#ccc", marginTop: 1 }}>{sentiment.sentimentPct}%</div>
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

/* -------------------------------- Detail panel -------------------------------- */
function DetailPanel({ item, onToggleFavorite }) {
  if (!item) {
    return (
      <div style={{ ...cardStyle, padding: "1.6rem", textAlign: "center", color: "#777", fontSize: 13 }}>
        Select a symbol on the radar to see the full signal breakdown.
      </div>
    );
  }
  const meta = statusMeta(item.radar_status);
  const rows = [
    ["Trend", item.direction === "up" ? "Bullish" : item.direction === "down" ? "Bearish" : "—"],
    ["HTF Trend", item.htf_trend === "up" ? "Bullish" : item.htf_trend === "down" ? "Bearish" : "—"],
    ["Market Structure", item.market_structure || "—"],
    ["BOS", item.bos_status || "—"],
    ["CHOCH", item.choch_status || "—"],
    ["Order Block Status", item.entry_status || "—"],
    ["Fair Value Gap", item.fvg_status || "—"],
    ["Liquidity Status", item.liquidity_status || "—"],
    ["Premium / Discount", item.premium_discount || "—"],
    ["Current Session", item.session_label || "—"],
    ["Entry Status", item.entry_status || "—"],
    ["Risk Reward", item.risk_reward ? `1 : ${item.risk_reward}` : "—"],
    ["Confidence Score", item.radar_score != null ? `${item.radar_score}%` : "—"],
    ["Signal Strength", item.radar_signal_strength || "—"],
    ["Last Update", timeAgo(item.updated_at)],
  ];

  return (
    <div style={{ ...cardStyle, padding: "1.4rem", animation: "fadeIn .25s ease" }}>
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

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ background: "#14161B", borderRadius: 9, padding: "7px 9px" }}>
            <div style={{ fontSize: 10, color: "#777" }}>{label}</div>
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
    <div style={{ ...cardStyle, padding: "1.1rem 1.2rem" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#eee", marginBottom: 10 }}>Live Opportunities</div>
      {items.length === 0 ? (
        <div style={{ color: "#777", fontSize: 12.5, padding: "8px 0" }}>No active setups right now.</div>
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
                  <tr
                    key={it.symbol}
                    onClick={() => onSelect(it)}
                    style={{ cursor: "pointer", borderTop: "1px solid #23262c" }}
                  >
                    <td style={{ padding: "8px", color: "#eee", fontWeight: 600 }}>{it.symbol}</td>
                    <td style={{ padding: "8px", color: meta.color, fontWeight: 700 }}>
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
    <div style={{ ...cardStyle, padding: "1.1rem 1.2rem" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#eee", marginBottom: 10 }}>Signal History</div>
      {history.length === 0 ? (
        <div style={{ color: "#777", fontSize: 12.5, padding: "8px 0" }}>No closed signals yet.</div>
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

/* -------------------------------- Notifications -------------------------------- */
function NotificationsPanel({ notifications }) {
  return (
    <div style={{ ...cardStyle, padding: "1.2rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Bell size={14} color={GOLD_LIGHT} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#eee" }}>New Opportunities</div>
      </div>
      {notifications.length === 0 ? (
        <div style={{ color: "#777", fontSize: 12.5 }}>No new high-confidence signals yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifications.map((n) => (
            <a
              key={n.id}
              href={n.link || "#"}
              style={{
                display: "block",
                background: "#14161B",
                border: `1px solid ${GOLD}22`,
                borderRadius: 10,
                padding: "9px 11px",
                textDecoration: "none",
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
