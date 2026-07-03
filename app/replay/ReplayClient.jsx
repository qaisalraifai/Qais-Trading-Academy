"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { ASSETS, getAssetByValue, INTERVAL_MAP, INTERVAL_MS } from "@/lib/assets";
import { createClient } from "@/lib/supabase-client";

const GOLD = "#C9A24B";
const GOLD_LIGHT = "#E8C468";
const GREEN = "#10b981";
const RED = "#ef4444";

const INTERVALS = [
  { value: "1m", label: "1 دقيقة" },
  { value: "5m", label: "5 دقايق" },
  { value: "15m", label: "15 دقيقة" },
  { value: "1h", label: "ساعة" },
  { value: "4h", label: "4 ساعات" },
  { value: "1d", label: "يومي" },
];

const SPEEDS = [
  { value: 1500, label: "بطيء" },
  { value: 700, label: "متوسط" },
  { value: 300, label: "سريع" },
];

const CONTEXT_BARS = 60;
const MAX_BARS_OPTIONS = [
  { value: 1000, label: "1000 شمعة" },
  { value: 3000, label: "3000 شمعة" },
  { value: 5000, label: "5000 شمعة (الأقصى)" },
];

/* تنسيق العداد: HH:MM:SS لو الفريم ساعة أو أكتر، وإلا MM:SS */
function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* حدود الشمعة الحالية محسوبة من ساعة الجهاز مباشرة (مش من آخر شمعة رجعها الـ API)
   هيك العداد صحيح دايماً حتى لو مصدر البيانات رجّع شمعة مقفولة كآخر شمعة */
function getCurrentBarWindow(interval) {
  const stepMs = INTERVAL_MS[interval] || 60000;
  const now = Date.now();
  const start = Math.floor(now / stepMs) * stepMs;
  return { start, end: start + stepMs, stepMs, now };
}

/* تصفية أي شمعة فاسدة (وقت/سعر مش رقمي أو تكرار بنفس الوقت) قبل ما توصل لمكتبة الشارت -
   مكتبة lightweight-charts بترفض هيك بيانات وبتعمل throw exception يكسر الصفحة كلها،
   فهاي طبقة حماية إضافية جوا الواجهة نفسها (فوق التصفية اللي صارت بالسيرفر) */
function sanitizeCandles(list) {
  if (!Array.isArray(list)) return [];
  const clean = list.filter(
    (c) =>
      c &&
      Number.isFinite(c.time) &&
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close)
  );
  clean.sort((a, b) => a.time - b.time);
  return clean.filter((c, i) => i === 0 || c.time !== clean[i - 1].time);
}

/* ===================== إعدادات ألوان الشارت (تنحفظ محلياً بالمتصفح) ===================== */
const CHART_SETTINGS_KEY = "qta_chart_settings_v1";
const DEFAULT_CHART_SETTINGS = { bg: "#0d0d0a", up: GREEN, down: RED };
function loadChartSettings() {
  if (typeof window === "undefined") return DEFAULT_CHART_SETTINGS;
  try {
    const raw = window.localStorage.getItem(CHART_SETTINGS_KEY);
    if (!raw) return DEFAULT_CHART_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CHART_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_CHART_SETTINGS;
  }
}
function saveChartSettings(settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHART_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

/* تحويل صفقة الريبلاي لصف جدول trades (نفس شكل أداة الباك تيست بالظبط عشان تظهر فيها وبلوحة التحكم) */
function tradeToRow(trade, userId) {
  return {
    user_id: userId,
    asset: trade.asset,
    trade_date: trade.date,
    direction: trade.direction,
    lot: trade.lot,
    entry: trade.entry,
    sl: trade.sl,
    tp: trade.tp,
    result: trade.result,
    setup: trade.setup || null,
    reason: trade.reason || null,
    risk_amount: trade.riskAmount,
    reward_amount: trade.rewardAmount,
    rr: trade.rr,
    risk_percent: trade.riskPercent,
    is_live: trade.isLive,
    price_source: trade.priceSource || null,
    source_symbol: trade.sourceSymbol || null,
  };
}

/* ===================== شارت عشوائي (تدريب أعمى) ===================== */
function generateRandomCandles(count, interval) {
  const stepMs = INTERVAL_MS[interval] || 15 * 60 * 1000;
  let price = 100 + Math.random() * 900;
  const now = Math.floor(Date.now() / 1000);
  const stepSec = Math.floor(stepMs / 1000);
  const startTime = now - count * stepSec;
  const out = [];
  for (let i = 0; i < count; i++) {
    const vol = price * 0.004;
    const open = price;
    const drift = (Math.random() - 0.5) * vol * 2;
    const close = Math.max(0.01, open + drift);
    const high = Math.max(open, close) + Math.random() * vol;
    const low = Math.min(open, close) - Math.random() * vol;
    out.push({ time: startTime + i * stepSec, open, high, low: Math.max(0.01, low), close });
    price = close;
  }
  return out;
}

/* ===================== أيقونات شريط الرسم (SVG نظيفة بستايل تريدنغ فيو) ===================== */
function ToolIcon({ id }) {
  const common = { width: 23, height: 23, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (id) {
    case "cursor":
      return (<svg {...common}><path d="M5 3l14 6.5-6 1.7L11 18 5 3z" fill="currentColor" stroke="none" /></svg>);
    case "trendline":
      return (<svg {...common}><circle cx="5" cy="19" r="1.8" /><circle cx="19" cy="5" r="1.8" /><line x1="6.3" y1="17.7" x2="17.7" y2="6.3" /></svg>);
    case "ray":
      return (<svg {...common}><circle cx="5" cy="19" r="1.8" fill="currentColor" stroke="none" /><line x1="6.3" y1="17.7" x2="19" y2="5" /><polyline points="14,5 19,5 19,10" /></svg>);
    case "extendedline":
      return (<svg {...common}><line x1="2" y1="21" x2="22" y2="3" /><circle cx="7" cy="16.5" r="1.6" /><circle cx="17" cy="7.5" r="1.6" /></svg>);
    case "infoline":
      return (<svg {...common}><circle cx="5" cy="19" r="1.8" /><circle cx="19" cy="5" r="1.8" /><line x1="6.3" y1="17.7" x2="17.7" y2="6.3" /><text x="12" y="14" fontSize="7" stroke="none" fill="currentColor">i</text></svg>);
    case "angle":
      return (<svg {...common}><line x1="4" y1="20" x2="20" y2="20" /><line x1="4" y1="20" x2="18" y2="6" /><path d="M9 20a6 6 0 0 1 1.2-3.6" /></svg>);
    case "crossline":
      return (<svg {...common}><line x1="12" y1="3" x2="12" y2="21" /><line x1="3" y1="12" x2="21" y2="12" /><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" /></svg>);
    case "parallelchannel":
      return (<svg {...common}><line x1="3" y1="18" x2="17" y2="6" /><line x1="7" y1="21" x2="21" y2="9" /></svg>);
    case "hline":
      return (<svg {...common}><line x1="3" y1="12" x2="21" y2="12" /><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" /></svg>);
    case "hray":
      return (<svg {...common}><circle cx="4" cy="12" r="1.8" fill="currentColor" stroke="none" /><line x1="4" y1="12" x2="20" y2="12" /><polyline points="16,8 20,12 16,16" /></svg>);
    case "vline":
      return (<svg {...common}><line x1="12" y1="3" x2="12" y2="21" /></svg>);
    case "path":
      return (<svg {...common}><polyline points="4,18 9,7 14,15 20,5" /></svg>);
    case "rectangle":
      return (<svg {...common}><rect x="4" y="6" width="16" height="12" rx="1" /></svg>);
    case "circle":
      return (<svg {...common}><circle cx="12" cy="12" r="8" /></svg>);
    case "fib":
      return (<svg {...common}><line x1="3" y1="5" x2="21" y2="5" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="3" y1="14" x2="21" y2="14" /><line x1="3" y1="19" x2="21" y2="19" /></svg>);
    case "fibext":
      return (<svg {...common}><polyline points="4,19 10,7 15,14 21,4" /><line x1="10" y1="7" x2="21" y2="7" strokeDasharray="2,2" /><line x1="15" y1="14" x2="21" y2="14" strokeDasharray="2,2" /><line x1="4" y1="19" x2="21" y2="19" strokeDasharray="2,2" /></svg>);
    case "fibchannel":
      return (<svg {...common}><line x1="2" y1="21" x2="16" y2="4" strokeDasharray="2,2" /><line x1="6" y1="21" x2="20" y2="4" /><line x1="10" y1="21" x2="24" y2="4" strokeDasharray="2,2" /></svg>);
    case "fibtimezone":
      return (<svg {...common}><line x1="4" y1="3" x2="4" y2="21" /><line x1="8" y1="3" x2="8" y2="21" /><line x1="14" y1="3" x2="14" y2="21" /><line x1="22" y1="3" x2="22" y2="21" /></svg>);
    case "gannfan":
      return (<svg {...common}><line x1="3" y1="21" x2="21" y2="3" /><line x1="3" y1="21" x2="21" y2="9" /><line x1="3" y1="21" x2="21" y2="15" /><line x1="3" y1="21" x2="15" y2="21" /></svg>);
    case "pitchfork":
      return (<svg {...common}><line x1="4" y1="20" x2="12" y2="4" /><line x1="12" y1="4" x2="21" y2="10" strokeDasharray="2,2" /><line x1="12" y1="4" x2="21" y2="18" strokeDasharray="2,2" /></svg>);
    case "wave":
      return (<svg {...common}><path d="M4 20l5-14 5 10 6-12" /></svg>);
    case "pricerange":
      return (<svg {...common}><line x1="12" y1="4" x2="12" y2="20" /><polyline points="9,7 12,4 15,7" /><polyline points="9,17 12,20 15,17" /><line x1="7" y1="4" x2="17" y2="4" /><line x1="7" y1="20" x2="17" y2="20" /></svg>);
    case "daterange":
      return (<svg {...common}><line x1="4" y1="12" x2="20" y2="12" /><polyline points="7,9 4,12 7,15" /><polyline points="17,9 20,12 17,15" /><line x1="4" y1="7" x2="4" y2="17" /><line x1="20" y1="7" x2="20" y2="17" /></svg>);
    case "position_long":
      return (<svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 16V8M8.5 11.5L12 8l3.5 3.5" /></svg>);
    case "position_short":
      return (<svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 8v8M8.5 12.5L12 16l3.5-3.5" /></svg>);
    case "text":
      return (<svg {...common}><path d="M5 5h14M12 5v14" /></svg>);
    case "measure":
      return (<svg {...common}><rect x="3" y="9" width="18" height="6" rx="1" /><line x1="7" y1="9" x2="7" y2="12" /><line x1="11" y1="9" x2="11" y2="12" /><line x1="15" y1="9" x2="15" y2="12" /><line x1="19" y1="9" x2="19" y2="12" /></svg>);
    case "magnet":
      return (<svg {...common}><path d="M7 4v7a5 5 0 0 0 10 0V4" /><path d="M7 4H4v7a8 8 0 0 0 16 0V4h-3" /></svg>);
    case "eye":
      return (<svg {...common}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>);
    case "eyeOff":
      return (<svg {...common}><path d="M3 3l18 18" /><path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6 0 10 7 10 7a17.6 17.6 0 0 1-3.4 4.2M6.7 6.7C4 8.5 2 12 2 12s4 7 10 7c1.4 0 2.7-.3 3.9-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>);
    case "trash":
      return (<svg {...common}><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>);
    default:
      return null;
  }
}

/* عناوين وترتيب أدوات الرسم (مجمّعة زي تريدنغ فيو) */
const TOOL_TITLES = {
  cursor: "مؤشر (تنقل عادي)",
  trendline: "خط اتجاه",
  ray: "شعاع",
  extendedline: "خط ممتد (بالاتجاهين)",
  infoline: "خط معلومات",
  angle: "زاوية الاتجاه",
  hline: "خط أفقي",
  hray: "شعاع أفقي",
  vline: "خط عمودي",
  crossline: "خط متقاطع",
  parallelchannel: "قناة متوازية",
  path: "مسار (نقاط متعددة)",
  rectangle: "مستطيل",
  circle: "دائرة",
  fib: "فيبوناتشي (تصحيح)",
  fibext: "فيبوناتشي (امتداد 3 نقاط)",
  fibchannel: "قناة فيبوناتشي",
  fibtimezone: "مناطق فيبوناتشي الزمنية",
  gannfan: "مروحة غان",
  pitchfork: "شوكة أندروز (Pitchfork)",
  wave: "موجة تصحيح إليوت (0،A،B،C)",
  pricerange: "نطاق السعر",
  daterange: "نطاق التاريخ",
  position_long: "مركز شراء",
  position_short: "مركز بيع",
  text: "نص",
  measure: "أداة قياس",
};
const TOOL_GROUPS = [
  ["cursor"],
  ["trendline", "ray", "extendedline", "infoline", "angle", "hline", "hray", "vline", "crossline", "parallelchannel"],
  ["path", "rectangle", "circle"],
  ["fib", "fibext", "fibchannel", "fibtimezone", "gannfan", "pitchfork", "wave"],
  ["pricerange", "daterange"],
  ["position_long", "position_short"],
  ["text", "measure"],
];

/* أنماط افتراضية لكل نوع رسمة (قابلة للتعديل من لوحة الخصائص) */
function defaultStyleFor(type) {
  switch (type) {
    case "trendline":
    case "ray":
      return { color: GOLD_LIGHT, width: 2, extend: "none" };
    case "extendedline":
      return { color: GOLD_LIGHT, width: 1.5, extend: "both" };
    case "infoline":
      return { color: "#4f7cff", width: 1.5, extend: "none" };
    case "angle":
      return { color: "#e0a63c", width: 1.5 };
    case "crossline":
      return { color: GOLD_LIGHT, width: 1, dash: "dashed" };
    case "parallelchannel":
      return { color: GOLD_LIGHT, width: 1.5, fill: true, fillColor: GOLD, fillAlpha: 0.12 };
    case "hline":
      return { color: GOLD_LIGHT, width: 1.5, dash: "dashed" };
    case "hray":
    case "vline":
      return { color: GOLD_LIGHT, width: 1.5, dash: "solid" };
    case "path":
      return { color: GOLD_LIGHT, width: 2, closed: false, fill: false, fillColor: GOLD, fillAlpha: 0.15 };
    case "wave":
      return { color: "#ffffff", width: 1.5 };
    case "rectangle":
      return { color: GOLD_LIGHT, width: 1.5, fill: true, fillColor: GOLD, fillAlpha: 0.15, midline: false, midlineColor: "#4caf50", midlineDash: true };
    case "circle":
      return { color: GOLD_LIGHT, width: 1.5, fill: true, fillColor: GOLD, fillAlpha: 0.18 };
    case "fib":
      return {
        color: GOLD_LIGHT, extend: "none",
        levels: [
          { value: 0, color: "#787b86", enabled: true },
          { value: 0.236, color: "#f23645", enabled: true },
          { value: 0.382, color: "#ff9800", enabled: true },
          { value: 0.5, color: "#4caf50", enabled: true },
          { value: 0.618, color: "#00bcd4", enabled: true },
          { value: 0.786, color: "#2196f3", enabled: true },
          { value: 1, color: "#787b86", enabled: true },
          { value: 1.272, color: "#9c27b0", enabled: false },
          { value: 1.414, color: "#9c27b0", enabled: false },
          { value: 1.618, color: "#e91e63", enabled: false },
          { value: 2, color: "#795548", enabled: false },
          { value: 2.618, color: "#607d8b", enabled: false },
        ],
      };
    case "fibext":
      return {
        color: GOLD_LIGHT, width: 1.3, extend: "right",
        levels: [
          { value: 0, color: "#787b86", enabled: true },
          { value: 0.236, color: "#f23645", enabled: false },
          { value: 0.382, color: "#ff9800", enabled: true },
          { value: 0.5, color: "#4caf50", enabled: true },
          { value: 0.618, color: "#00bcd4", enabled: true },
          { value: 0.786, color: "#2196f3", enabled: false },
          { value: 1, color: "#787b86", enabled: true },
          { value: 1.272, color: "#9c27b0", enabled: true },
          { value: 1.414, color: "#9c27b0", enabled: false },
          { value: 1.618, color: "#e91e63", enabled: true },
          { value: 2, color: "#795548", enabled: false },
          { value: 2.618, color: "#607d8b", enabled: false },
          { value: 3.618, color: "#607d8b", enabled: false },
          { value: 4.236, color: "#607d8b", enabled: false },
        ],
      };
    case "fibchannel":
      return {
        color: GOLD_LIGHT, width: 1.3,
        levels: [
          { value: 0, color: "#787b86", enabled: true },
          { value: 0.236, color: "#f23645", enabled: true },
          { value: 0.382, color: "#ff9800", enabled: true },
          { value: 0.5, color: "#4caf50", enabled: true },
          { value: 0.618, color: "#00bcd4", enabled: true },
          { value: 0.786, color: "#2196f3", enabled: true },
          { value: 1, color: "#787b86", enabled: true },
        ],
      };
    case "fibtimezone":
      return { color: "#4f7cff", width: 1, dash: "dashed" };
    case "gannfan":
      return { color: "#e0a63c", width: 1.2 };
    case "pitchfork":
      return { color: "#4f7cff", width: 1.5 };
    case "pricerange":
      return { color: "#4f7cff", width: 1.5, fill: true, fillColor: "#4f7cff", fillAlpha: 0.2 };
    case "daterange":
      return { color: "#4f7cff", width: 1.5, fill: true, fillColor: "#4f7cff", fillAlpha: 0.2 };
    case "position_long":
    case "position_short":
      return { targetColor: GREEN, stopColor: RED, alpha: 0.3 };
    case "text":
      return { color: GOLD_LIGHT, size: 13 };
    default:
      return { color: GOLD_LIGHT, width: 1.5 };
  }
}

function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(201,162,75,${alpha})`;
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const bigint = parseInt(full, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function pointSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export default function ReplayClient({ userId }) {

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  const [mode, setMode] = useState("live"); // "live" | "training"
  const [randomChart, setRandomChart] = useState(false);

  const [assetValue, setAssetValue] = useState("XAUUSD");
  const [interval, setIntervalValue] = useState("15m");
  const [speed, setSpeed] = useState(700);
  const [maxBars, setMaxBars] = useState(1000);

  const [allCandles, setAllCandles] = useState([]);
  const [revealCount, setRevealCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);

  const [countdown, setCountdown] = useState("");
  const [countdownProgress, setCountdownProgress] = useState(0);
  const [liveLastPrice, setLiveLastPrice] = useState(null);
  const [priceDir, setPriceDir] = useState(0); // 1 صعود / -1 هبوط / 0 محايد
  const prevPriceRef = useRef(null);

  function updateLivePrice(p) {
    if (prevPriceRef.current != null) {
      if (p > prevPriceRef.current) setPriceDir(1);
      else if (p < prevPriceRef.current) setPriceDir(-1);
    }
    prevPriceRef.current = p;
    setLiveLastPrice(p);
    checkOpenPositionsRef.current?.(p);
  }

  const [cutMode, setCutMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartWrapperRef = useRef(null);
  const headerRef = useRef(null);

  const playTimerRef = useRef(null);
  const livePollRef = useRef(null);
  const countdownTickRef = useRef(null);
  const forminCandleStartRef = useRef(null);

  /* ===================== أدوات الرسم (تريدنغ فيو ستايل) ===================== */
  const overlayCanvasRef = useRef(null);
  const chartAreaRef = useRef(null);
  const [activeTool, setActiveTool] = useState("cursor");
  const [magnetOn, setMagnetOn] = useState(false);
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  const activeToolRef = useRef("cursor");
  const magnetRef = useRef(false);
  const drawingsVisibleRef = useRef(true);
  const drawingsRef = useRef([]); // [{id, type, p1:{logical,price}, p2?, points?, text?, style}]
  const drawStateRef = useRef(null); // الرسمة الجارية حالياً (سحب نقطتين)
  const isDrawingRef = useRef(false);
  const visibleCandlesRef = useRef([]);
  const pathPointsRef = useRef([]); // نقاط أداة المسار/الموجة أثناء الرسم
  const liveCursorRef = useRef(null); // موقع الماوس الحالي (لمعاينة المسار قبل التثبيت)
  const dragStateRef = useRef(null); // سحب/تحريك رسمة موجودة بوضع المؤشر: {mode:"move"|"handle", id, key?, lastLogical?, lastPrice?}
  const intervalRef = useRef(interval);

  // لوحة خصائص الرسمة المحددة
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  /* إعدادات ألوان الشارت (خلفية + شموع صعود/هبوط) + قائمة الكليك يمين + نافذة الإعدادات */
  const [chartSettings, setChartSettings] = useState(DEFAULT_CHART_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, price }

  /* ===== ربط أزرار الشراء/البيع الفوري ببرنامج الباك تيست ===== */
  const supabase = useRef(createClient()).current;
  const [accountBalance, setAccountBalance] = useState(3000);
  const [pendingTrade, setPendingTrade] = useState(null); // {direction, entry, lot, tpId, slId, asset}
  const [tradeLot, setTradeLot] = useState("0.01");
  const [savingTrade, setSavingTrade] = useState(false);
  const [tradeToast, setTradeToast] = useState("");
  const [dragTick, setDragTick] = useState(0);
  const openPositionsRef = useRef([]); // [{dbId, direction, entry, sl, tp, lot, riskAmount, rewardAmount, asset}]
  const checkOpenPositionsRef = useRef(null);
  const pendingTradeRef = useRef(null);

  useEffect(() => {
    pendingTradeRef.current = pendingTrade;
  }, [pendingTrade]);

  useEffect(() => {
    if (!supabase || !userId) return;
    let active = true;
    supabase.from("profiles").select("backtest_balance").eq("id", userId).single().then(({ data }) => {
      if (active && data?.backtest_balance != null) setAccountBalance(Number(data.backtest_balance));
    });
    return () => { active = false; };
  }, [supabase, userId]);

  useEffect(() => {
    if (!tradeToast) return;
    const t = setTimeout(() => setTradeToast(""), 3500);
    return () => clearTimeout(t);
  }, [tradeToast]);

  /* تحميل إعدادات الألوان المحفوظة بعد أول رندر عالمتصفح (تفادي مشاكل الـ SSR) */
  useEffect(() => {
    setChartSettings(loadChartSettings());
  }, []);

  /* أي تغيير بالإعدادات: تطبيق فوري على الشارت + حفظ بالمتصفح */
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;
    chartRef.current.applyOptions({ layout: { background: { color: chartSettings.bg } } });
    seriesRef.current.applyOptions({
      upColor: chartSettings.up, downColor: chartSettings.down,
      wickUpColor: chartSettings.up, wickDownColor: chartSettings.down,
    });
    saveChartSettings(chartSettings);
  }, [chartSettings]);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { magnetRef.current = magnetOn; }, [magnetOn]);
  useEffect(() => { intervalRef.current = interval; }, [interval]);
  useEffect(() => { drawingsVisibleRef.current = drawingsVisible; drawOverlay(); }, [drawingsVisible]);
  useEffect(() => {
    visibleCandlesRef.current = mode === "training" ? allCandles.slice(0, revealCount) : allCandles;
  }, [allCandles, revealCount, mode]);

  /* حساسية المغناطيس: يلتصق فقط لما المؤشر قريب فعلاً (بالبكسل) من قيمة أوبن/هاي/لو/كلوز
     الشمعة تحت المؤشر - مش فرض أقرب سعر دايماً. هيك حساسيته أخف وأدق من قبل. */
  const SNAP_THRESHOLD_PX = 10;
  function snapPrice(logical, rawPrice, rawY) {
    if (!magnetRef.current) return rawPrice;
    const series = seriesRef.current;
    if (!series || rawY == null) return rawPrice;
    const idx = Math.round(logical);
    const candle = visibleCandlesRef.current[idx];
    if (!candle) return rawPrice;
    const vals = [candle.open, candle.high, candle.low, candle.close];
    let best = null, bestDist = Infinity;
    for (const v of vals) {
      const y = series.priceToCoordinate(v);
      if (y == null) continue;
      const d = Math.abs(rawY - y);
      if (d < bestDist) { bestDist = d; best = v; }
    }
    if (best == null || bestDist > SNAP_THRESHOLD_PX) return rawPrice;
    return best;
  }

  function drawOverlay() {
    const canvas = overlayCanvasRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!canvas || !chart || !series) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (!drawingsVisibleRef.current) { ctx.restore(); return; }

    const ts = chart.timeScale();
    const toXY = (p) => ({ x: ts.logicalToCoordinate(p.logical), y: series.priceToCoordinate(p.price) });
    const setLineStyle = (style = {}) => {
      ctx.strokeStyle = style.color || GOLD_LIGHT;
      ctx.fillStyle = style.color || GOLD_LIGHT;
      ctx.lineWidth = style.width || 1.5;
      ctx.setLineDash(style.dash === "dashed" ? [6, 4] : style.dash === "dotted" ? [2, 3] : []);
    };

    const all = [...drawingsRef.current];
    if (drawStateRef.current) all.push(drawStateRef.current);
    if ((activeToolRef.current === "path" || activeToolRef.current === "wave" || activeToolRef.current === "fibext" || activeToolRef.current === "parallelchannel" || activeToolRef.current === "fibchannel" || activeToolRef.current === "pitchfork") && pathPointsRef.current.length) {
      const pts = [...pathPointsRef.current];
      if (liveCursorRef.current) pts.push(liveCursorRef.current);
      all.push({ type: activeToolRef.current, points: pts, style: defaultStyleFor(activeToolRef.current) });
    }

    for (const d of all) {
      const style = d.style || defaultStyleFor(d.type);
      ctx.font = "11px sans-serif";
      ctx.lineWidth = style.width || 1.5;

      if (d.type === "hline") {
        const y = series.priceToCoordinate(d.p1.price);
        if (y == null) continue;
        setLineStyle({ ...style, dash: style.dash || "dashed" });
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        ctx.setLineDash([]);
        const roleLabel = d.tradeRole === "tp" ? "🎯 هدف (TP): " : d.tradeRole === "sl" ? "⛔ إيقاف (SL): " : d.tradeRole === "entry" ? "▶ دخول: " : "";
        if (roleLabel) {
          ctx.font = "bold 11px sans-serif";
          const label = roleLabel + d.p1.price.toFixed(2);
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = style.color || GOLD_LIGHT;
          ctx.fillRect(4, y - 15, tw + 10, 16);
          ctx.fillStyle = "#0a0a0a";
          ctx.fillText(label, 9, y - 4);
        } else {
          ctx.fillText(d.p1.price.toFixed(2), 6, y - 4);
        }

      } else if (d.type === "hray") {
        const y = series.priceToCoordinate(d.p1.price);
        const x1 = ts.logicalToCoordinate(d.p1.logical);
        if (y == null || x1 == null) continue;
        setLineStyle(style);
        ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(w, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(x1, y, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillText(d.p1.price.toFixed(2), x1 + 6, y - 4);

      } else if (d.type === "vline") {
        const x1 = ts.logicalToCoordinate(d.p1.logical);
        if (x1 == null) continue;
        setLineStyle(style);
        ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, h); ctx.stroke();
        ctx.setLineDash([]);

      } else if (d.type === "trendline") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        setLineStyle(style);
        let x1 = a.x, y1 = a.y, x2 = b.x, y2 = b.y;
        const ext = style.extend;
        if (ext === "right" || ext === "both") {
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
          x2 = b.x + (dx / len) * 3000; y2 = b.y + (dy / len) * 3000;
        }
        if (ext === "left" || ext === "both") {
          const dx = a.x - b.x, dy = a.y - b.y, len = Math.hypot(dx, dy) || 1;
          x1 = a.x + (dx / len) * 3000; y1 = a.y + (dy / len) * 3000;
        }
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]);

      } else if (d.type === "ray") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        setLineStyle(style);
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        const x2 = a.x + (dx / len) * 3000, y2 = a.y + (dy / len) * 3000;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]);

      } else if (d.type === "extendedline") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        setLineStyle(style);
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        const x1 = a.x - (dx / len) * 3000, y1 = a.y - (dy / len) * 3000;
        const x2 = b.x + (dx / len) * 3000, y2 = b.y + (dy / len) * 3000;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]);

      } else if (d.type === "crossline") {
        const y = series.priceToCoordinate(d.p1.price);
        const x = ts.logicalToCoordinate(d.p1.logical);
        if (y == null || x == null) continue;
        setLineStyle(style);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillText(d.p1.price.toFixed(2), x + 6, y - 4);

      } else if (d.type === "infoline") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        setLineStyle(style);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.setLineDash([]);
        [a, b].forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); });
        const priceDiff = d.p2.price - d.p1.price;
        const pct = d.p1.price ? (priceDiff / d.p1.price) * 100 : 0;
        const bars = Math.round(d.p2.logical - d.p1.logical);
        const angleDeg = (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
        const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
        ctx.font = "11px sans-serif";
        ctx.fillText(`${priceDiff >= 0 ? "+" : ""}${priceDiff.toFixed(2)} (${pct.toFixed(2)}%) | ${bars} شمعة | ${angleDeg.toFixed(1)}°`, midX + 6, midY - 6);

      } else if (d.type === "angle") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        setLineStyle(style);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, a.y); ctx.stroke();
        ctx.setLineDash([]);
        const angleDeg = (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
        const r = 22;
        const startAng = 0;
        const endAng = -((angleDeg * Math.PI) / 180) * (b.x >= a.x ? 1 : 1);
        ctx.beginPath();
        ctx.arc(a.x, a.y, r, startAng, endAng, angleDeg > 0 ? true : false);
        ctx.stroke();
        ctx.fillText(`${angleDeg.toFixed(1)}°`, a.x + r + 4, a.y - 4);
        [a, b].forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); });

      } else if (d.type === "parallelchannel") {
        if (!d.points || d.points.length < 2) continue;
        const [p1, p2, p3] = d.points;
        const xy1 = toXY(p1), xy2 = toXY(p2);
        if (xy1.x == null || xy2.x == null) continue;
        setLineStyle(style);
        const dx = xy2.x - xy1.x, dy = xy2.y - xy1.y, len = Math.hypot(dx, dy) || 1;
        const ex1x = xy1.x - (dx / len) * 3000, ex1y = xy1.y - (dy / len) * 3000;
        const ex2x = xy2.x + (dx / len) * 3000, ex2y = xy2.y + (dy / len) * 3000;
        ctx.beginPath(); ctx.moveTo(ex1x, ex1y); ctx.lineTo(ex2x, ex2y); ctx.stroke();
        [xy1, xy2].forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); });
        if (p3) {
          const xy3 = toXY(p3);
          if (xy3.x != null) {
            // نحسب الإزاحة العمودية للخط الموازي بحيث يمر من النقطة الثالثة
            const nx = -dy / len, ny = dx / len;
            const offset = (xy3.x - xy1.x) * nx + (xy3.y - xy1.y) * ny;
            const o1x = ex1x + nx * offset, o1y = ex1y + ny * offset;
            const o2x = ex2x + nx * offset, o2y = ex2y + ny * offset;
            ctx.beginPath(); ctx.moveTo(o1x, o1y); ctx.lineTo(o2x, o2y); ctx.stroke();
            if (style.fill !== false) {
              ctx.fillStyle = hexToRgba(style.fillColor || GOLD, style.fillAlpha ?? 0.12);
              ctx.beginPath();
              ctx.moveTo(ex1x, ex1y); ctx.lineTo(ex2x, ex2y); ctx.lineTo(o2x, o2y); ctx.lineTo(o1x, o1y); ctx.closePath();
              ctx.fill();
            }
            ctx.beginPath(); ctx.arc(xy3.x, xy3.y, 2.5, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.setLineDash([]);

      } else if (d.type === "rectangle") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        const rw = Math.abs(b.x - a.x), rh = Math.abs(b.y - a.y);
        if (style.fill !== false) { ctx.fillStyle = hexToRgba(style.fillColor || GOLD, style.fillAlpha ?? 0.15); ctx.fillRect(x, y, rw, rh); }
        ctx.strokeStyle = style.color || GOLD_LIGHT; ctx.lineWidth = style.width || 1.5;
        ctx.strokeRect(x, y, rw, rh);
        if (style.midline) {
          const midY = y + rh / 2;
          const midPrice = (d.p1.price + d.p2.price) / 2;
          ctx.strokeStyle = style.midlineColor || "#4caf50";
          ctx.lineWidth = 1.3;
          ctx.setLineDash(style.midlineDash === false ? [] : [4, 3]);
          ctx.beginPath(); ctx.moveTo(x, midY); ctx.lineTo(x + rw, midY); ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = "11px sans-serif";
          ctx.fillStyle = style.midlineColor || "#4caf50";
          ctx.fillText(`50% - ${midPrice.toFixed(2)}`, x + rw + 4, midY - 3);
        }

      } else if (d.type === "circle") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (style.fill !== false) { ctx.fillStyle = hexToRgba(style.fillColor || GOLD, style.fillAlpha ?? 0.18); ctx.fill(); }
        ctx.strokeStyle = style.color || GOLD_LIGHT; ctx.lineWidth = style.width || 1.5; ctx.stroke();

      } else if (d.type === "fib") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        const levels = (style.levels && style.levels.length ? style.levels : [
          { value: 0, color: style.color, enabled: true }, { value: 0.236, color: style.color, enabled: true },
          { value: 0.382, color: style.color, enabled: true }, { value: 0.5, color: style.color, enabled: true },
          { value: 0.618, color: style.color, enabled: true }, { value: 0.786, color: style.color, enabled: true },
          { value: 1, color: style.color, enabled: true },
        ]).filter((l) => l.enabled !== false);
        const x0raw = Math.min(a.x, b.x), x1raw = Math.max(a.x, b.x);
        const ext = style.extend || "none";
        const x0 = (ext === "left" || ext === "both") ? 0 : x0raw;
        const x1 = (ext === "right" || ext === "both") ? w : x1raw;
        const priceHigh = Math.max(d.p1.price, d.p2.price);
        const priceLow = Math.min(d.p1.price, d.p2.price);
        for (const lvl of levels) {
          const price = priceHigh - (priceHigh - priceLow) * lvl.value;
          const y = series.priceToCoordinate(price);
          if (y == null) continue;
          ctx.strokeStyle = lvl.color || style.color || GOLD_LIGHT;
          ctx.fillStyle = lvl.color || style.color || GOLD_LIGHT;
          ctx.lineWidth = style.width || 1.3;
          ctx.setLineDash(style.dash === "dashed" ? [4, 3] : style.dash === "dotted" ? [2, 3] : []);
          ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillText(`${(lvl.value * 100).toFixed(1)}% - ${price.toFixed(2)}`, x1raw + 4, y - 3);
        }

      } else if (d.type === "fibext") {
        if (!d.points || d.points.length < 2) continue;
        const [p1, p2, p3] = d.points;
        const xy1 = toXY(p1), xy2 = toXY(p2);
        if (xy1.x == null || xy2.x == null) continue;
        setLineStyle({ ...style, dash: "dashed", width: 1.3 });
        ctx.beginPath(); ctx.moveTo(xy1.x, xy1.y); ctx.lineTo(xy2.x, xy2.y);
        if (p3) {
          const xy3 = toXY(p3);
          if (xy3.x != null) ctx.lineTo(xy3.x, xy3.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = style.color || GOLD_LIGHT;
        [xy1, xy2, ...(p3 ? [toXY(p3)] : [])].forEach((p) => {
          if (p.x == null) return;
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
        });

        if (p3) {
          const xy3 = toXY(p3);
          if (xy3.x == null) continue;
          const diff = p2.price - p1.price; // مقدار حركة الموجة الأساسية A→B
          const fallbackLevels = [
            { value: 0, color: "#787b86", enabled: true }, { value: 0.236, color: "#f23645", enabled: true },
            { value: 0.382, color: "#ff9800", enabled: true }, { value: 0.5, color: "#4caf50", enabled: true },
            { value: 0.618, color: "#00bcd4", enabled: true }, { value: 0.786, color: "#2196f3", enabled: true },
            { value: 1, color: "#787b86", enabled: true }, { value: 1.272, color: "#9c27b0", enabled: true },
            { value: 1.618, color: "#e91e63", enabled: true },
          ];
          const levels = (style.levels && style.levels.length ? style.levels : fallbackLevels).filter((l) => l.enabled !== false);
          const extendRight = (style.extend || "right") !== "none";
          const endX = extendRight ? w : xy3.x + 120;
          ctx.font = "11px sans-serif";
          for (const lvl of levels) {
            const price = p3.price + diff * lvl.value;
            const y = series.priceToCoordinate(price);
            if (y == null) continue;
            const col = lvl.color || style.color || GOLD_LIGHT;
            ctx.strokeStyle = col;
            ctx.fillStyle = col;
            ctx.lineWidth = style.width || 1.3;
            ctx.setLineDash(lvl.value === 0 || lvl.value === 1 ? [] : [3, 3]);
            ctx.beginPath(); ctx.moveTo(xy3.x, y); ctx.lineTo(endX, y); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillText(`${(lvl.value * 100).toFixed(1)}% - ${price.toFixed(2)}`, xy3.x + 4, y - 3);
          }
        }

      } else if (d.type === "fibchannel") {
        if (!d.points || d.points.length < 2) continue;
        const [p1, p2, p3] = d.points;
        const xy1 = toXY(p1), xy2 = toXY(p2);
        if (xy1.x == null || xy2.x == null) continue;
        const dx = xy2.x - xy1.x, dy = xy2.y - xy1.y, len = Math.hypot(dx, dy) || 1;
        const ex1x = xy1.x - (dx / len) * 3000, ex1y = xy1.y - (dy / len) * 3000;
        const ex2x = xy2.x + (dx / len) * 3000, ex2y = xy2.y + (dy / len) * 3000;
        const nx = -dy / len, ny = dx / len;
        let offset = 0;
        if (p3) {
          const xy3 = toXY(p3);
          if (xy3.x != null) offset = (xy3.x - xy1.x) * nx + (xy3.y - xy1.y) * ny;
        }
        ctx.font = "10px sans-serif";
        const levels = (style.levels && style.levels.length ? style.levels : [
          { value: 0, color: style.color, enabled: true }, { value: 0.5, color: style.color, enabled: true }, { value: 1, color: style.color, enabled: true },
        ]).filter((l) => l.enabled !== false);
        for (const lvl of levels) {
          const off = offset * lvl.value;
          ctx.strokeStyle = lvl.color || style.color || GOLD_LIGHT;
          ctx.lineWidth = style.width || 1.3;
          ctx.setLineDash(lvl.value === 0 || lvl.value === 1 ? [] : [2, 3]);
          const lx1 = ex1x + nx * off, ly1 = ex1y + ny * off;
          const lx2 = ex2x + nx * off, ly2 = ex2y + ny * off;
          ctx.beginPath(); ctx.moveTo(lx1, ly1); ctx.lineTo(lx2, ly2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = lvl.color || style.color || GOLD_LIGHT;
          ctx.fillText(`${(lvl.value * 100).toFixed(1)}%`, lx2 - 30, ly2 - 3);
        }

      } else if (d.type === "fibtimezone") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null) continue;
        setLineStyle(style);
        const barGap = Math.max(1, Math.abs(d.p2.logical - d.p1.logical));
        const fibSeq = [1, 2, 3, 5, 8, 13, 21, 34, 55];
        ctx.font = "10px sans-serif";
        for (const n of fibSeq) {
          const logical = d.p1.logical + barGap * n;
          const x = ts.logicalToCoordinate(logical);
          if (x == null || x > w + 20) break;
          ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillText(String(n), x + 3, 14);
        }

      } else if (d.type === "gannfan") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null) continue;
        setLineStyle(style);
        const priceUnit = (d.p2.price - d.p1.price) || 1;
        const barUnit = (d.p2.logical - d.p1.logical) || 1;
        const ratios = [[1, 8], [1, 4], [1, 2], [1, 1], [2, 1], [4, 1], [8, 1]];
        ctx.font = "10px sans-serif";
        for (const [pMul, tMul] of ratios) {
          const endLogical = d.p1.logical + barUnit * tMul * Math.sign(barUnit || 1) * 3;
          const endPrice = d.p1.price + priceUnit * pMul * Math.sign(barUnit || 1) * 3;
          const endXY = toXY({ logical: endLogical, price: endPrice });
          if (endXY.x == null) continue;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(endXY.x, endXY.y); ctx.stroke();
          ctx.fillText(`${pMul}x${tMul}`, endXY.x, endXY.y);
        }

      } else if (d.type === "pitchfork") {
        if (!d.points || d.points.length < 2) continue;
        const [p1, p2, p3] = d.points;
        const xy1 = toXY(p1), xy2 = toXY(p2);
        if (xy1.x == null || xy2.x == null) continue;
        setLineStyle(style);
        [xy1, xy2].forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); });
        if (p3) {
          const xy3 = toXY(p3);
          if (xy3.x == null) continue;
          const midX = (xy2.x + xy3.x) / 2, midY = (xy2.y + xy3.y) / 2;
          const dx = midX - xy1.x, dy = midY - xy1.y, len = Math.hypot(dx, dy) || 1;
          const endX = xy1.x + (dx / len) * 3000, endY = xy1.y + (dy / len) * 3000;
          ctx.beginPath(); ctx.moveTo(xy1.x, xy1.y); ctx.lineTo(endX, endY); ctx.stroke();
          const upEndX = xy2.x + (dx / len) * 3000, upEndY = xy2.y + (dy / len) * 3000;
          const dnEndX = xy3.x + (dx / len) * 3000, dnEndY = xy3.y + (dy / len) * 3000;
          ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.moveTo(xy2.x, xy2.y); ctx.lineTo(upEndX, upEndY); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(xy3.x, xy3.y); ctx.lineTo(dnEndX, dnEndY); ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(xy3.x, xy3.y, 2.5, 0, Math.PI * 2); ctx.fill();
        }

      } else if (d.type === "path" || d.type === "wave") {
        if (!d.points || d.points.length < 1) continue;
        const pts = d.points.map(toXY).filter((p) => p.x != null && p.y != null);
        if (pts.length < 1) continue;
        setLineStyle(style);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (style.closed && pts.length > 2) ctx.closePath();
        ctx.stroke();
        if (style.closed && style.fill && pts.length > 2) {
          ctx.fillStyle = hexToRgba(style.fillColor || GOLD, style.fillAlpha ?? 0.15);
          ctx.fill();
        }
        ctx.setLineDash([]);
        for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill(); }
        if (d.type === "wave") {
          const labels = ["0", "A", "B", "C"];
          ctx.font = "12px sans-serif";
          pts.forEach((p, i) => ctx.fillText(labels[i] || "", p.x + 5, p.y - 6));
        }

      } else if (d.type === "text") {
        const p = toXY(d.p1);
        if (p.x == null || p.y == null) continue;
        ctx.fillStyle = style.color || GOLD_LIGHT;
        ctx.font = `${style.size || 13}px sans-serif`;
        ctx.fillText(d.text, p.x + 5, p.y - 5);
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();

      } else if (d.type === "measure") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null) continue;
        const priceDiff = d.p2.price - d.p1.price;
        const pct = (priceDiff / d.p1.price) * 100;
        const bars = Math.round(d.p2.logical - d.p1.logical);
        const col = priceDiff >= 0 ? GREEN : RED;
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        const rw = Math.abs(b.x - a.x), rh = Math.abs(b.y - a.y);
        ctx.fillStyle = priceDiff >= 0 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)";
        ctx.strokeStyle = col;
        ctx.fillRect(x, y, rw, rh); ctx.strokeRect(x, y, rw, rh);
        ctx.fillStyle = col; ctx.font = "12px sans-serif";
        ctx.fillText(`${priceDiff >= 0 ? "+" : ""}${priceDiff.toFixed(2)} (${pct.toFixed(2)}%) | ${bars} شمعة`, x + 5, y - 6);

      } else if (d.type === "pricerange") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null) continue;
        const priceDiff = d.p2.price - d.p1.price;
        const pct = (priceDiff / d.p1.price) * 100;
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        const rw = Math.abs(b.x - a.x), rh = Math.abs(b.y - a.y);
        const col = style.color || "#4f7cff";
        if (style.fill !== false) { ctx.fillStyle = hexToRgba(style.fillColor || col, style.fillAlpha ?? 0.2); ctx.fillRect(x, y, rw, rh); }
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, rw, rh);
        ctx.fillStyle = col; ctx.font = "12px sans-serif";
        ctx.fillText(`${priceDiff >= 0 ? "+" : ""}${priceDiff.toFixed(2)} (${pct.toFixed(2)}%)`, x + 5, y - 6);

      } else if (d.type === "daterange") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null) continue;
        const bars = Math.abs(Math.round(d.p2.logical - d.p1.logical));
        const stepMs = INTERVAL_MS[intervalRef.current] || 60000;
        const totalH = Math.floor((bars * stepMs) / 3600000);
        const days = Math.floor(totalH / 24);
        const hrs = totalH % 24;
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        const rw = Math.abs(b.x - a.x), rh = Math.abs(b.y - a.y);
        const col = style.color || "#4f7cff";
        if (style.fill !== false) { ctx.fillStyle = hexToRgba(style.fillColor || col, style.fillAlpha ?? 0.2); ctx.fillRect(x, y, rw, rh); }
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, rw, rh);
        ctx.fillStyle = col; ctx.font = "12px sans-serif";
        ctx.fillText(`${bars} شمعة، ${days} يوم ${hrs} ساعة`, x + 5, y - 6);

      } else if (d.type === "position_long" || d.type === "position_short") {
        const isLong = d.type === "position_long";
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null) continue;
        const entryY = a.y;
        const dist = Math.abs(b.y - a.y);
        const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
        const targetY = isLong ? entryY - dist : entryY + dist;
        const stopY = isLong ? entryY + dist : entryY - dist;
        const alpha = style.alpha ?? 0.3;
        ctx.fillStyle = hexToRgba(style.targetColor || GREEN, alpha);
        ctx.fillRect(x0, Math.min(targetY, entryY), x1 - x0, Math.abs(entryY - targetY));
        ctx.fillStyle = hexToRgba(style.stopColor || RED, alpha);
        ctx.fillRect(x0, Math.min(entryY, stopY), x1 - x0, Math.abs(stopY - entryY));
        ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, entryY); ctx.lineTo(x1, entryY); ctx.stroke();
        const targetPrice = series.coordinateToPrice(targetY);
        const stopPrice = series.coordinateToPrice(stopY);
        const entryPrice = d.p1.price;
        const rewardPct = targetPrice != null ? (((targetPrice - entryPrice) / entryPrice) * 100) : 0;
        const riskPct = stopPrice != null ? (((stopPrice - entryPrice) / entryPrice) * 100) : 0;
        ctx.font = "11px sans-serif";
        ctx.fillStyle = GREEN;
        ctx.fillText(`الهدف: ${targetPrice != null ? targetPrice.toFixed(2) : "-"} (${rewardPct >= 0 ? "+" : ""}${rewardPct.toFixed(2)}%)`, x0 + 4, Math.min(targetY, entryY) - 4);
        ctx.fillStyle = RED;
        ctx.fillText(`الإيقاف: ${stopPrice != null ? stopPrice.toFixed(2) : "-"} (${riskPct >= 0 ? "+" : ""}${riskPct.toFixed(2)}%)`, x0 + 4, Math.max(stopY, entryY) + 14);
      }
    }
    ctx.restore();
  }

  /* ===================== اختيار وتعديل رسمة موجودة ===================== */
  function logicalPriceToXY(p) {
    const chart = chartRef.current, series = seriesRef.current;
    if (!chart || !series) return { x: null, y: null };
    return { x: chart.timeScale().logicalToCoordinate(p.logical), y: series.priceToCoordinate(p.price) };
  }
  function distanceToDrawingPx(d, x, y) {
    const chart = chartRef.current, series = seriesRef.current;
    if (!chart || !series) return Infinity;
    try {
      switch (d.type) {
        case "hline": {
          const py = series.priceToCoordinate(d.p1.price);
          return py == null ? Infinity : Math.abs(y - py);
        }
        case "hray": {
          const py = series.priceToCoordinate(d.p1.price);
          const px1 = chart.timeScale().logicalToCoordinate(d.p1.logical);
          if (py == null || px1 == null || x < px1 - 4) return Infinity;
          return Math.abs(y - py);
        }
        case "vline": {
          const px1 = chart.timeScale().logicalToCoordinate(d.p1.logical);
          return px1 == null ? Infinity : Math.abs(x - px1);
        }
        case "trendline": {
          const a = logicalPriceToXY(d.p1), b = logicalPriceToXY(d.p2);
          if (a.x == null || b.x == null) return Infinity;
          return pointSegDist(x, y, a.x, a.y, b.x, b.y);
        }
        case "ray": {
          const a = logicalPriceToXY(d.p1), b = logicalPriceToXY(d.p2);
          if (a.x == null || b.x == null) return Infinity;
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
          const ex = a.x + (dx / len) * 3000, ey = a.y + (dy / len) * 3000;
          return pointSegDist(x, y, a.x, a.y, ex, ey);
        }
        case "extendedline": {
          const a = logicalPriceToXY(d.p1), b = logicalPriceToXY(d.p2);
          if (a.x == null || b.x == null) return Infinity;
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
          const x1 = a.x - (dx / len) * 3000, y1 = a.y - (dy / len) * 3000;
          const x2 = b.x + (dx / len) * 3000, y2 = b.y + (dy / len) * 3000;
          return pointSegDist(x, y, x1, y1, x2, y2);
        }
        case "infoline":
        case "angle": {
          const a = logicalPriceToXY(d.p1), b = logicalPriceToXY(d.p2);
          if (a.x == null || b.x == null) return Infinity;
          return pointSegDist(x, y, a.x, a.y, b.x, b.y);
        }
        case "crossline": {
          const py = series.priceToCoordinate(d.p1.price);
          const px = chart.timeScale().logicalToCoordinate(d.p1.logical);
          if (py == null || px == null) return Infinity;
          return Math.min(Math.abs(y - py), Math.abs(x - px));
        }
        case "parallelchannel":
        case "fibchannel":
        case "pitchfork": {
          if (!d.points || d.points.length < 2) return Infinity;
          const a = logicalPriceToXY(d.points[0]), b = logicalPriceToXY(d.points[1]);
          if (a.x == null || b.x == null) return Infinity;
          return pointSegDist(x, y, a.x, a.y, b.x, b.y);
        }
        case "fibtimezone":
        case "gannfan": {
          const a = logicalPriceToXY(d.p1);
          if (a.x == null) return Infinity;
          return Math.hypot(x - a.x, y - a.y) < 40 ? 0 : Infinity;
        }
        case "rectangle":
        case "circle":
        case "pricerange":
        case "daterange": {
          const a = logicalPriceToXY(d.p1), b = logicalPriceToXY(d.p2);
          if (a.x == null || b.x == null) return Infinity;
          const x0 = Math.min(a.x, b.x), x1e = Math.max(a.x, b.x);
          const y0 = Math.min(a.y, b.y), y1e = Math.max(a.y, b.y);
          if (x >= x0 && x <= x1e && y >= y0 && y <= y1e) return 0;
          const dx = x < x0 ? x0 - x : x > x1e ? x - x1e : 0;
          const dy = y < y0 ? y0 - y : y > y1e ? y - y1e : 0;
          return Math.hypot(dx, dy);
        }
        case "position_long":
        case "position_short": {
          const a = logicalPriceToXY(d.p1), b = logicalPriceToXY(d.p2);
          if (a.x == null || b.x == null) return Infinity;
          const dist = Math.abs(a.y - b.y);
          const x0 = Math.min(a.x, b.x), x1e = Math.max(a.x, b.x);
          const y0 = Math.min(a.y, b.y) - dist, y1e = Math.max(a.y, b.y) + dist;
          return (x >= x0 && x <= x1e && y >= y0 && y <= y1e) ? 0 : 9999;
        }
        case "fib": {
          const a = logicalPriceToXY(d.p1), b = logicalPriceToXY(d.p2);
          if (a.x == null || b.x == null) return Infinity;
          const style = d.style || {};
          const x0 = Math.min(a.x, b.x), x1e = Math.max(a.x, b.x);
          if (x < x0 - 5 || x > x1e + 5) return Infinity;
          const levels = (style.levels && style.levels.length ? style.levels : [{ value: 0 }, { value: 0.236 }, { value: 0.382 }, { value: 0.5 }, { value: 0.618 }, { value: 0.786 }, { value: 1 }]).filter((l) => l.enabled !== false);
          const priceHigh = Math.max(d.p1.price, d.p2.price);
          const priceLow = Math.min(d.p1.price, d.p2.price);
          let best = Infinity;
          for (const lvl of levels) {
            const py = series.priceToCoordinate(priceHigh - (priceHigh - priceLow) * lvl.value);
            if (py != null) best = Math.min(best, Math.abs(y - py));
          }
          return best;
        }
        case "path":
        case "wave":
        case "fibext": {
          if (!d.points || d.points.length < 2) return Infinity;
          let best = Infinity;
          for (let i = 0; i < d.points.length - 1; i++) {
            const a = logicalPriceToXY(d.points[i]), b = logicalPriceToXY(d.points[i + 1]);
            if (a.x == null || b.x == null) continue;
            best = Math.min(best, pointSegDist(x, y, a.x, a.y, b.x, b.y));
          }
          return best;
        }
        case "text": {
          const p = logicalPriceToXY(d.p1);
          if (p.x == null) return Infinity;
          return Math.hypot(x - p.x, y - p.y);
        }
        default:
          return Infinity;
      }
    } catch {
      return Infinity;
    }
  }
  function findDrawingAt(x, y) {
    let best = null, bestDist = 8;
    for (const d of drawingsRef.current) {
      const dist = distanceToDrawingPx(d, x, y);
      if (dist <= bestDist) { bestDist = dist; best = d; }
    }
    return best;
  }

  /* ===================== سحب وتحريك الرسومات (وضع المؤشر) ===================== */
  function getHandlePoints(d) {
    if (d.points) return d.points.map((p, i) => ({ key: `points.${i}`, p }));
    const out = [];
    if (d.p1) out.push({ key: "p1", p: d.p1 });
    if (d.p2) out.push({ key: "p2", p: d.p2 });
    return out;
  }
  function findHandleAt(x, y) {
    const HANDLE_R = 8;
    let best = null, bestDist = HANDLE_R;
    for (const d of drawingsRef.current) {
      for (const h of getHandlePoints(d)) {
        const xy = logicalPriceToXY(h.p);
        if (xy.x == null || xy.y == null) continue;
        const dist = Math.hypot(x - xy.x, y - xy.y);
        if (dist <= bestDist) { bestDist = dist; best = { drawing: d, key: h.key }; }
      }
    }
    return best;
  }
  function moveDrawingBy(d, dLogical, dPrice) {
    if (d.p1) { d.p1 = { logical: d.p1.logical + dLogical, price: d.p1.price + dPrice }; }
    if (d.p2) { d.p2 = { logical: d.p2.logical + dLogical, price: d.p2.price + dPrice }; }
    if (d.points) d.points = d.points.map((p) => ({ logical: p.logical + dLogical, price: p.price + dPrice }));
  }
  function setHandlePoint(d, key, logical, price) {
    if (key === "p1") d.p1 = { logical, price };
    else if (key === "p2") d.p2 = { logical, price };
    else if (key.startsWith("points.")) {
      const idx = Number(key.split(".")[1]);
      if (d.points && d.points[idx] != null) {
        d.points = d.points.map((p, i) => (i === idx ? { logical, price } : p));
      }
    }
  }
  function openProperties(d) {
    setEditingId(d.id);
    setEditDraft(JSON.parse(JSON.stringify(d)));
  }
  function saveProperties() {
    if (!editDraft) return;
    const idx = drawingsRef.current.findIndex((d) => d.id === editDraft.id);
    if (idx !== -1) drawingsRef.current[idx] = editDraft;
    setEditingId(null);
    setEditDraft(null);
    drawOverlay();
  }
  function deleteEditingDrawing() {
    if (!editDraft) return;
    drawingsRef.current = drawingsRef.current.filter((d) => d.id !== editDraft.id);
    setEditingId(null);
    setEditDraft(null);
    drawOverlay();
  }
  function finishMultiPoint() {
    const pts = pathPointsRef.current;
    const tool = activeToolRef.current;
    if (pts && pts.length >= 2) {
      drawingsRef.current.push({ id: Date.now(), type: tool, points: pts, style: defaultStyleFor(tool) });
    }
    pathPointsRef.current = [];
    liveCursorRef.current = null;
    setActiveTool("cursor");
    drawOverlay();
  }

  function handleClearDrawings() {
    const clearable = drawingsRef.current.filter((d) => !d.tradeTag);
    if (clearable.length === 0) return;
    if (!window.confirm("مسح كل الرسومات من الشارت؟ (خطوط الهدف/الإيقاف لصفقة مفتوحة ما بتتأثر)")) return;
    drawingsRef.current = drawingsRef.current.filter((d) => !!d.tradeTag);
    drawOverlay();
  }
  function toggleDrawingsVisible() { setDrawingsVisible((v) => !v); }
  function handleResetView() {
    chartRef.current?.timeScale().fitContent();
    chartRef.current?.priceScale("right").applyOptions({ autoScale: true });
  }

  const assetInfo = getAssetByValue(assetValue);
  const supported = randomChart || !!assetInfo?.yahoo;

  /* ===================== شراء/بيع فوري مربوط بالباك تيست ===================== */
  function getCurrentPrice() {
    const arr = visibleCandlesRef.current;
    if (arr && arr.length) return arr[arr.length - 1].close;
    return liveLastPrice;
  }

  function openQuickTrade(direction, priceOverride) {
    if (!userId) {
      setTradeToast("سجّلي دخول أول عشان تقدري تسجّلي صفقات بالباك تيست");
      return;
    }
    const price = priceOverride != null ? priceOverride : getCurrentPrice();
    if (!price) {
      setTradeToast("ما في سعر متاح لسا، جربي كمان شوي");
      return;
    }
    if (pendingTradeRef.current) {
      drawingsRef.current = drawingsRef.current.filter((d) => d.tradeTag !== pendingTradeRef.current.tag);
    }
    const tag = "trade_" + Date.now();
    const dist = price * 0.003; // مسافة افتراضية 0.3% تبدأ فيها الخطوط، وبعدين تسحبيها لمكان الهدف/الستوب الصح
    const tp = direction === "buy" ? price + dist : price - dist;
    const sl = direction === "buy" ? price - dist : price + dist;
    const vr = chartRef.current?.timeScale().getVisibleLogicalRange();
    const logical = vr ? vr.to - 2 : (visibleCandlesRef.current.length || 1) - 1;

    drawingsRef.current.push({
      id: Date.now(), type: "hline", p1: { logical, price },
      style: { color: GOLD_LIGHT, width: 1, dash: "solid" }, tradeTag: tag, tradeRole: "entry",
    });
    drawingsRef.current.push({
      id: Date.now() + 1, type: "hline", p1: { logical, price: tp },
      style: { color: GREEN, width: 1.5, dash: "dashed" }, tradeTag: tag, tradeRole: "tp",
    });
    drawingsRef.current.push({
      id: Date.now() + 2, type: "hline", p1: { logical, price: sl },
      style: { color: RED, width: 1.5, dash: "dashed" }, tradeTag: tag, tradeRole: "sl",
    });
    drawOverlay();
    setTradeLot("0.01");
    setPendingTrade({ tag, direction, entry: price, asset: assetValue });
  }

  function cancelQuickTrade() {
    if (pendingTradeRef.current) {
      drawingsRef.current = drawingsRef.current.filter((d) => d.tradeTag !== pendingTradeRef.current.tag);
      drawOverlay();
    }
    setPendingTrade(null);
  }

  async function confirmQuickTrade() {
    const pt = pendingTradeRef.current;
    if (!pt || !userId) return;
    const tpLine = drawingsRef.current.find((d) => d.tradeTag === pt.tag && d.tradeRole === "tp");
    const slLine = drawingsRef.current.find((d) => d.tradeTag === pt.tag && d.tradeRole === "sl");
    const lot = parseFloat(tradeLot) || 0.01;
    const info = getAssetByValue(pt.asset);
    const mult = info?.mult || 1;
    const tp = tpLine?.p1.price ?? pt.entry;
    const sl = slLine?.p1.price ?? pt.entry;
    const riskAmount = Math.abs(pt.entry - sl) * lot * mult;
    const rewardAmount = Math.abs(tp - pt.entry) * lot * mult;
    const rr = riskAmount > 0 ? rewardAmount / riskAmount : 0;
    const riskPercent = accountBalance > 0 ? (riskAmount / accountBalance) * 100 : 0;

    setSavingTrade(true);
    const row = tradeToRow({
      asset: pt.asset,
      date: new Date().toISOString().slice(0, 10),
      direction: pt.direction,
      lot, entry: pt.entry, sl, tp,
      result: "pending",
      setup: "من الريبلاي",
      reason: "",
      riskAmount, rewardAmount, rr, riskPercent,
      isLive: mode === "live",
    }, userId);

    const { data, error } = await supabase.from("trades").insert(row).select().single();
    setSavingTrade(false);
    if (error) {
      setTradeToast("صار خطأ بتسجيل الصفقة: " + error.message);
      return;
    }
    // نحوّل الخطوط لصفقة "مفتوحة" مراقَبة بدل ما نمسحها، عشان تنقفل تلقائي لما يلمس السعر الهدف أو الإيقاف
    openPositionsRef.current.push({
      dbId: data.id, tag: pt.tag, direction: pt.direction, entry: pt.entry, sl, tp, lot,
      riskAmount, rewardAmount, asset: pt.asset,
    });
    setPendingTrade(null);
    setTradeToast(`✅ اتسجلت صفقة ${pt.direction === "buy" ? "شراء" : "بيع"} — بتلاقيها بالباك تيست ولوحة التحكم`);
  }

  async function closeOpenPosition(pos, result, closePrice) {
    openPositionsRef.current = openPositionsRef.current.filter((p) => p.dbId !== pos.dbId);
    drawingsRef.current = drawingsRef.current.filter((d) => d.tradeTag !== pos.tag);
    drawOverlay();
    setTradeToast(
      result === "win"
        ? `🎯 توصلت للهدف — الصفقة اتقفلت ربح`
        : `⛔ توصلت للإيقاف — الصفقة اتقفلت خسارة`
    );
    if (!supabase || !userId) return;
    await supabase
      .from("trades")
      .update({ result, reason: `إغلاق تلقائي من الريبلاي عند ${closePrice.toFixed(2)}` })
      .eq("id", pos.dbId)
      .eq("user_id", userId);
  }

  checkOpenPositionsRef.current = function checkOpenPositions(price) {
    if (!price || openPositionsRef.current.length === 0) return;
    for (const pos of [...openPositionsRef.current]) {
      if (pos.direction === "buy") {
        if (price >= pos.tp) closeOpenPosition(pos, "win", price);
        else if (price <= pos.sl) closeOpenPosition(pos, "loss", price);
      } else {
        if (price <= pos.tp) closeOpenPosition(pos, "win", price);
        else if (price >= pos.sl) closeOpenPosition(pos, "loss", price);
      }
    }
  };

  /* ===================== إنشاء الشارت مرة وحدة ===================== */
  useEffect(() => {
    let cancelled = false;
    async function setup() {
      const { createChart, CrosshairMode } = await import("lightweight-charts");
      if (cancelled || !chartContainerRef.current) return;

      const savedSettings = loadChartSettings();

      const chart = createChart(chartContainerRef.current, {
        layout: { background: { color: savedSettings.bg }, textColor: "#999" },
        grid: { vertLines: { color: "#1a1a1a" }, horzLines: { color: "#1a1a1a" } },
        timeScale: { borderColor: "#222", timeVisible: true },
        rightPriceScale: { borderColor: "#222" },
        width: chartContainerRef.current.clientWidth,
        height: 480,
        /* وضع Normal (مش Magnet) عشان مؤشر السعر يصير "+" حر بيتبع الفأرة فعلياً
           بدل ما يلتصق ويقفز لأقرب سعر شمعة */
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "#8a8a8aa0", width: 1, style: 3, labelBackgroundColor: "#333" },
          horzLine: { color: "#8a8a8aa0", width: 1, style: 3, labelBackgroundColor: "#333" },
        },
      });

      const series = chart.addCandlestickSeries({
        upColor: savedSettings.up, downColor: savedSettings.down, borderVisible: false,
        wickUpColor: savedSettings.up, wickDownColor: savedSettings.down,
      });

      chartRef.current = chart;
      seriesRef.current = series;

      const handleResize = () => {
        if (!chartContainerRef.current) return;
        const isFs = !!document.fullscreenElement;
        let height = 480;
        if (isFs) {
          const headerH = headerRef.current?.offsetHeight || 0;
          // نحسب الارتفاع من المساحة الفعلية المتبقية بالشاشة بدل رقم ثابت
          // عشان شريط الوقت بالأسفل ما يطلع برا الشاشة لما الهيدر ياخد مساحة أكبر
          height = Math.max(320, window.innerHeight - headerH - 28);
        }
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height,
        });
        // مزامنة قياس الـ overlay canvas مع الشارت (للرسومات)
        if (overlayCanvasRef.current) {
          const rect = chartContainerRef.current.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          overlayCanvasRef.current.width = Math.max(1, rect.width * dpr);
          overlayCanvasRef.current.height = Math.max(1, rect.height * dpr);
          overlayCanvasRef.current.style.width = rect.width + "px";
          overlayCanvasRef.current.style.height = rect.height + "px";
        }
        drawOverlay();
      };
      window.addEventListener("resize", handleResize);
      const handleFsChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
        setTimeout(handleResize, 50);
      };
      document.addEventListener("fullscreenchange", handleFsChange);

      /* ===== ربط أحداث الرسم على الـ overlay canvas ===== */
      function getLogicalPrice(clientX, clientY) {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return { logical: null, price: null, x: null, y: null };
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const ts = chart.timeScale();
        const logical = ts.coordinateToLogical(x);
        const price = series.coordinateToPrice(y);
        return { logical, price, x, y };
      }
      const MULTI_POINT_COUNT = { wave: 4, fibext: 3, parallelchannel: 3, fibchannel: 3, pitchfork: 3 };
      function onMouseDown(e) {
        const tool = activeToolRef.current;
        if (tool === "cursor") return; // بوضع المؤشر السحب بيصير من onContainerMouseDownCapture تحت
        const { logical, price, y } = getLogicalPrice(e.clientX, e.clientY);
        if (logical == null || price == null) return;
        const snapped = snapPrice(logical, price, y);

        if (tool === "text") {
          const content = window.prompt("اكتبي النص:");
          if (content) {
            drawingsRef.current.push({ id: Date.now(), type: "text", p1: { logical, price: snapped }, text: content, style: defaultStyleFor("text") });
          }
          setActiveTool("cursor");
          drawOverlay();
          return;
        }
        if (tool === "hline" || tool === "hray" || tool === "vline" || tool === "crossline") {
          drawingsRef.current.push({ id: Date.now(), type: tool, p1: { logical, price: snapped }, style: defaultStyleFor(tool) });
          setActiveTool("cursor");
          drawOverlay();
          return;
        }
        if (tool === "path" || tool === "wave" || tool === "fibext" || tool === "parallelchannel" || tool === "fibchannel" || tool === "pitchfork") {
          pathPointsRef.current.push({ logical, price: snapped });
          const need = MULTI_POINT_COUNT[tool];
          if (need && pathPointsRef.current.length >= need) {
            finishMultiPoint();
          }
          drawOverlay();
          return;
        }
        // نظام النقرات: نقرة أولى تثبّت نقطة البداية وتبلّش معاينة حيّة تتبع الماوس
        // بدون الحاجة لإبقاء الزر مضغوط، ونقرة ثانية عند أي مكان تثبّت الرسمة نهائياً.
        if (isDrawingRef.current && drawStateRef.current && drawStateRef.current.type === tool) {
          const d = drawStateRef.current;
          d.p2 = { logical, price: snapped };
          drawStateRef.current = null;
          isDrawingRef.current = false;
          if (d.type !== "measure") {
            drawingsRef.current.push({ id: Date.now(), ...d });
          }
          setActiveTool("cursor");
          drawOverlay();
          return;
        }
        drawStateRef.current = { type: tool, p1: { logical, price: snapped }, p2: { logical, price: snapped }, style: defaultStyleFor(tool) };
        isDrawingRef.current = true;
        drawOverlay();
      }
      function onMouseMove(e) {
        // وضع المؤشر: تلوين مؤشر الفأرة لما يكون فوق رسمة (يد) عشان يبين إنها قابلة للسحب،
        // وتحديث موقع الرسمة إذا كان في سحب جاري حالياً
        if (activeToolRef.current === "cursor") {
          if (dragStateRef.current) {
            const st = dragStateRef.current;
            const { logical, price, y } = getLogicalPrice(e.clientX, e.clientY);
            if (logical == null || price == null) return;
            const d = drawingsRef.current.find((dr) => dr.id === st.id);
            if (!d) return;
            if (st.mode === "move") {
              const dLogical = logical - st.lastLogical;
              const dPrice = price - st.lastPrice;
              moveDrawingBy(d, dLogical, dPrice);
              st.lastLogical = logical;
              st.lastPrice = price;
            } else if (st.mode === "handle") {
              const snapped = snapPrice(logical, price, y);
              setHandlePoint(d, st.key, logical, snapped);
            }
            if (d.tradeTag) setDragTick((t) => t + 1);
            drawOverlay();
            return;
          }
          const { x, y } = getLogicalPrice(e.clientX, e.clientY);
          if (x != null && y != null && chartContainerRef.current) {
            const hit = findHandleAt(x, y) || (findDrawingAt(x, y) ? { key: "body" } : null);
            chartContainerRef.current.style.cursor = hit ? "move" : "default";
          }
          return;
        }
        const activePath = (activeToolRef.current === "path" || activeToolRef.current === "wave" || activeToolRef.current === "fibext") && pathPointsRef.current.length;
        if (!isDrawingRef.current && !activePath) return;
        const { logical, price, y } = getLogicalPrice(e.clientX, e.clientY);
        if (logical == null || price == null) return;
        const snapped = snapPrice(logical, price, y);
        if (isDrawingRef.current && drawStateRef.current) {
          drawStateRef.current.p2 = { logical, price: snapped };
        }
        if (activePath) {
          liveCursorRef.current = { logical, price: snapped };
        }
        drawOverlay();
      }
      function onMouseUp() {
        // ما عاد في تثبيت بالسحب/الإفلات — الرسم صار بنظام نقرة ثم نقرة (كليك ثم كليك)،
        // فهون بس منسكّر سحب الرسومات الموجودة بوضع المؤشر (تحريك/تعديل نقاط رسمة قائمة).
        if (dragStateRef.current) {
          dragStateRef.current = null;
          chart.applyOptions({ handleScroll: true, handleScale: true });
          drawOverlay();
        }
      }
      /* سحب رسمة موجودة بوضع المؤشر: نمسك الحدث بمرحلة الـ capture قبل ما يوصل لمكتبة
         الشارت (اللي بتستخدمه للتحريك/الزوم)، فإذا كان في رسمة تحت المؤشر منوقف التحريك
         الافتراضي للشارت ومنبلش سحب الرسمة، وإلا منسيب الحدث يكمل طبيعي (بان/زوم عادي) */
      function onContainerMouseDownCapture(e) {
        if (activeToolRef.current !== "cursor" || e.button !== 0) return;
        const { logical, price, x, y } = getLogicalPrice(e.clientX, e.clientY);
        if (x == null || y == null) return;
        const handleHit = findHandleAt(x, y);
        if (handleHit) {
          e.preventDefault();
          e.stopPropagation();
          dragStateRef.current = { mode: "handle", id: handleHit.drawing.id, key: handleHit.key };
          chart.applyOptions({ handleScroll: false, handleScale: false });
          return;
        }
        const hit = findDrawingAt(x, y);
        if (hit) {
          e.preventDefault();
          e.stopPropagation();
          dragStateRef.current = { mode: "move", id: hit.id, lastLogical: logical, lastPrice: price };
          chart.applyOptions({ handleScroll: false, handleScale: false });
        }
      }
      function onKeyDown(e) {
        if (e.key === "Escape") {
          isDrawingRef.current = false;
          drawStateRef.current = null;
          pathPointsRef.current = [];
          liveCursorRef.current = null;
          if (dragStateRef.current) {
            dragStateRef.current = null;
            chart.applyOptions({ handleScroll: true, handleScale: true });
          }
          setActiveTool("cursor");
          drawOverlay();
        } else if (e.key === "Enter" && activeToolRef.current === "path" && pathPointsRef.current.length >= 2) {
          finishMultiPoint();
        }
      }
      function onDblClickOverlay() {
        if (activeToolRef.current === "path" && pathPointsRef.current.length >= 2) {
          finishMultiPoint();
        }
      }
      function onContainerDblClick(e) {
        if (activeToolRef.current !== "cursor") return;
        const { x, y } = getLogicalPrice(e.clientX, e.clientY);
        if (x == null || y == null) return;
        const hit = findDrawingAt(x, y);
        if (hit && !hit.tradeTag) openProperties(hit);
      }
      /* كليك يمين عالشارت: قائمة سياق (نسخ السعر، شراء/بيع فوري، إعدادات الألوان، إلخ) */
      function onContextMenu(e) {
        e.preventDefault();
        const { price } = getLogicalPrice(e.clientX, e.clientY);
        const areaRect = chartAreaRef.current?.getBoundingClientRect();
        const x = areaRect ? e.clientX - areaRect.left : e.clientX;
        const y = areaRect ? e.clientY - areaRect.top : e.clientY;
        setContextMenu({ x, y, price: price != null ? price : null });
      }

      const overlayEl = overlayCanvasRef.current;
      const containerEl = chartContainerRef.current;
      overlayEl?.addEventListener("mousedown", onMouseDown);
      overlayEl?.addEventListener("dblclick", onDblClickOverlay);
      containerEl?.addEventListener("dblclick", onContainerDblClick);
      containerEl?.addEventListener("mousedown", onContainerMouseDownCapture, { capture: true });
      overlayEl?.addEventListener("contextmenu", onContextMenu);
      containerEl?.addEventListener("contextmenu", onContextMenu);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("keydown", onKeyDown);
      chart.timeScale().subscribeVisibleLogicalRangeChange(drawOverlay);
      chart.subscribeCrosshairMove(drawOverlay);

      chart.__cleanup = () => {
        window.removeEventListener("resize", handleResize);
        document.removeEventListener("fullscreenchange", handleFsChange);
        overlayEl?.removeEventListener("mousedown", onMouseDown);
        overlayEl?.removeEventListener("dblclick", onDblClickOverlay);
        containerEl?.removeEventListener("dblclick", onContainerDblClick);
        containerEl?.removeEventListener("mousedown", onContainerMouseDownCapture, { capture: true });
        overlayEl?.removeEventListener("contextmenu", onContextMenu);
        containerEl?.removeEventListener("contextmenu", onContextMenu);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("keydown", onKeyDown);
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(drawOverlay);
        chart.unsubscribeCrosshairMove(drawOverlay);
      };
      chart.__resize = handleResize;
      handleResize();
    }
    setup();
    return () => {
      cancelled = true;
      if (chartRef.current) {
        chartRef.current.__cleanup?.();
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  /* ===================== تبديل الفل سكرين ===================== */
  function toggleFullscreen() {
    if (!chartWrapperRef.current) return;
    if (!document.fullscreenElement) {
      chartWrapperRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  /* لما محتوى شريط التحكم العلوي بيتغيّر بوضع الفل سكرين (تبديل وضع/وضع القص/سرعة...)
     ممكن يتغيّر ارتفاعه، فلازم نعيد حساب ارتفاع الشارت عشان شريط الوقت السفلي يضل ظاهر بالكامل */
  useEffect(() => {
    if (isFullscreen) {
      const t = setTimeout(() => chartRef.current?.__resize?.(), 30);
      return () => clearTimeout(t);
    }
  }, [isFullscreen, mode, cutMode, randomChart, assetValue, interval, maxBars, speed, isPlaying, loading]);

  /* ===================== جلب البيانات ===================== */
  const loadData = useCallback(async () => {
    stopLivePoll();
    setLoading(true);
    setError("");
    setIsPlaying(false);
    drawingsRef.current = [];
    drawStateRef.current = null;

    if (randomChart) {
      const candles = generateRandomCandles(maxBars, interval);
      setAllCandles(candles);
      if (mode === "training") {
        const maxStart = Math.max(CONTEXT_BARS, candles.length - 100);
        const start = Math.floor(Math.random() * (maxStart - CONTEXT_BARS + 1)) + CONTEXT_BARS;
        setRevealCount(Math.min(start, candles.length));
      } else {
        setRevealCount(candles.length);
      }
      setLoading(false);
      if (mode === "live") startLivePoll(candles);
      return;
    }

    if (!assetInfo?.yahoo) {
      setError("هذا الأصل غير مدعوم حالياً لعرض الشموع (لا يوجد مصدر بيانات تاريخية له بعد).");
      setAllCandles([]);
      setLoading(false);
      return;
    }

    try {
      const tdInterval = INTERVAL_MAP[interval];
      const res = await fetch(
        `/api/replay-candles?symbol=${encodeURIComponent(assetInfo.yahoo)}&interval=${tdInterval}&count=${maxBars}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const candles = sanitizeCandles(data.candles || []);
      if (candles.length === 0) throw new Error("لا توجد بيانات متاحة لهذا الأصل/الفريم حالياً");

      setAllCandles(candles);

      if (mode === "training") {
        const maxStart = Math.max(CONTEXT_BARS, candles.length - 100);
        const start = Math.floor(Math.random() * (maxStart - CONTEXT_BARS + 1)) + CONTEXT_BARS;
        setRevealCount(Math.min(start, candles.length));
      } else {
        setRevealCount(candles.length);
        startLivePoll(candles);
      }
    } catch (e) {
      setError(e.message || "صار خطأ، حاولي مرة تانية");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetValue, interval, mode, maxBars, randomChart]);

  useEffect(() => {
    loadData();
    return () => { stopLivePoll(); stopCountdownTick(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  /* ===================== تحديث الشارت ===================== */
  const prevRevealRef = useRef(0);
  const prevCandlesRef = useRef(null);
  useEffect(() => {
    if (!seriesRef.current || allCandles.length === 0) return;
    const prevLen = prevCandlesRef.current?.length ?? -1;
    const prevReveal = prevRevealRef.current;

    // وضع التدريب: خطوة وحدة للأمام (تشغيل تلقائي / الشمعة التالية) بنفس مصفوفة الشموع
    const trainingStep = mode === "training" && allCandles.length === prevLen && revealCount === prevReveal + 1;
    // وضع السوق الحي: كل بولينغ (كل 5 ثواني) إما بيحدّث آخر شمعة أو بيضيف شمعة جديدة بس
    const liveTick = mode === "live" && revealCount === allCandles.length && (allCandles.length === prevLen || allCandles.length === prevLen + 1);

    try {
      if (trainingStep || liveTick) {
        // نضيف/نحدّث الشمعة الأخيرة بس، من دون setData/fitContent
        // عشان ما يصير "رجوع" أو ريست مزعج للزوم والسكرول يلي عم تتفرجي عليه
        seriesRef.current.update(allCandles[revealCount - 1]);
        checkOpenPositionsRef.current?.(allCandles[revealCount - 1].close);
      } else {
        // تحميل بيانات جديدة أو قفزة كبيرة (تبديل وضع/أصل/فريم/بداية عشوائية/قص نقطة/إعادة من البداية)
        seriesRef.current.setData(allCandles.slice(0, revealCount));
        chartRef.current?.timeScale().fitContent();
      }
    } catch (err) {
      // بيانات فاسدة وصلت رغم التصفية (مصدر خارجي غير متوقع) - نعرض رسالة بدل ما نكسر الصفحة
      console.error("chart data error:", err);
      setError("صار خطأ بعرض بيانات هالفريم، جربي فريم/أصل تاني أو حدّثي الصفحة.");
    }
    prevRevealRef.current = revealCount;
    prevCandlesRef.current = allCandles;
    drawOverlay();
  }, [revealCount, allCandles, mode]);

  /* ===================== وضع سوق حي: متابعة الشمعة الحالية بعداد ===================== */
  function stopLivePoll() {
    if (livePollRef.current) clearInterval(livePollRef.current);
    livePollRef.current = null;
    stopCountdownTick();
  }
  function stopCountdownTick() {
    if (countdownTickRef.current) clearInterval(countdownTickRef.current);
    countdownTickRef.current = null;
  }

  function startCountdownTick() {
    stopCountdownTick();
    const tick = () => {
      const { end, stepMs, now } = getCurrentBarWindow(interval);
      const remain = Math.max(0, end - now);
      setCountdown(formatCountdown(remain));
      setCountdownProgress(1 - remain / stepMs);
    };
    tick();
    countdownTickRef.current = setInterval(tick, 1000);
  }

  async function pollLiveOnce() {
    if (randomChart) {
      // بمحاكاة الشارت العشوائي، نولّد حركة سعر بسيطة على آخر شمعة
      setAllCandles((prev) => {
        if (prev.length === 0) return prev;
        const last = { ...prev[prev.length - 1] };
        const vol = last.close * 0.001;
        last.close = Math.max(0.01, last.close + (Math.random() - 0.5) * vol * 2);
        last.high = Math.max(last.high, last.close);
        last.low = Math.min(last.low, last.close);
        const updated = [...prev.slice(0, -1), last];
        seriesRef.current?.update(last);
        updateLivePrice(last.close);
        return updated;
      });
      return;
    }
    if (!assetInfo?.yahoo) return;
    try {
      const tdInterval = INTERVAL_MAP[interval];
      const res = await fetch(
        `/api/replay-candles?symbol=${encodeURIComponent(assetInfo.yahoo)}&interval=${tdInterval}&count=3`
      );
      const data = await res.json();
      if (data.error || !data.candles?.length) return;
      const fresh = sanitizeCandles(data.candles);
      if (fresh.length === 0) return;
      const lastFresh = fresh[fresh.length - 1];

      setAllCandles((prev) => {
        if (prev.length === 0) return prev;
        const merged = [...prev];
        // لو نفس وقت آخر شمعة عندنا - تحديث فقط. لو وقت جديد - إضافة شمعة جديدة
        if (merged[merged.length - 1].time === lastFresh.time) {
          merged[merged.length - 1] = lastFresh;
        } else if (lastFresh.time > merged[merged.length - 1].time) {
          merged.push(lastFresh);
        } else {
          return prev; // وقت أقدم من عندنا (بيانات غير متسلسلة) - نتجاهله بدل ما نكسر الشارت
        }
        try {
          seriesRef.current?.update(merged[merged.length - 1]);
        } catch (err) {
          console.error("live update error:", err);
        }
        setRevealCount(merged.length);
        return merged;
      });
      forminCandleStartRef.current = lastFresh.time;
      updateLivePrice(lastFresh.close);
    } catch (e) {
      /* تجاهل خطأ تحديث واحد، رح يعيد المحاولة بالدورة الجاية */
    }
  }

  function startLivePoll(initialCandles) {
    stopLivePoll();
    if (initialCandles?.length) {
      forminCandleStartRef.current = initialCandles[initialCandles.length - 1].time;
      updateLivePrice(initialCandles[initialCandles.length - 1].close);
    }
    startCountdownTick();
    pollLiveOnce();
    livePollRef.current = setInterval(pollLiveOnce, 5000);
  }

  /* ===================== وضع تدريب (خطوة خطوة) ===================== */
  function handleNext() {
    setRevealCount((c) => Math.min(c + 1, allCandles.length));
  }
  function handleRandomStart() {
    loadData();
  }
  function handleReset() {
    const maxStart = Math.max(CONTEXT_BARS, allCandles.length - 100);
    setRevealCount(Math.min(CONTEXT_BARS, maxStart));
    setIsPlaying(false);
  }
  function togglePlay() {
    setIsPlaying((p) => !p);
  }
  useEffect(() => {
    if (!isPlaying) { clearInterval(playTimerRef.current); return; }
    playTimerRef.current = setInterval(() => {
      setRevealCount((c) => {
        if (c >= allCandles.length) { setIsPlaying(false); return c; }
        return c + 1;
      });
    }, speed);
    return () => clearInterval(playTimerRef.current);
  }, [isPlaying, speed, allCandles.length]);

  function switchMode(m) {
    setMode(m);
  }

  /* ===================== أداة القص: اختيار نقطة بداية الريبلاي بالضغط على الشارت ===================== */
  useEffect(() => {
    if (!chartRef.current || !cutMode) return;
    const handler = (param) => {
      if (!param?.time || allCandles.length === 0) return;
      let idx = allCandles.findIndex((c) => c.time === param.time);
      if (idx === -1) {
        for (let i = 0; i < allCandles.length; i++) {
          if (allCandles[i].time <= param.time) idx = i; else break;
        }
      }
      if (idx === -1) return;
      stopLivePoll();
      setMode("training");
      setIsPlaying(false);
      setRevealCount(idx + 1);
      setCutMode(false);
    };
    chartRef.current.subscribeClick(handler);
    return () => chartRef.current?.unsubscribeClick?.(handler);
  }, [cutMode, allCandles]);

  function toggleCutMode() {
    setCutMode((c) => !c);
  }

  /* ===================== قص/تصدير الشارت كصورة ===================== */
  function handleExportImage() {
    if (!chartRef.current) return;
    try {
      const canvas = chartRef.current.takeScreenshot();
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `qta-chart-${assetValue}-${interval}-${Date.now()}.png`;
      a.click();
    } catch (e) {
      alert("تعذّر تصدير الصورة، حاولي مرة تانية");
    }
  }

  const finished = mode === "training" && allCandles.length > 0 && revealCount >= allCandles.length;

  /* أزرار وضع العرض (سوق حي / تدريب) + عشوائي + قص/تصدير + قص نقطة بداية + فل سكرين */
  function renderTopBar() {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.8rem" }}>
        <button onClick={() => switchMode("live")} style={tabStyle(mode === "live")}>📡 سوق حي</button>
        <button onClick={() => switchMode("training")} style={tabStyle(mode === "training")}>🎯 تدريب / ريبلاي</button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setRandomChart((r) => !r)}
          style={{ ...tabStyle(randomChart), background: randomChart ? `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})` : "transparent", color: randomChart ? "#1a1200" : GOLD }}
          title="تدريب أعمى على حركة سعر مولّدة عشوائياً بدل السوق الحقيقي"
        >
          🎲 شارت عشوائي
        </button>
        <button
          onClick={toggleCutMode}
          style={{ ...tabStyle(cutMode), background: cutMode ? `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})` : "transparent", color: cutMode ? "#1a1200" : GOLD }}
          title="اضغطي الزر، وبعدين دوسي على أي شمعة بالشارت لتبلّشي الريبلاي منها"
          disabled={!supported || allCandles.length === 0}
        >
          ✂️ {cutMode ? "دوسي على الشارت..." : "اختيار نقطة البداية"}
        </button>
        <button onClick={handleExportImage} style={tabStyle(false)}>📷 تصدير كصورة</button>
        <button onClick={handleResetView} style={tabStyle(false)} title="إعادة الزوم والسكرول لوضعهم الطبيعي">
          ⟲ إعادة تعيين الشارت
        </button>
        <button onClick={toggleFullscreen} style={tabStyle(isFullscreen)} title="فل سكرين">
          {isFullscreen ? "⤡ خروج من الفل سكرين" : "⤢ فل سكرين"}
        </button>
        <button onClick={() => setSettingsOpen(true)} style={tabStyle(false)} title="ألوان الشارت (الخلفية وألوان الشموع)">
          ⚙️ إعدادات الشارت
        </button>
      </div>
    );
  }

  /* شريط أدوات الرسم العمودي (ستايل تريدنغ فيو) — ثابت عالشمال دايماً بغض النظر عن اتجاه الصفحة */
  function renderDrawToolbar() {
    return (
      <div style={{
        position: "absolute", top: 10, left: 10, zIndex: 10,
        display: "flex", flexDirection: "column", gap: 4,
        background: "#1a1a1a", border: "1px solid #2f2f2f", borderRadius: 12, padding: 7,
        boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
        maxHeight: "94%", overflowY: "auto",
      }}>
        {TOOL_GROUPS.map((group, gi) => (
          <div key={gi} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {gi > 0 && <div style={{ height: 1, background: "#333", margin: "3px 4px" }} />}
            {group.map((id) => (
              <button
                key={id}
                type="button"
                title={TOOL_TITLES[id]}
                onClick={(e) => { e.stopPropagation(); setActiveTool((cur) => (cur === id ? "cursor" : id)); }}
                style={toolBtnStyle(activeTool === id)}
              >
                <ToolIcon id={id} />
              </button>
            ))}
          </div>
        ))}
        <div style={{ height: 1, background: "#333", margin: "3px 4px" }} />
        <button
          type="button"
          title={`مغناطيس: ${magnetOn ? "مفعّل" : "معطّل"} — يلتصق بأقرب سعر فقط لما تقربي منه فعلاً (حساسية خفيفة)`}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMagnetOn((m) => !m); }}
          style={{ ...toolBtnStyle(magnetOn), position: "relative" }}
        >
          <ToolIcon id="magnet" />
          <span style={{
            position: "absolute", bottom: 2, right: 3, width: 7, height: 7, borderRadius: "50%",
            background: magnetOn ? GREEN : "#555", border: "1px solid #1a1a1a",
          }} />
        </button>
        <button type="button" title={drawingsVisible ? "إخفاء الرسومات" : "إظهار الرسومات"} onClick={(e) => { e.stopPropagation(); toggleDrawingsVisible(); }} style={toolBtnStyle(!drawingsVisible)}>
          <ToolIcon id={drawingsVisible ? "eye" : "eyeOff"} />
        </button>
        <button type="button" title="حذف كل الرسومات" onClick={(e) => { e.stopPropagation(); handleClearDrawings(); }} style={toolBtnStyle(false)}>
          <ToolIcon id="trash" />
        </button>
      </div>
    );
  }

  /* لوحة خصائص الرسمة المحددة (تظهر بضغطة دبل-كليك على أي رسمة بوضع المؤشر) */
  function renderPropertiesDialog() {
    if (!editDraft) return null;
    const type = editDraft.type;
    const style = editDraft.style || {};
    const updateStyle = (patch) => setEditDraft((d) => ({ ...d, style: { ...d.style, ...patch } }));
    const titleMap = {
      trendline: "خط اتجاه", ray: "شعاع", extendedline: "خط ممتد", infoline: "خط معلومات", angle: "زاوية الاتجاه",
      hline: "خط أفقي", hray: "شعاع أفقي", vline: "خط عمودي", crossline: "خط متقاطع", parallelchannel: "قناة متوازية",
      path: "مسار", rectangle: "مستطيل", circle: "دائرة",
      fib: "فيبوناتشي (تصحيح)", fibext: "فيبوناتشي (امتداد)", fibchannel: "قناة فيبوناتشي",
      fibtimezone: "مناطق فيبوناتشي الزمنية", gannfan: "مروحة غان", pitchfork: "شوكة أندروز",
      wave: "موجة تصحيح (0،A،B،C)",
      pricerange: "نطاق السعر", daterange: "نطاق التاريخ", position_long: "مركز شراء", position_short: "مركز بيع",
      text: "نص",
    };
    const row = (label, control) => (
      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #262626" }}>
        <span style={{ fontSize: 13, color: "#ccc" }}>{label}</span>
        {control}
      </div>
    );
    const colorInput = (val, onChange) => (
      <input type="color" value={val || GOLD_LIGHT} onChange={(e) => onChange(e.target.value)}
        style={{ width: 34, height: 26, border: "1px solid #333", borderRadius: 6, background: "none", cursor: "pointer", padding: 0 }} />
    );
    const widthSelect = (val, onChange) => (
      <select value={val || 1.5} onChange={(e) => onChange(Number(e.target.value))} style={selectStyle}>
        {[1, 1.5, 2, 3, 4].map((w) => (<option key={w} value={w}>{w}</option>))}
      </select>
    );
    const checkbox = (val, onChange) => (
      <input type="checkbox" checked={!!val} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18 }} />
    );
    const dashSelect = (val, onChange) => (
      <select value={val || "solid"} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        <option value="solid">متصل</option>
        <option value="dashed">متقطع</option>
        <option value="dotted">منقّط</option>
      </select>
    );
    const extendSelect = (val, onChange) => (
      <select value={val || "none"} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        <option value="none">بدون تمديد</option>
        <option value="right">تمديد لليمين</option>
        <option value="left">تمديد لليسار</option>
        <option value="both">تمديد الجهتين</option>
      </select>
    );
    /* محرر مستويات فيبوناتشي — نفس فكرة لوحة تريدنغ فيو: تفعيل/تعطيل + قيمة + لون لكل مستوى */
    const levelsEditor = () => {
      const levels = style.levels || [];
      const updateLevel = (idx, patch) => {
        const next = levels.map((l, i) => (i === idx ? { ...l, ...patch } : l));
        updateStyle({ levels: next });
      };
      return (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 12, color: "#999", padding: "6px 0 4px" }}>المستويات (فعّلي/عطّلي، غيّري القيمة واللون لكل واحد)</div>
          {levels.map((lvl, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
              {checkbox(lvl.enabled, (v) => updateLevel(i, { enabled: v }))}
              {colorInput(lvl.color, (v) => updateLevel(i, { color: v }))}
              <input
                type="number" step="0.001" value={lvl.value}
                onChange={(e) => updateLevel(i, { value: Number(e.target.value) })}
                style={{ ...selectStyle, width: 80, flex: 1 }}
              />
              <button
                onClick={() => updateStyle({ levels: levels.filter((_, j) => j !== i) })}
                style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 13 }}
                title="حذف هذا المستوى"
              >✕</button>
            </div>
          ))}
          <button
            onClick={() => updateStyle({ levels: [...levels, { value: 0, color: GOLD_LIGHT, enabled: true }] })}
            style={{ ...btnStyle("secondary"), width: "100%", marginTop: 6, padding: "0.4rem", fontSize: 12.5 }}
          >+ إضافة مستوى</button>
        </div>
      );
    };

    return (
      <div style={{
        position: "absolute", top: 10, left: 68, zIndex: 20, width: 300,
        background: "#1a1a1a", border: "1px solid #333", borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)", padding: 14, color: "#eee",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <button onClick={() => { setEditingId(null); setEditDraft(null); }} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 16 }}>✕</button>
          <div style={{ fontWeight: 700, fontSize: 14 }}>✏️ {titleMap[type] || type}</div>
        </div>
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {(type === "trendline" || type === "ray") && (
            <>
              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
              {type === "trendline" && row("التمديد", extendSelect(style.extend, (v) => updateStyle({ extend: v })))}
            </>
          )}
          {type === "extendedline" && (
            <>
              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
            </>
          )}
          {(type === "infoline" || type === "angle") && (
            <>
              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
            </>
          )}
          {(type === "hline" || type === "hray" || type === "vline" || type === "crossline") && (
            <>
              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
              {row("النمط", dashSelect(style.dash, (v) => updateStyle({ dash: v })))}
            </>
          )}
          {type === "parallelchannel" && (
            <>
              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
              {row("تعبئة الخلفية", checkbox(style.fill, (v) => updateStyle({ fill: v })))}
              {style.fill && row("لون الخلفية", colorInput(style.fillColor, (v) => updateStyle({ fillColor: v })))}
            </>
          )}
          {(type === "fibtimezone" || type === "gannfan" || type === "pitchfork") && (
            <>
              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
              {type === "fibtimezone" && row("النمط", dashSelect(style.dash, (v) => updateStyle({ dash: v })))}
            </>
          )}
          {(type === "rectangle" || type === "circle" || type === "path") && (
            <>
              {row("لون الإطار", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
              {type === "path" && row("إغلاق الشكل", checkbox(style.closed, (v) => updateStyle({ closed: v })))}
              {row("تعبئة الخلفية", checkbox(style.fill, (v) => updateStyle({ fill: v })))}
              {style.fill && row("لون الخلفية", colorInput(style.fillColor, (v) => updateStyle({ fillColor: v })))}
              {type === "rectangle" && row("خط المنتصف (50%)", checkbox(style.midline, (v) => updateStyle({ midline: v })))}
              {type === "rectangle" && style.midline && row("لون خط 50%", colorInput(style.midlineColor, (v) => updateStyle({ midlineColor: v })))}
              {type === "rectangle" && style.midline && row("خط متقطع", checkbox(style.midlineDash !== false, (v) => updateStyle({ midlineDash: v })))}
            </>
          )}
          {(type === "pricerange" || type === "daterange") && (
            <>
              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("تعبئة الخلفية", checkbox(style.fill, (v) => updateStyle({ fill: v })))}
              {style.fill && row("لون الخلفية", colorInput(style.fillColor, (v) => updateStyle({ fillColor: v })))}
            </>
          )}
          {(type === "position_long" || type === "position_short") && (
            <>
              {row("لون الهدف", colorInput(style.targetColor, (v) => updateStyle({ targetColor: v })))}
              {row("لون وقف الخسارة", colorInput(style.stopColor, (v) => updateStyle({ stopColor: v })))}
            </>
          )}
          {(type === "fib" || type === "fibchannel") && (
            <>
              {row("لون افتراضي", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
              {type === "fib" && row("التمديد", extendSelect(style.extend, (v) => updateStyle({ extend: v })))}
              {levelsEditor()}
            </>
          )}
          {type === "fibext" && (
            <>
              {row("لون افتراضي", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
              {row("تمديد الخطوط يميناً", (
                <select value={style.extend || "right"} onChange={(e) => updateStyle({ extend: e.target.value })} style={selectStyle}>
                  <option value="right">تمديد لليمين</option>
                  <option value="none">بدون تمديد</option>
                </select>
              ))}
              {levelsEditor()}
            </>
          )}
          {type === "wave" && (
            <>{row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}</>
          )}
          {type === "text" && (
            <>
              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("حجم الخط", (
                <select value={style.size || 13} onChange={(e) => updateStyle({ size: Number(e.target.value) })} style={selectStyle}>
                  {[10, 12, 13, 15, 18, 22].map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              ))}
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={saveProperties} style={{ ...btnStyle("primary"), flex: 1, padding: "0.5rem" }}>موافق</button>
          <button onClick={() => { setEditingId(null); setEditDraft(null); }} style={{ ...btnStyle("secondary"), flex: 1, padding: "0.5rem" }}>إلغاء</button>
        </div>
        <button onClick={deleteEditingDrawing} style={{ marginTop: 8, width: "100%", background: "none", border: "1px solid #7a2b2b", color: RED, borderRadius: 8, padding: "0.4rem", cursor: "pointer", fontSize: 12.5 }}>
          🗑 حذف هذه الرسمة
        </button>
      </div>
    );
  }

  /* أدوات التحكم (الأصل/الفريم/السرعة + أزرار الريبلاي) */
  /* لوحة تأكيد الصفقة الفورية: بتظهر بعد الضغط على شراء/بيع، فيها اللوت وأسعار الهدف/الإيقاف
     (بتتحدث لحظياً وقت ما تسحبي الخطين عالشارت) وزرّي تأكيد/إلغاء */
  function renderTradePanel() {
    if (!pendingTrade) return null;
    const tpLine = drawingsRef.current.find((d) => d.tradeTag === pendingTrade.tag && d.tradeRole === "tp");
    const slLine = drawingsRef.current.find((d) => d.tradeTag === pendingTrade.tag && d.tradeRole === "sl");
    const tp = tpLine?.p1.price, sl = slLine?.p1.price;
    const lot = parseFloat(tradeLot) || 0;
    const info = getAssetByValue(pendingTrade.asset);
    const mult = info?.mult || 1;
    const riskAmount = sl != null ? Math.abs(pendingTrade.entry - sl) * lot * mult : 0;
    const rewardAmount = tp != null ? Math.abs(tp - pendingTrade.entry) * lot * mult : 0;
    const rr = riskAmount > 0 ? (rewardAmount / riskAmount).toFixed(2) : "-";
    const isBuy = pendingTrade.direction === "buy";
    return (
      <div style={{
        position: "absolute", top: 10, right: 10, zIndex: 12, width: 240,
        background: "#161616", border: `1px solid ${isBuy ? GREEN : RED}66`, borderRadius: 12,
        padding: 14, boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
      }}>
        <div style={{ fontWeight: 700, color: isBuy ? GREEN : RED, marginBottom: 8, fontSize: 14 }}>
          {isBuy ? "🟢 صفقة شراء" : "🔴 صفقة بيع"} — {pendingTrade.asset}
        </div>
        <div style={{ fontSize: 12.5, color: "#ccc", lineHeight: 1.9 }}>
          سعر الدخول: <b style={{ color: GOLD_LIGHT }}>{pendingTrade.entry.toFixed(2)}</b><br />
          🎯 الهدف: <b style={{ color: GREEN }}>{tp != null ? tp.toFixed(2) : "-"}</b><br />
          ⛔ الإيقاف: <b style={{ color: RED }}>{sl != null ? sl.toFixed(2) : "-"}</b><br />
          نسبة R:R: <b style={{ color: GOLD_LIGHT }}>{rr}</b>
        </div>
        <div style={{ fontSize: 11, color: "#888", margin: "8px 0 4px" }}>
          اسحبي خط الهدف الأخضر أو خط الإيقاف الأحمر عالشارت لتظبطي مكانهم بالظبط
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#999", marginTop: 6 }}>
          اللوت
          <input
            type="number" step="0.01" min="0.01" value={tradeLot}
            onChange={(e) => setTradeLot(e.target.value)}
            style={{ ...selectStyle, minWidth: 0, width: "100%" }}
          />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={confirmQuickTrade} disabled={savingTrade} style={{ ...btnStyle("primary"), flex: 1 }}>
            {savingTrade ? "...جاري الحفظ" : "✔ تأكيد وتسجيل"}
          </button>
          <button onClick={cancelQuickTrade} disabled={savingTrade} style={{ ...btnStyle("secondary"), flex: 1 }}>
            ✕ إلغاء
          </button>
        </div>
      </div>
    );
  }

  /* توست صغير لتأكيد/تنبيه نتيجة عمليات الصفقة الفورية */
  function renderTradeToast() {
    if (!tradeToast) return null;
    return (
      <div style={{
        position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", zIndex: 15,
        background: "#161616", border: `1px solid ${GOLD}55`, borderRadius: 10,
        padding: "0.55rem 1rem", fontSize: 12.5, color: "#eee", boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
        maxWidth: "90%", textAlign: "center",
      }}>
        {tradeToast}
      </div>
    );
  }

  /* قائمة الكليك يمين عالشارت (ستايل تريدنغ فيو): شراء/بيع فوري بالسعر يلي ضغطتي عليه،
     نسخ السعر، إعادة تعيين الشارت، إعدادات الألوان، حذف الرسومات */
  function renderContextMenu() {
    if (!contextMenu) return null;
    const price = contextMenu.price;
    const item = (label, onClick, extra) => (
      <div
        onClick={() => { onClick(); setContextMenu(null); }}
        style={{
          padding: "9px 14px", fontSize: 13, color: "#e5e5e5", cursor: "pointer",
          display: "flex", justifyContent: "space-between", gap: 10, whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#262626")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span>{label}</span>
        {extra && <span style={{ color: "#888" }}>{extra}</span>}
      </div>
    );
    const sep = <div style={{ height: 1, background: "#2a2a2a", margin: "5px 0" }} />;
    return (
      <div
        style={{
          position: "absolute", top: contextMenu.y, left: contextMenu.x, zIndex: 20,
          background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: "6px 0",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)", minWidth: 220,
        }}
      >
        {price != null && (
          <>
            {item("🟢 شراء فوري هون", () => openQuickTrade("buy", price), price.toFixed(2))}
            {item("🔴 بيع فوري هون", () => openQuickTrade("sell", price), price.toFixed(2))}
            {item("نسخ السعر", () => navigator.clipboard?.writeText(price.toFixed(2)))}
            {sep}
          </>
        )}
        {item("⟲ إعادة تعيين الشارت", handleResetView)}
        {item(drawingsVisible ? "إخفاء الرسومات" : "إظهار الرسومات", toggleDrawingsVisible)}
        {item("🗑 حذف كل الرسومات", handleClearDrawings)}
        {sep}
        {item("⚙️ إعدادات الألوان", () => setSettingsOpen(true))}
      </div>
    );
  }

  /* نافذة إعدادات ألوان الشارت: خلفية الشارت + لون شمعة الصعود + لون شمعة الهبوط */
  function renderSettingsDialog() {
    if (!settingsOpen) return null;
    const row = (label, control) => (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #262626" }}>
        <span style={{ fontSize: 13, color: "#ccc" }}>{label}</span>
        {control}
      </div>
    );
    const colorInput = (val, onChange) => (
      <input type="color" value={val} onChange={(e) => onChange(e.target.value)}
        style={{ width: 40, height: 28, border: "1px solid #333", borderRadius: 6, background: "none", cursor: "pointer", padding: 0 }} />
    );
    return (
      <div style={{
        position: "absolute", inset: 0, zIndex: 30, background: "#000000aa",
        display: "flex", alignItems: "center", justifyContent: "center",
      }} onClick={() => setSettingsOpen(false)}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: 300, background: "#161616", border: `1px solid ${GOLD}44`, borderRadius: 14, padding: "1.1rem 1.3rem" }}
        >
          <div style={{ fontWeight: 700, color: GOLD_LIGHT, marginBottom: 6, fontSize: 15 }}>⚙️ إعدادات الشارت</div>
          {row("لون خلفية الشارت", colorInput(chartSettings.bg, (v) => setChartSettings((s) => ({ ...s, bg: v }))))}
          {row("لون شمعة الصعود", colorInput(chartSettings.up, (v) => setChartSettings((s) => ({ ...s, up: v }))))}
          {row("لون شمعة الهبوط", colorInput(chartSettings.down, (v) => setChartSettings((s) => ({ ...s, down: v }))))}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => setChartSettings(DEFAULT_CHART_SETTINGS)} style={{ ...btnStyle("secondary"), flex: 1 }}>
              الافتراضي
            </button>
            <button onClick={() => setSettingsOpen(false)} style={{ ...btnStyle("primary"), flex: 1 }}>
              تم
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderControls() {
    return (
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center",
        marginBottom: "1rem", background: "linear-gradient(145deg, #14120a, #0d0d0a)",
        border: `1px solid ${GOLD}26`, borderRadius: 14, padding: "1rem 1.25rem",
      }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#999" }}>
          الأصل
          <select
            value={assetValue}
            onChange={(e) => setAssetValue(e.target.value)}
            disabled={randomChart}
            style={selectStyle}
          >
            {ASSETS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((it) => (
                  <option key={it.v} value={it.v} disabled={!it.yahoo}>
                    {it.label}{!it.yahoo ? " (غير مدعوم بعد)" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <Select label="الفريم" value={interval} onChange={setIntervalValue} options={INTERVALS} />
        <Select label="أقصى عدد شموع" value={maxBars} onChange={(v) => setMaxBars(Number(v))} options={MAX_BARS_OPTIONS} />
        {mode === "training" && <Select label="السرعة" value={speed} onChange={(v) => setSpeed(Number(v))} options={SPEEDS} />}

        <div style={{ flex: 1 }} />

        {supported && allCandles.length > 0 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", paddingInlineEnd: 8, borderInlineEnd: "1px solid #2a2a2a" }}>
            <button
              onClick={() => openQuickTrade("buy")}
              disabled={!!pendingTrade}
              title="فتح صفقة شراء فورية بالسعر الحالي وربطها بالباك تيست"
              style={{ ...btnStyle("primary"), background: `linear-gradient(135deg, ${GREEN}, #0d8f63)`, color: "#fff" }}
            >
              🟢 شراء فوري
            </button>
            <button
              onClick={() => openQuickTrade("sell")}
              disabled={!!pendingTrade}
              title="فتح صفقة بيع فورية بالسعر الحالي وربطها بالباك تيست"
              style={{ ...btnStyle("primary"), background: `linear-gradient(135deg, ${RED}, #9f1f1f)`, color: "#fff" }}
            >
              🔴 بيع فوري
            </button>
          </div>
        )}

        {mode === "training" && (
          <>
            <button onClick={handleRandomStart} style={btnStyle("secondary")}>🎲 بداية عشوائية جديدة</button>
            <button onClick={handleReset} style={btnStyle("secondary")}>⏮ إعادة من البداية</button>
            <button onClick={togglePlay} disabled={finished || loading} style={btnStyle("primary")}>
              {isPlaying ? "⏸ إيقاف" : "▶ تشغيل تلقائي"}
            </button>
            <button onClick={handleNext} disabled={finished || loading} style={btnStyle("primary")}>▶ الشمعة التالية</button>
          </>
        )}
        {mode === "live" && (
          <button onClick={() => loadData()} style={btnStyle("secondary")}>🔄 تحديث</button>
        )}
      </div>
    );
  }

  /* بادج السوق الحي: سعر + عداد إغلاق الشمعة بتنسيق واضح + شريط تقدّم */
  function renderLiveBadge() {
    if (!(mode === "live" && supported)) return null;
    const priceColor = priceDir === 1 ? GREEN : priceDir === -1 ? RED : GOLD_LIGHT;
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "0.8rem",
        background: "#0f1f17", border: `1px solid ${GREEN}44`, borderRadius: 12, padding: "0.7rem 1.2rem",
        flexWrap: "wrap",
      }}>
        <span style={{ color: GREEN, fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN, display: "inline-block", animation: "qtaPulse 1.4s infinite" }} />
          مباشر
        </span>
        <span style={{ color: "#ccc", fontSize: 13 }}>
          آخر سعر: <b style={{ color: priceColor, transition: "color .3s" }}>{liveLastPrice ? liveLastPrice.toFixed(4) : "..."}</b>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#ccc", fontSize: 13 }}>إغلاق الشمعة خلال:</span>
          <b style={{ color: "#fff", fontVariantNumeric: "tabular-nums", fontSize: 14, minWidth: 58, display: "inline-block" }}>
            {countdown || "--:--"}
          </b>
          <div style={{ width: 90, height: 5, borderRadius: 3, background: "#1f2f27", overflow: "hidden" }}>
            <div style={{
              width: `${Math.min(100, Math.max(0, countdownProgress * 100))}%`,
              height: "100%", background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`,
              transition: "width 1s linear",
            }} />
          </div>
        </div>
        <style>{`@keyframes qtaPulse { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>
      </div>
    );
  }

  /* شريط معلومات السعر أعلى الشارت (رمز الأصل + O/H/L/C) — نفس ستايل تريدنغ فيو */
  function renderOHLCTicker() {
    const list = mode === "training" ? allCandles.slice(0, revealCount) : allCandles;
    const last = list[list.length - 1];
    if (!last) return null;
    const prev = list[list.length - 2];
    const up = prev ? last.close >= prev.open : last.close >= last.open;
    const col = up ? GREEN : RED;
    const info = getAssetByValue(assetValue);
    const intervalLabel = INTERVALS.find((i) => i.value === interval)?.label || interval;
    const fmt = (v) => (v != null ? v.toFixed(v < 10 ? 4 : 2) : "-");
    return (
      <div style={{
        position: "absolute", top: 10, left: 68, zIndex: 8, pointerEvents: "none",
        display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem 0.7rem",
        fontSize: 12.5, fontFamily: "monospace, sans-serif",
      }}>
        <span style={{ color: "#eee", fontWeight: 700, background: "#00000066", padding: "2px 8px", borderRadius: 6 }}>
          {info?.label || assetValue} · {intervalLabel}
        </span>
        <span style={{ color: col, background: "#00000066", padding: "2px 8px", borderRadius: 6 }}>
          O <b>{fmt(last.open)}</b>&nbsp;&nbsp;H <b>{fmt(last.high)}</b>&nbsp;&nbsp;L <b>{fmt(last.low)}</b>&nbsp;&nbsp;C <b>{fmt(last.close)}</b>
        </span>
      </div>
    );
  }

  return (
    <div>
      {!isFullscreen && renderTopBar()}
      {!isFullscreen && renderControls()}

      {!supported && !error && (
        <div style={{ color: "#f59e0b", fontSize: 13, marginBottom: "1rem" }}>
          ⚠️ هذا الأصل غير مدعوم حالياً بعرض الشموع، اختاري أصل آخر من القائمة.
        </div>
      )}
      {error && <div style={{ color: RED, fontSize: 13, marginBottom: "1rem" }}>{error}</div>}

      {!isFullscreen && renderLiveBadge()}

      <div
        ref={chartWrapperRef}
        style={{
          background: isFullscreen ? "#0a0a08" : "linear-gradient(145deg, #14120a, #0d0d0a)",
          border: `1px solid ${GOLD}26`,
          borderRadius: isFullscreen ? 0 : 14,
          padding: isFullscreen ? "0.6rem" : "1rem",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {isFullscreen && (
          <div ref={headerRef} style={{ marginBottom: "0.5rem" }}>
            {renderTopBar()}
            {renderControls()}
            {renderLiveBadge()}
          </div>
        )}

        {loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            color: "#777", fontSize: 14, zIndex: 2, background: "#0d0d0acc", borderRadius: 14,
          }}>
            ...جاري تحميل البيانات
          </div>
        )}
        <div ref={chartAreaRef} style={{ position: "relative", width: "100%", flex: 1 }}>
          {!loading && allCandles.length > 0 && renderDrawToolbar()}
          {!loading && allCandles.length > 0 && !editDraft && renderOHLCTicker()}
          {!loading && allCandles.length > 0 && renderPropertiesDialog()}
          {!loading && renderTradePanel()}
          {!loading && renderTradeToast()}
          {!loading && renderContextMenu()}
          <div
            ref={chartContainerRef}
            style={{ width: "100%", height: "100%", cursor: cutMode ? "crosshair" : activeTool !== "cursor" ? "crosshair" : "default" }}
          />
          <canvas
            ref={overlayCanvasRef}
            style={{
              position: "absolute", inset: 0, zIndex: 3,
              pointerEvents: activeTool === "cursor" ? "none" : "auto",
            }}
          />
        </div>
        {renderSettingsDialog()}
      </div>

      {contextMenu && (
        <div
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 19 }}
        />
      )}

      {mode === "training" && !isFullscreen && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.75rem", fontSize: 12.5, color: "#777" }}>
          <span>الشموع الظاهرة: {revealCount} / {allCandles.length}</span>
          {finished && <span style={{ color: GOLD_LIGHT }}>خلصت الشموع — دوسي "بداية عشوائية جديدة" لجولة تانية 🎯</span>}
        </div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#999" }}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </label>
  );
}

const selectStyle = {
  background: "#141414", border: "1px solid #2a2a2a", color: "#eee",
  borderRadius: 8, padding: "0.45rem 0.6rem", fontSize: 13, minWidth: 110,
};

function tabStyle(active) {
  return {
    padding: "0.5rem 1rem", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: `1px solid ${GOLD}44`,
    background: active ? `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})` : "transparent",
    color: active ? "#1a1200" : GOLD,
  };
}

function toolBtnStyle(active) {
  return {
    width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 8, cursor: "pointer",
    border: "1px solid transparent",
    background: active ? `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})` : "transparent",
    color: active ? "#1a1200" : "#c8c8c8",
    transition: "background .12s, color .12s",
    flexShrink: 0,
  };
}

function btnStyle(kind) {
  const base = { padding: "0.55rem 1rem", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none" };
  if (kind === "primary") return { ...base, background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`, color: "#1a1200" };
  return { ...base, background: "transparent", border: `1px solid ${GOLD}44`, color: GOLD };
}
