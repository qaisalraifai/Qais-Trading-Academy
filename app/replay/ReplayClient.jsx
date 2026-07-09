"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { ASSETS, getAssetByValue, INTERVAL_MAP, INTERVAL_MS } from "@/lib/assets";
import { createClient } from "@/lib/supabase-client";

const GOLD = "#C9A24B";
const GOLD_LIGHT = "#E8C468";
const GREEN = "#10b981";
const RED = "#ef4444";
const DEFAULT_COMPARE_HEIGHT = 200; // ارتفاع لوحة المقارنة الافتراضي بالبكسل (قابل للسحب من المستخدم)
// عرض ثابت (بالبكسل) لعمود الأسعار باليمين - لازم يكون نفس القيمة بالشارت الرئيسي
// وشارت المقارنة معاً، وإلا كل شارت (نسخة lightweight-charts منفصلة) بيحسب عرض
// عمود الأسعار تلقائياً حسب عدد خانات السعر تبعه، فمنطقة رسم الشموع ما بتضل
// بنفس المحاذاة بالبكسل بين اللوحتين حتى لو كانت الفترة الزمنية متطابقة 100%
// (هاي كانت سبب مشكلة "آخر شمعة فوق مش طالعة فوق آخر شمعة تحت بالضبط").
const PRICE_SCALE_WIDTH = 78;

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
// رفعنا رقم النسخة v1 -> v2 قصداً: عشان أي متصفح عنده إعدادات محفوظة قديمة
// (فيها مثلاً priceLineVisible: true من قبل) يرجع ياخذ القيم الافتراضية
// الجديدة تلقائياً بدل ما يضل عالقيم القديمة المخزّنة عنده لحد ما يضغط
// "الافتراضي" يدوياً. هاي أضمن طريقة لأي تغيير مستقبلي بالقيم الافتراضية.
const CHART_SETTINGS_KEY = "qta_chart_settings_v2";
const DEFAULT_CHART_SETTINGS = {
  bg: "#0d0d0a",
  up: GREEN,
  down: RED,
  gridVisible: true,
  gridColor: GOLD,
  crosshairColor: "#758696",
  textColor: "#d1d4dc",
  watermarkText: "",
  scaleMarginTop: 8,
  scaleMarginBottom: 8,
  // رمز (Symbol)
  lastValueLabelVisible: true,
  ohlcVisible: true,
  // خط الحالة (Status line)
  statusShowSymbol: true,
  statusShowInterval: true,
  statusShowValues: true,
  statusShowBg: true,
  // المقاييس والخطوط (Scales & lines)
  autoScale: true,
  // تداول (Trading)
  showTradeButtons: true,
  // تنبيهات (Alerts)
  activeAlertsOnly: true,
  autoHideToast: true,
  // أحداث (Events)
  showEvents: false,
};
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

/* ===================== إعدادات لوحة المقارنة (نوع الشارت + ألوان)، تنحفظ محلياً بالمتصفح ===================== */
const COMPARE_SETTINGS_KEY = "qta_compare_chart_settings_v1";
const DEFAULT_COMPARE_SETTINGS = {
  type: "area", // area | line | candles
  lineColor: GOLD_LIGHT,
  fillColor: GOLD_LIGHT,
  lineWidth: 2,
  up: GREEN,
  down: RED,
};
function loadCompareSettings() {
  if (typeof window === "undefined") return DEFAULT_COMPARE_SETTINGS;
  try {
    const raw = window.localStorage.getItem(COMPARE_SETTINGS_KEY);
    if (!raw) return DEFAULT_COMPARE_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_COMPARE_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_COMPARE_SETTINGS;
  }
}
function saveCompareSettings(settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMPARE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}
/* بناء سيريز لوحة المقارنة حسب النوع المختار (منطقة/خط/شموع) وألوانه
   (تحويل اللون لـ rgba بيصير عن طريق hexToRgba المعرّفة تحت بنفس الملف) */
function buildCompareSeries(chart, settings) {
  if (settings.type === "line") {
    return chart.addLineSeries({
      color: settings.lineColor,
      lineWidth: settings.lineWidth,
      priceLineVisible: false,
      lastValueVisible: true,
    });
  }
  if (settings.type === "candles") {
    return chart.addCandlestickSeries({
      upColor: settings.up, downColor: settings.down, borderVisible: false,
      wickUpColor: settings.up, wickDownColor: settings.down,
      priceLineVisible: false, lastValueVisible: true,
    });
  }
  return chart.addAreaSeries({
    lineColor: settings.lineColor,
    topColor: hexToRgba(settings.fillColor, 0.28),
    bottomColor: hexToRgba(settings.fillColor, 0.02),
    lineWidth: settings.lineWidth,
    priceLineVisible: false,
    lastValueVisible: true,
  });
}
/* تجهيز بيانات لوحة المقارنة حسب نوع الشارت المختار (شموع كاملة أو قيمة إغلاق فقط) */
function compareSeriesData(type, candles) {
  if (type === "candles") {
    return candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }));
  }
  return candles.map((c) => ({ time: c.time, value: c.close }));
}

/* تحويل صفقة الاستعراض التاريخي لصف جدول trades (نفس شكل أداة الباك تيست بالظبط عشان تظهر فيها وبلوحة التحكم) */
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

/* أقسام كل قائمة منسدلة (زي عناوين FIBONACCI / GANN بتريدنغ فيو). المجموعات
   يلي مش موجودة هون بتنعرض كقائمة واحدة بدون عنوان قسم. */
const TOOL_GROUP_SECTIONS = {
  1: [{ title: "خطوط", tools: ["trendline", "ray", "extendedline", "infoline", "angle", "hline", "hray", "vline", "crossline", "parallelchannel"] }],
  2: [{ title: "أشكال", tools: ["path", "rectangle", "circle"] }],
  3: [
    { title: "فيبوناتشي", tools: ["fib", "fibext", "fibchannel", "fibtimezone"] },
    { title: "غان", tools: ["gannfan"] },
    { title: "أخرى", tools: ["pitchfork", "wave"] },
  ],
  4: [{ title: "نطاقات", tools: ["pricerange", "daterange"] }],
  5: [{ title: "المراكز", tools: ["position_long", "position_short"] }],
  6: [{ title: "نص وقياس", tools: ["text", "measure"] }],
};

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
  const [maxBars, setMaxBars] = useState(5000);

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
  // عداد فشل التحديث اللايف المتتالي - لو تكرر الفشل (مثلاً تقييد مؤقت من يوهو)
  // منجبر إعادة تحميل كاملة بدل ما نضل نحاول تحديثات جزئية فاشلة للأبد بصمت
  const livePollFailCountRef = useRef(0);
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
  /* قائمة منسدلة لكل مجموعة أدوات (زي تريدنغ فيو): ضغطة عالسهم بتفتح قائمة
     بأسماء كل الأدوات جوا المجموعة، وبتتذكر آخر أداة مختارة من كل مجموعة */
  const [openToolGroup, setOpenToolGroup] = useState(null);
  const [toolGroupDefault, setToolGroupDefault] = useState({});
  const groupBtnRefs = useRef({});
  const drawingsVisibleRef = useRef(true);
  const drawingsRef = useRef([]); // [{id, type, p1:{logical,price}, p2?, points?, text?, style}]
  const drawStateRef = useRef(null); // الرسمة الجارية حالياً (سحب نقطتين)
  const isDrawingRef = useRef(false);
  const visibleCandlesRef = useRef([]);
  const pathPointsRef = useRef([]); // نقاط أداة المسار/الموجة أثناء الرسم
  const liveCursorRef = useRef(null); // موقع الماوس الحالي (لمعاينة المسار قبل التثبيت)
  const dragStateRef = useRef(null); // سحب/تحريك رسمة موجودة بوضع المؤشر: {mode:"move"|"handle", id, key?, lastLogical?, lastPrice?}
  const intervalRef = useRef(interval);
  const countdownRef = useRef("");
  const symbolLabelRef = useRef("");
  const priceTagRef = useRef(null);

  // لوحة خصائص الرسمة المحددة
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  /* ===== شريط أدوات سريع يطلع فوق أي رسمة لما تنكبس عليها كبسة وحدة
     (زي تريدنغ فيو: لون/سماكة/قفل/نسخ/حذف بدون ما تفتحي اللوحة الكاملة) ===== */
  const [selectedDrawingId, setSelectedDrawingId] = useState(null);
  const selectedIdRef = useRef(null);
  const [selectionRenderTick, setSelectionRenderTick] = useState(0);
  const selectionToolbarRef = useRef(null);

  /* ===== مقارنة الرموز (شارت مقسوم) + تكبير أي جزء بضغطتين ماوس ===== */
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareSymbol, setCompareSymbol] = useState("SPX500");
  const [compareCandles, setCompareCandles] = useState([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");
  const [maximizedPane, setMaximizedPane] = useState(null); // null | "main" | "compare"
  const compareContainerRef = useRef(null);
  const compareChartRef = useRef(null);
  const compareSeriesRef = useRef(null);
  const compareOpenRef = useRef(false);
  const maximizedPaneRef = useRef(null);
  const [compareHeightPx, setCompareHeightPx] = useState(DEFAULT_COMPARE_HEIGHT);
  const compareHeightPxRef = useRef(DEFAULT_COMPARE_HEIGHT);
  const mainPaneRef = useRef(null);
  const comparePaneRef = useRef(null);
  const compareCandlesRef = useRef([]);
  const crosshairSyncingRef = useRef(false);
  const rangeSyncingRef = useRef(false);

  /* إعدادات لوحة المقارنة (نوع الشارت وألوانه) + نافذتها الخاصة */
  const [compareSettings, setCompareSettings] = useState(DEFAULT_COMPARE_SETTINGS);
  const [compareSettingsOpen, setCompareSettingsOpen] = useState(false);

  /* إعدادات ألوان الشارت (خلفية + شموع صعود/هبوط) + قائمة الكليك يمين + نافذة الإعدادات */
  const [chartSettings, setChartSettings] = useState(DEFAULT_CHART_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("symbol");
  const [contextMenu, setContextMenu] = useState(null); // { x, y, price }

  /* ===== ربط أزرار الشراء/البيع الفوري ببرنامج الباك تيست ===== */
  const supabase = useRef(createClient()).current;
  const [accountBalance, setAccountBalance] = useState(3000);
  const [pendingTrade, setPendingTrade] = useState(null); // {direction, entry, lot, tpId, slId, asset}
  const [tradeLot, setTradeLot] = useState("0.01");
  const [tradeReason, setTradeReason] = useState("");
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
    if (!tradeToast || chartSettings.autoHideToast === false) return;
    const t = setTimeout(() => setTradeToast(""), 3500);
    return () => clearTimeout(t);
  }, [tradeToast, chartSettings.autoHideToast]);

  /* تحميل إعدادات الألوان المحفوظة بعد أول رندر عالمتصفح (تفادي مشاكل الـ SSR) */
  useEffect(() => {
    setChartSettings(loadChartSettings());
    setCompareSettings(loadCompareSettings());
  }, []);

  /* أي تغيير بالإعدادات: تطبيق فوري على الشارت + حفظ بالمتصفح (وتطبيق نفس لون الخلفية على لوحة المقارنة لو مفتوحة) */
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;
    chartRef.current.applyOptions({
      layout: { background: { color: chartSettings.bg }, textColor: chartSettings.textColor || "#d1d4dc" },
      grid: {
        vertLines: { color: hexToRgba(chartSettings.gridColor, 0.05), visible: chartSettings.gridVisible },
        horzLines: { color: hexToRgba(chartSettings.gridColor, 0.05), visible: chartSettings.gridVisible },
      },
      watermark: chartSettings.watermarkText
        ? { visible: true, text: chartSettings.watermarkText, color: "rgba(201,162,75,0.12)", fontSize: 48, horzAlign: "center", vertAlign: "center" }
        : { visible: false },
      rightPriceScale: {
        scaleMargins: { top: (chartSettings.scaleMarginTop ?? 8) / 100, bottom: (chartSettings.scaleMarginBottom ?? 8) / 100 },
        autoScale: chartSettings.autoScale !== false,
        // عرض ثابت لعمود الأسعار (لازم يطابق نفس القيمة بشارت المقارنة تماماً)،
        // عشان منطقة رسم الشموع تضل نفس المحاذاة بالبكسل بين الشارتين بغض النظر
        // عن عدد خانات السعر (مثلاً XAUUSD أربع خانات وNAS100 خمس خانات) - لو
        // تركنا العرض تلقائي كل شارت بياخد عرض مختلف وآخر شمعة فوق ما بتطابق
        // آخر شمعة تحت بالضبط حتى لو نفس التوقيت تماماً.
        minimumWidth: PRICE_SCALE_WIDTH,
      },
      crosshair: {
        vertLine: { color: chartSettings.crosshairColor },
        horzLine: { color: chartSettings.crosshairColor },
      },
    });
    seriesRef.current.applyOptions({
      upColor: chartSettings.up, downColor: chartSettings.down,
      wickUpColor: chartSettings.up, wickDownColor: chartSettings.down,
      lastValueVisible: chartSettings.lastValueLabelVisible !== false,
      // هاد الخط (priceLine) هو سبب "الشحطات الصغيرة" بعد آخر شمعة - تم إلغاؤه
      // نهائياً وبشكل ثابت، مش مرتبط بإعداد قابل للتغيير عشان ما يرجع يظهر
      // أبداً بأي حالة (حتى لو في إعدادات قديمة محفوظة بالمتصفح).
      priceLineVisible: false,
    });
    if (compareChartRef.current) {
      compareChartRef.current.applyOptions({
        layout: { background: { color: chartSettings.bg }, textColor: chartSettings.textColor || "#d1d4dc" },
        grid: {
          vertLines: { color: hexToRgba(chartSettings.gridColor, 0.05), visible: chartSettings.gridVisible },
          horzLines: { color: hexToRgba(chartSettings.gridColor, 0.05), visible: chartSettings.gridVisible },
        },
        crosshair: {
          vertLine: { color: chartSettings.crosshairColor },
          horzLine: { color: chartSettings.crosshairColor },
        },
      });
    }
    saveChartSettings(chartSettings);
  }, [chartSettings]);

  /* أي تغيير بإعدادات لوحة المقارنة (نوع الشارت أو ألوانه): نعيد بناء السيريز فوراً ونحفظ بالمتصفح.
     منقّاة بنفس بيانات الشمعة الحالية عشان يبان التغيير مباشرة بدون قفل/إعادة تحميل. */
  useEffect(() => {
    saveCompareSettings(compareSettings);
    if (!compareChartRef.current) return;
    try {
      if (compareSeriesRef.current) compareChartRef.current.removeSeries(compareSeriesRef.current);
    } catch {}
    const series = buildCompareSeries(compareChartRef.current, compareSettings);
    compareSeriesRef.current = series;
    try {
      series.setData(compareSeriesData(compareSettings.type, compareCandles));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareSettings]);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { magnetRef.current = magnetOn; }, [magnetOn]);
  useEffect(() => { intervalRef.current = interval; }, [interval]);
  useEffect(() => { drawingsVisibleRef.current = drawingsVisible; drawOverlay(); }, [drawingsVisible]);
  useEffect(() => { if (activeTool !== "cursor") clearSelection(); }, [activeTool]);
  useEffect(() => { compareOpenRef.current = compareOpen; }, [compareOpen]);
  useEffect(() => { maximizedPaneRef.current = maximizedPane; }, [maximizedPane]);
  useEffect(() => { compareHeightPxRef.current = compareHeightPx; }, [compareHeightPx]);
  useEffect(() => { compareCandlesRef.current = compareCandles; }, [compareCandles]);
  useEffect(() => {
    visibleCandlesRef.current = mode === "training" ? allCandles.slice(0, revealCount) : allCandles;
  }, [allCandles, revealCount, mode]);
  useEffect(() => { countdownRef.current = countdown; }, [countdown]);
  useEffect(() => {
    symbolLabelRef.current = getAssetByValue(assetValue)?.label || assetValue;
  }, [assetValue]);

  /* حساسية المغناطيس: يلتصق فقط لما المؤشر قريب فعلاً (بالبكسل) من قيمة أوبن/هاي/لو/كلوز
     الشمعة تحت المؤشر - مش فرض أقرب سعر دايماً. هيك حساسيته أخف وأدق من قبل. */
  const SNAP_THRESHOLD_PX = 34;
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
    positionSelectionToolbar();
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    /* مهم: الصفحة كلها dir="rtl"، وكانفس بيورث الاتجاه هاد لعرض النصوص، يعني
       fillText كانت ترسم الأرقام معكوسة الاتجاه (تبدأ من x وتمتد لليسار) فتطلع
       فوق خلفية الشارت السودا بلون أسود = نص مخفي تماماً. تثبيت ltr هون بيخلي
       كل أسعار الخطوط تترسم مكانها الصح وتظهر واضحة جوا صناديقها. */
    ctx.direction = "ltr";
    ctx.textAlign = "left";

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
        /* السعر بيظهر بصندوق واضح ملاصق لمحور السعر يمين الشارت (مش على
           الحافة الشمال يلي بتضيع لما تكبري/تزحفي بالشارت) */
        ctx.font = "bold 11px sans-serif";
        const label = roleLabel ? roleLabel + d.p1.price.toFixed(2) : d.p1.price.toFixed(2);
        const tw = ctx.measureText(label).width;
        const boxW = tw + 12;
        const boxX = Math.max(4, w - boxW - 6);
        ctx.fillStyle = style.color || GOLD_LIGHT;
        ctx.fillRect(boxX, y - 10, boxW, 20);
        ctx.fillStyle = "#0a0a0a";
        ctx.fillText(label, boxX + 6, y + 4);

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
    clearSelection();
    setEditingId(d.id);
    setEditDraft(JSON.parse(JSON.stringify(d)));
  }

  /* ===== اختيار رسمة بكبسة وحدة: يطلع شريط أدوات سريع فوقها مباشرة ===== */
  function selectDrawing(id) {
    selectedIdRef.current = id;
    setSelectedDrawingId(id);
    setEditingId(null);
    setEditDraft(null);
  }
  function clearSelection() {
    if (selectedIdRef.current == null) return;
    selectedIdRef.current = null;
    setSelectedDrawingId(null);
  }
  function getSelectedDrawing() {
    if (selectedIdRef.current == null) return null;
    return drawingsRef.current.find((d) => d.id === selectedIdRef.current) || null;
  }
  function updateSelectedStyle(patch) {
    const idx = drawingsRef.current.findIndex((d) => d.id === selectedIdRef.current);
    if (idx === -1) return;
    drawingsRef.current[idx] = { ...drawingsRef.current[idx], style: { ...drawingsRef.current[idx].style, ...patch } };
    drawOverlay();
    setSelectionRenderTick((t) => t + 1);
  }
  function toggleSelectedLock() {
    const idx = drawingsRef.current.findIndex((d) => d.id === selectedIdRef.current);
    if (idx === -1) return;
    drawingsRef.current[idx] = { ...drawingsRef.current[idx], locked: !drawingsRef.current[idx].locked };
    drawOverlay();
    setSelectionRenderTick((t) => t + 1);
  }
  function deleteSelectedDrawing() {
    if (selectedIdRef.current == null) return;
    drawingsRef.current = drawingsRef.current.filter((d) => d.id !== selectedIdRef.current);
    clearSelection();
    drawOverlay();
  }
  function duplicateSelectedDrawing() {
    const d = getSelectedDrawing();
    if (!d) return;
    const offset = 6;
    const clone = JSON.parse(JSON.stringify(d));
    clone.id = Date.now();
    if (clone.p1) clone.p1 = { ...clone.p1, logical: clone.p1.logical + offset };
    if (clone.p2) clone.p2 = { ...clone.p2, logical: clone.p2.logical + offset };
    if (clone.points) clone.points = clone.points.map((p) => ({ ...p, logical: p.logical + offset }));
    drawingsRef.current.push(clone);
    selectDrawing(clone.id);
    drawOverlay();
  }
  /* بتحسب مكان الشريط العائم فوق الرسمة المختارة مباشرة (تتحدث مع كل تحريك/زوم للشارت) */
  function positionSelectionToolbar() {
    const el = selectionToolbarRef.current;
    if (!el) return;
    const d = getSelectedDrawing();
    if (!d) { el.style.display = "none"; return; }
    const pts = [];
    if (d.p1) pts.push(logicalPriceToXY(d.p1));
    if (d.p2) pts.push(logicalPriceToXY(d.p2));
    if (d.points) d.points.forEach((p) => pts.push(logicalPriceToXY(p)));
    const valid = pts.filter((p) => p.x != null && p.y != null);
    if (!valid.length) { el.style.display = "none"; return; }
    const minX = Math.min(...valid.map((p) => p.x));
    const maxX = Math.max(...valid.map((p) => p.x));
    const minY = Math.min(...valid.map((p) => p.y));
    const areaW = chartAreaRef.current?.clientWidth || 0;
    const cx = Math.min(Math.max((minX + maxX) / 2, 100), Math.max(100, areaW - 100));
    el.style.display = "flex";
    el.style.left = `${cx}px`;
    el.style.top = `${Math.max(6, minY - 46)}px`;
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
    const dist = price * 0.003; // مسافة افتراضية 0.3% تبدأ فيها الخطوط، وبعدين تسحبيها لمكان الهدف/وقف الخسارة الصح
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
    setTradeReason("");
    setPendingTrade({ tag, direction, entry: price, asset: assetValue });
  }

  function cancelQuickTrade() {
    if (pendingTradeRef.current) {
      drawingsRef.current = drawingsRef.current.filter((d) => d.tradeTag !== pendingTradeRef.current.tag);
      drawOverlay();
    }
    setTradeReason("");
    setPendingTrade(null);
  }

  async function confirmQuickTrade() {
    const pt = pendingTradeRef.current;
    if (!pt || !userId) return;
    if (!tradeReason.trim()) {
      setTradeToast("لازم تكتبي سبب الدخول قبل ما تسجّلي الصفقة");
      return;
    }
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
      setup: "من الاستعراض التاريخي",
      reason: tradeReason.trim(),
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
      .update({ result, reason: `إغلاق تلقائي من الاستعراض التاريخي عند ${closePrice.toFixed(2)}` })
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
        layout: {
          background: { color: savedSettings.bg },
          textColor: savedSettings.textColor || "#d1d4dc",
          // نفس عائلة الخطوط اللي تريدنغ فيو بتستخدمها بمحاور السعر/الوقت، عشان يصير
          // شكل الأرقام والتسميات أقرب لشكلها هناك
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
        },
        // شبكة خفيفة جداً بدل إخفائها بالكامل - زي خلفية شارت تريدنغ فيو الحقيقي
        // (خطوط باهتة بالكاد تُلاحظ، مش شبكة صارخة) - قابلة للإخفاء/تلوين من الإعدادات
        grid: {
          vertLines: { color: hexToRgba(savedSettings.gridColor, 0.05), style: 0, visible: savedSettings.gridVisible },
          horzLines: { color: hexToRgba(savedSettings.gridColor, 0.05), style: 0, visible: savedSettings.gridVisible },
        },
        watermark: savedSettings.watermarkText
          ? { visible: true, text: savedSettings.watermarkText, color: "rgba(201,162,75,0.12)", fontSize: 48, horzAlign: "center", vertAlign: "center" }
          : { visible: false },
        timeScale: {
          borderColor: "#3a3a3a",
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 6,
          barSpacing: 7,
          minBarSpacing: 1.5,
        },
        rightPriceScale: {
          borderColor: "#3a3a3a",
          scaleMargins: { top: (savedSettings.scaleMarginTop ?? 8) / 100, bottom: (savedSettings.scaleMarginBottom ?? 8) / 100 },
          // نفس ملاحظة أعلى: عرض ثابت مطابق تماماً لعرض عمود الأسعار بشارت المقارنة
          minimumWidth: PRICE_SCALE_WIDTH,
        },
        width: chartContainerRef.current.clientWidth,
        height: 480,
        /* وضع Normal (مش Magnet) عشان مؤشر السعر يصير "+" حر بيتبع الفأرة فعلياً
           بدل ما يلتصق ويقفز لأقرب سعر شمعة. المؤشر نفسه دايماً ظاهر وواضح
           (لون صريح بدون شفافية) زي تريدنغ فيو، والمغناطيس (لما يكون مفعّل)
           بس بيقوّي التصاقه لما يكون قريب فعلاً من سعر شمعة، من غير ما يختفي أبداً. */
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: savedSettings.crosshairColor, width: 1, style: 2, labelBackgroundColor: "#4c525e" },
          horzLine: { color: savedSettings.crosshairColor, width: 1, style: 2, labelBackgroundColor: "#4c525e" },
        },
      });

      const series = chart.addCandlestickSeries({
        upColor: savedSettings.up, downColor: savedSettings.down, borderVisible: false,
        wickUpColor: savedSettings.up, wickDownColor: savedSettings.down,
        // إخفاء خانة آخر سعر (الصندوق + الخط المتقطع) على محور السعر يمين الشارت
        lastValueVisible: false,
        priceLineVisible: false,
      });

      chartRef.current = chart;
      seriesRef.current = series;

      const handleResize = () => {
        if (!chartContainerRef.current) return;
        const isFs = !!document.fullscreenElement;
        let totalHeight = 480;
        if (isFs) {
          const headerH = headerRef.current?.offsetHeight || 0;
          // نحسب الارتفاع من المساحة الفعلية المتبقية بالشاشة (بدل رقم ثابت تخميني):
          // نقيس فعلياً الـ margin تحت الهيدر + الـ padding الفوقي/التحتي لصندوق الشارت
          // عشان ما يضل فراغ أو يطلع أي جزء برا الشاشة أياً كان حجم الهيدر.
          const headerMarginBottom = headerRef.current
            ? parseFloat(window.getComputedStyle(headerRef.current).marginBottom) || 0
            : 0;
          let padTop = 0, padBottom = 0;
          if (chartWrapperRef.current) {
            const cs = window.getComputedStyle(chartWrapperRef.current);
            padTop = parseFloat(cs.paddingTop) || 0;
            padBottom = parseFloat(cs.paddingBottom) || 0;
          }
          totalHeight = Math.max(320, window.innerHeight - headerH - headerMarginBottom - padTop - padBottom - 4);
        } else if (chartWrapperRef.current) {
          // نفس فكرة الشاشة الكاملة، بس هون منحسب المساحة المتاحة لغاية آخر الصفحة
          // (مش رقم ثابت 480px) عشان الشارت ياخد كل المساحة المتبقية بالشاشة
          // بالظبط متل تريدنغ فيو، بدل ما يضل فراغ فاضي تحته أو جنبه.
          const rect = chartWrapperRef.current.getBoundingClientRect();
          const cs = window.getComputedStyle(chartWrapperRef.current);
          const padTop = parseFloat(cs.paddingTop) || 0;
          const padBottom = parseFloat(cs.paddingBottom) || 0;
          const BOTTOM_BREATHING_ROOM = 24; // شوي مسافة تحت الشارت قبل نهاية الصفحة
          totalHeight = Math.max(
            420,
            window.innerHeight - rect.top - padTop - padBottom - BOTTOM_BREATHING_ROOM
          );
        }
        // توزيع الارتفاع بين الشارت الرئيسي وشارت المقارنة (لو مفعّل) حسب أي جزء مكبّر حالياً
        // وحسب الحجم اللي المستخدم سحبه يدوياً (قاسم قابل للسحب زي تريدنغ فيو)
        const DIVIDER_H = 10;
        let mainHeight = totalHeight;
        let compareHeight = 0;
        if (compareOpenRef.current) {
          if (maximizedPaneRef.current === "compare") {
            mainHeight = 0;
            compareHeight = totalHeight;
          } else if (maximizedPaneRef.current === "main") {
            mainHeight = totalHeight;
            compareHeight = 0;
          } else {
            const maxCompare = Math.max(100, totalHeight - 150 - DIVIDER_H);
            compareHeight = Math.min(Math.max(100, compareHeightPxRef.current), maxCompare);
            mainHeight = Math.max(150, totalHeight - compareHeight - DIVIDER_H);
          }
        }
        // نفرض ارتفاع صريح بالبكسل على صندوقي اللوحتين نفسهم (مش بس على الشارت جوّاهم).
        // هيك بيضلوا مطابقين تماماً لبعض بغض النظر عن طول أي عنصر جوا اللوحة الرئيسية
        // (زي عمود أدوات الرسم اللي كان بيطوّل أكتر من الشارت ويسيب فراغ أسود تحته).
        if (mainPaneRef.current) mainPaneRef.current.style.height = `${mainHeight}px`;
        if (comparePaneRef.current) comparePaneRef.current.style.height = `${compareHeight}px`;
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: mainHeight,
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
        if (compareChartRef.current && compareContainerRef.current) {
          compareChartRef.current.applyOptions({
            width: compareContainerRef.current.clientWidth,
            height: compareHeight,
          });
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
        const { logical, price, y } = getLogicalPrice(e.clientX, e.clientY);
        if (logical == null || price == null) return;
        // نخلي مؤشر التقاطع (+) الأصلي يضل ظاهر وهو عم يتحرك حتى وإحنا نستخدم أداة رسم،
        // لأن الـ overlay canvas بياخد كل أحداث الماوس فوقه فما بيوصل حدث mousemove
        // للشارت الأصلي (يلي هو المسؤول عن رسم مؤشر التقاطع)
        const idx = Math.round(logical);
        const barForCrosshair = visibleCandlesRef.current[idx];
        if (barForCrosshair) {
          chart.setCrosshairPosition(price, barForCrosshair.time, series);
          syncCrosshairToCompare(barForCrosshair.time);
        }
        if (!isDrawingRef.current && !activePath) return;
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
          selectDrawing(handleHit.drawing.id);
          if (handleHit.drawing.locked) { drawOverlay(); return; }
          dragStateRef.current = { mode: "handle", id: handleHit.drawing.id, key: handleHit.key };
          chart.applyOptions({ handleScroll: false, handleScale: false });
          return;
        }
        const hit = findDrawingAt(x, y);
        if (hit) {
          e.preventDefault();
          e.stopPropagation();
          selectDrawing(hit.id);
          if (hit.locked) { drawOverlay(); return; }
          dragStateRef.current = { mode: "move", id: hit.id, lastLogical: logical, lastPrice: price };
          chart.applyOptions({ handleScroll: false, handleScale: false });
          return;
        }
        clearSelection();
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
          clearSelection();
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

      /* خانة السعر الحيّة على محور السعر (زي TradingView): اسم الزوج + السعر
         + الوقت المتبقي لإغلاق الشمعة الحالية. بتتحدث بتيكر دوري بسيط عشان
         تتفادى مشكلة الـ closures القديمة بالبيانات. */
      function updatePriceTag() {
        const el = priceTagRef.current;
        const s = seriesRef.current;
        if (!el || !s) return;
        const list = visibleCandlesRef.current;
        const last = list && list[list.length - 1];
        if (!last) { el.style.display = "none"; return; }
        const y = s.priceToCoordinate(last.close);
        if (y == null) { el.style.display = "none"; return; }
        const up = last.close >= last.open;
        el.style.display = "flex";
        el.style.top = `${y}px`;
        el.style.background = up ? GREEN : RED;
        const symEl = el.querySelector('[data-role="symbol"]');
        const priceEl = el.querySelector('[data-role="price"]');
        const cdEl = el.querySelector('[data-role="countdown"]');
        if (symEl) symEl.textContent = symbolLabelRef.current;
        if (priceEl) priceEl.textContent = last.close.toFixed(2);
        const cd = countdownRef.current;
        if (cdEl) {
          if (cd) { cdEl.style.display = "block"; cdEl.textContent = cd; }
          else { cdEl.style.display = "none"; }
        }
      }
      const priceTagInterval = setInterval(updatePriceTag, 250);

      // مغناطيس خفيف على المؤشر نفسه (مش بس على أدوات الرسم): بيلتصق بأقرب
      // O/H/L/C لما تكوني قريبة منه فعلاً بالبكسل (التصاق واضح بس مش مبالغ فيه)،
      // وبيفضل حر يتبع الفأرة عادي لو بعيدة عنه — بدون ما يختفي المؤشر أبداً.
      // ملاحظة: ما منستخدم clearCrosshairPosition هون إطلاقاً، لأنها هي اللي كانت
      // بتخفي المؤشر بدل ما ترجّعه حر.
      const MAGNET_SNAP_PX = 16; // حساسية معتدلة: التصاق واضح لما تكوني قريبة فعلاً، مش قوي جداً
      let settingCrosshairPos = false;
      function onCrosshairMagnet(param) {
        if (settingCrosshairPos) { settingCrosshairPos = false; return; }
        if (!magnetRef.current) return;
        if (!param.time || !param.point) return;
        const bar = param.seriesData?.get(series);
        if (!bar) return;
        const vals = [bar.open, bar.high, bar.low, bar.close].filter((v) => v != null);
        let best = null, bestDist = Infinity;
        for (const v of vals) {
          const y = series.priceToCoordinate(v);
          if (y == null) continue;
          const d = Math.abs(param.point.y - y);
          if (d < bestDist) { bestDist = d; best = v; }
        }
        if (best == null || bestDist > MAGNET_SNAP_PX) return; // بعيدة عن أي سعر: يضل حر يتبع الفأرة
        settingCrosshairPos = true;
        chart.setCrosshairPosition(best, param.time, series);
      }
      chart.subscribeCrosshairMove(onCrosshairMagnet);

      /* مزامنة مؤشر تقاطع الوقت/السعر مع لوحة المقارنة (لو مفتوحة) عشان يبانوا
         كأنهم شاشة وحدة زي تريدنغ فيو بالظبط: أي تحريك بالماوس عالشارت الرئيسي
         بيحرك نفس عمود الوقت بلوحة المقارنة تلقائياً، شمعة شمعة.
         ملاحظة مهمة: منستدعيها بشكل مباشر من onMouseMove (مش بس عن طريق
         subscribeCrosshairMove) لأن مؤشر الشارت الرئيسي أصلاً بينترسم يدوياً
         عن طريق setCrosshairPosition، وما في ضمان إنها هي نفسها بتفعّل حدث
         subscribeCrosshairMove بكل نسخ المكتبة — فبالاستدعاء المباشر بنضمن
         إنها تشتغل دايماً. */
      function syncCrosshairToCompare(time) {
        if (crosshairSyncingRef.current) return;
        const cChart = compareChartRef.current;
        const cSeries = compareSeriesRef.current;
        if (!cChart || !cSeries) return;
        crosshairSyncingRef.current = true;
        try {
          if (time == null) {
            cChart.clearCrosshairPosition();
          } else {
            const candles = compareCandlesRef.current || [];
            let bar = candles.find((c) => c.time === time);
            if (!bar && candles.length) {
              let bestDiff = Infinity;
              for (const c of candles) {
                const diff = Math.abs(c.time - time);
                if (diff < bestDiff) { bestDiff = diff; bar = c; }
              }
            }
            if (bar) cChart.setCrosshairPosition(bar.close, bar.time, cSeries);
            else cChart.clearCrosshairPosition();
          }
        } catch {}
        crosshairSyncingRef.current = false;
      }
      function onMainCrosshairSync(param) {
        syncCrosshairToCompare(param.time ?? null);
      }
      chart.subscribeCrosshairMove(onMainCrosshairSync);

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
        chart.unsubscribeCrosshairMove(onCrosshairMagnet);
        chart.unsubscribeCrosshairMove(onMainCrosshairSync);

        clearInterval(priceTagInterval);
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

  /* ===================== تبديل الشاشة الكاملة ===================== */
  function toggleFullscreen() {
    if (!chartWrapperRef.current) return;
    if (!document.fullscreenElement) {
      chartWrapperRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  /* لما محتوى شريط التحكم العلوي بيتغيّر بوضع الشاشة الكاملة (تبديل وضع/وضع القص/سرعة...)
     ممكن يتغيّر ارتفاعه، فلازم نعيد حساب ارتفاع الشارت عشان شريط الوقت السفلي يضل ظاهر بالكامل */
  useEffect(() => {
    if (isFullscreen) {
      const t = setTimeout(() => chartRef.current?.__resize?.(), 30);
      return () => clearTimeout(t);
    }
  }, [isFullscreen, mode, cutMode, randomChart, assetValue, interval, maxBars, speed, isPlaying, loading]);

  /* لما تنفتح/تنقفل لوحة المقارنة أو ينكبّر أي جزء منها، لازم نعيد توزيع الارتفاع بين الشارتين.
     وكمان لازم نخفي محور الوقت (شريط التواريخ) بالشارت الرئيسي وقتها، عشان يضل
     محور وقت واحد بس ظاهر بالأسفل (بلوحة المقارنة) - بالضبط زي تريدنغ فيو، مش
     محورين منفصلين لكل لوحة. */
  useEffect(() => {
    const t = setTimeout(() => chartRef.current?.__resize?.(), 30);
    if (chartRef.current) {
      const hideMainAxis = compareOpen && maximizedPane !== "main";
      try { chartRef.current.applyOptions({ timeScale: { visible: !hideMainAxis } }); } catch {}
    }
    return () => clearTimeout(t);
  }, [compareOpen, maximizedPane]);

  /* ===================== شارت المقارنة (لوحة سفلية بسيطة للقراءة فقط، بدون أدوات رسم) ===================== */
  useEffect(() => {
    if (!compareOpen) {
      if (compareChartRef.current) {
        compareChartRef.current.remove();
        compareChartRef.current = null;
        compareSeriesRef.current = null;
      }
      return;
    }
    let cancelled = false;
    async function setupCompareChart() {
      const { createChart, CrosshairMode } = await import("lightweight-charts");
      if (cancelled || !compareContainerRef.current) return;
      const savedSettings = loadChartSettings();
      const chart = createChart(compareContainerRef.current, {
        layout: {
          background: { color: savedSettings.bg },
          textColor: savedSettings.textColor || "#d1d4dc",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
        },
        grid: {
          vertLines: { color: hexToRgba(savedSettings.gridColor, 0.05), visible: savedSettings.gridVisible },
          horzLines: { color: hexToRgba(savedSettings.gridColor, 0.05), visible: savedSettings.gridVisible },
        },
        timeScale: { borderColor: "#3a3a3a", timeVisible: true, secondsVisible: false },
        // عرض ثابت مطابق تماماً لعرض عمود الأسعار بالشارت الرئيسي (PRICE_SCALE_WIDTH)،
        // هاد هو الحل الفعلي لمشكلة "آخر شمعة فوق ما بتطابق آخر شمعة تحت بالضبط":
        // كل شارت (رئيسي/مقارنة) هو نسخة lightweight-charts منفصلة، وبدون تثبيت
        // نفس العرض، كل وحدة بتحسب عرض عمود الأسعار تلقائياً حسب عدد خانات
        // السعر تبعها (مثلاً XAUUSD أربع خانات مقابل NAS100 خمس خانات) - فمنطقة
        // رسم الشموع الفعلية ما بتضل بنفس المحاذاة بالبكسل بين اللوحتين حتى لو
        // كانت الفترة الزمنية المعروضة متطابقة 100%.
        rightPriceScale: { borderColor: "#3a3a3a", minimumWidth: PRICE_SCALE_WIDTH },
        // نفس إعدادات مؤشر التقاطع بالضبط زي الشارت الرئيسي (اللون + الوضع Normal)
        // - قبل هيك ما كان في أي إعداد هون، فكان بياخد لون/سلوك افتراضي من
        // المكتبة يختلف عن الشارت الرئيسي (هاد سبب اختلاف لون المؤشر).
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: savedSettings.crosshairColor, width: 1, style: 2, labelBackgroundColor: "#4c525e" },
          horzLine: { color: savedSettings.crosshairColor, width: 1, style: 2, labelBackgroundColor: "#4c525e" },
        },
        width: compareContainerRef.current.clientWidth,
        height: 160,
        // لوحة المقارنة صارت تفاعلية بالكامل (سكرول/زوم مباشر عليها) — التحكم
        // متبادل مع الشارت الرئيسي بالاتجاهين (شوف onMainRangeChange/
        // onCompareRangeChange تحت)، مع حارس (rangeSyncingRef) يمنع أي
        // "تجاذب"/بينغ-بونغ بين اللوحتين لما توصل تحديثات من الاتجاهين
        // بنفس الوقت.
        handleScroll: true,
        handleScale: true,
      });
      const series = buildCompareSeries(chart, loadCompareSettings());
      compareChartRef.current = chart;
      compareSeriesRef.current = series;

      // مزامنة السكرول/الزوم بين الشارت الرئيسي ولوحة المقارنة بالاتجاهين -
      // أي وحدة فيهم ممكن تقود التانية هلأ (قبل هيك كانت لوحة المقارنة "مرآة"
      // بس، ما فيها تحكم مباشر). rangeSyncingRef هو الحارس يلي بيمنع
      // "بينغ-بونغ" (كل شارت يرجع يصحح التاني بلا نهاية): لما وحدة تحدّث
      // التانية، منرفع الحارس قبل ما نغيّر مدى الشارت التاني، وأي حدث تغيير
      // ثاني ناتج عن هالتحديث بنفس اللحظة بيتجاهل نفسه لأنه الحارس مرفوع.
      //
      // مهم: نستخدم مزامنة "منطقية" (logical range = رقم موضع الشمعة) مش
      // مزامنة بالتوقيت المطلق (setVisibleRange). المزامنة بالتوقيت كانت هي
      // سبب مشكلة "الخط العمودي (نقطة الوقت الحالية) مش بنفس المكان بين
      // الشارتين": أي رمزين مختلفين (زي NAS100 وSPX500) ممكن يكون عندهم
      // فجوات/شموع ناقصة بأوقات مختلفة شوي عن بعض، فنفس الفترة الزمنية
      // بالضبط ممكن تترجم لعدد شموع مختلف بكل لوحة، فينزاح كل شي بصرياً حتى
      // لو الفترة "نفسها" بالتوقيت. المزامنة المنطقية بتحاذي برقم موضع
      // الشمعة مباشرة، فعمود رقم N بيضل بنفس البكسل بين اللوحتين دايماً -
      // وهاد هو الأسلوب الموصى فيه رسمياً من مكتبة lightweight-charts
      // لمزامنة عدة شارتات مع بعض.
      const mainChart = chartRef.current;
      const onMainRangeChange = (range) => {
        if (!range || !compareChartRef.current || rangeSyncingRef.current) return;
        rangeSyncingRef.current = true;
        try { compareChartRef.current.timeScale().setVisibleLogicalRange(range); } catch {}
        rangeSyncingRef.current = false;
      };
      const onCompareRangeChange = (range) => {
        if (!range || !chartRef.current || rangeSyncingRef.current) return;
        rangeSyncingRef.current = true;
        try { chartRef.current.timeScale().setVisibleLogicalRange(range); } catch {}
        rangeSyncingRef.current = false;
      };
      mainChart?.timeScale().subscribeVisibleLogicalRangeChange(onMainRangeChange);
      chart.timeScale().subscribeVisibleLogicalRangeChange(onCompareRangeChange);

      // نحاذي لوحة المقارنة فوراً مع نفس الموضع المنطقي للشارت الرئيسي وقت الفتح
      // (بدل ما تضل بفترتها الافتراضية العريضة لحد أول سحب/زوم من المستخدم)
      try {
        const mainRange = mainChart?.timeScale().getVisibleLogicalRange();
        if (mainRange) chart.timeScale().setVisibleLogicalRange(mainRange);
      } catch {}

      /* مزامنة مؤشر تقاطع الوقت/السعر بالاتجاهين (تحريك الماوس فوق أي وحدة من
         اللوحتين بيحرك نفس عمود الوقت بالتانية) - قبل هيك كانت المزامنة
         باتجاه واحد بس (الشارت الرئيسي بيقود)، فلما تكوني تحت (لوحة المقارنة)
         ما كان المؤشر عم يطلع فوق (الشارت الرئيسي). */
      function findNearestBar(candles, time) {
        if (!candles?.length) return null;
        let bar = candles.find((c) => c.time === time);
        if (bar) return bar;
        let bestDiff = Infinity;
        for (const c of candles) {
          const diff = Math.abs(c.time - time);
          if (diff < bestDiff) { bestDiff = diff; bar = c; }
        }
        return bar || null;
      }
      function syncCrosshairToMain(time) {
        if (crosshairSyncingRef.current) return;
        const mChart = chartRef.current;
        const mSeries = seriesRef.current;
        if (!mChart || !mSeries) return;
        crosshairSyncingRef.current = true;
        try {
          if (time == null) {
            mChart.clearCrosshairPosition();
          } else {
            const bar = findNearestBar(visibleCandlesRef.current, time);
            if (bar) mChart.setCrosshairPosition(bar.close, bar.time, mSeries);
            else mChart.clearCrosshairPosition();
          }
        } catch {}
        crosshairSyncingRef.current = false;
      }
      chart.subscribeCrosshairMove((param) => syncCrosshairToMain(param.time ?? null));

      chart.__unsyncMain = () => {
        mainChart?.timeScale().unsubscribeVisibleLogicalRangeChange(onMainRangeChange);
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(onCompareRangeChange);
      };

      chartRef.current?.__resize?.();
    }
    setupCompareChart();
    return () => {
      cancelled = true;
      compareChartRef.current?.__unsyncMain?.();
    };
  }, [compareOpen]);

  /* تحديث بيانات شارت المقارنة كل ما تتغيّر الرسمة/الفريم/تقدّم التشغيل (وضع التدريب).
     السبب الحقيقي للفراغ يلي كان بيبان يمين الشارت الرئيسي: بوضع "التدريب" (الريبلاي)
     الشارت الرئيسي بيكون مجمّد على نقطة تاريخية معينة ("اختيار نقطة البداية")
     ومكشوف منه بس شموع لحد هاي النقطة، بينما رمز المقارنة كان دايماً بيجيب ويعرض
     آخر بيانات حية لليوم (لحد اليوم)! يعني اللوحتين أصلاً بيمثلوا فترتين زمنيتين
     مختلفتين تماماً. الحل: نقص بيانات المقارنة لنفس آخر نقطة زمنية مكشوفة
     بالشارت الرئيسي (بوضع التدريب)، تماماً متل ما بنعمل بالشارت الرئيسي نفسه -
     هيك ما ينكشف "مستقبل" لرمز المقارنة قبل ما يوصله الريبلاي. */
  useEffect(() => {
    if (compareSeriesRef.current) {
      let sourceCandles = compareCandles;
      if (mode === "training" && allCandles.length) {
        const cutTime = allCandles[Math.min(revealCount, allCandles.length) - 1]?.time;
        if (cutTime != null) sourceCandles = compareCandles.filter((c) => c.time <= cutTime);
      }
      const data = compareSeriesData(compareSettings.type, sourceCandles);
      try {
        compareSeriesRef.current.setData(data);
        // نحاذي بالموضع المنطقي (logical range) مش بالتوقيت المطلق - نفس السبب
        // المشروح فوق بـ setupCompareChart (تفادي انزياح الخط العمودي بين اللوحتين)
        const mainRange = chartRef.current?.timeScale().getVisibleLogicalRange();
        if (mainRange) compareChartRef.current?.timeScale().setVisibleLogicalRange(mainRange);
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareCandles, revealCount, allCandles, mode]);


  /* جلب بيانات رمز المقارنة (نفس مصدر البيانات اللي بتستخدمه أداة الريبلاي - Yahoo Finance) */
  useEffect(() => {
    if (!compareOpen) return;
    let cancelled = false;
    let comparePollTimer = null;
    async function loadCompare() {
      setCompareLoading(true);
      setCompareError("");
      try {
        const info = getAssetByValue(compareSymbol);
        if (!info?.yahoo) throw new Error("هذا الرمز غير مدعوم للمقارنة حالياً");
        const tdInterval = INTERVAL_MAP[interval];
        const res = await fetch(
          `/api/replay-candles?symbol=${encodeURIComponent(info.yahoo)}&interval=${tdInterval}&count=${maxBars}`
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const candles = sanitizeCandles(data.candles || []);
        if (cancelled) return;
        setCompareCandles(candles);
      } catch (e) {
        if (!cancelled) { setCompareError(e.message || "تعذّر تحميل بيانات المقارنة"); setCompareCandles([]); }
      } finally {
        if (!cancelled) setCompareLoading(false);
      }
    }
    /* تحديث خفيف دوري لبيانات المقارنة بوضع المباشر - قبل هالتعديل كانت لوحة
       المقارنة تُجلب مرة وحدة بس عند الفتح وما تتحدث أبداً بعدها، فمع الوقت
       تصير هي القديمة (نفس مشكلة الشارت الرئيسي بالظبط بس بالاتجاه المعاكس).
       نستخدم count صغير (=3) عشان الطلب يستفيد من liveRangeDays الخفيف
       بالـ API (شوف route.js) وما يثقل على المزوّد. */
    async function pollCompareOnce() {
      try {
        const info = getAssetByValue(compareSymbol);
        if (!info?.yahoo) return;
        const tdInterval = INTERVAL_MAP[interval];
        const res = await fetch(
          `/api/replay-candles?symbol=${encodeURIComponent(info.yahoo)}&interval=${tdInterval}&count=3`
        );
        const data = await res.json();
        if (data.error || !data.candles?.length) return;
        const fresh = sanitizeCandles(data.candles);
        if (fresh.length === 0) return;
        const lastFresh = fresh[fresh.length - 1];
        if (cancelled) return;
        setCompareCandles((prev) => {
          if (prev.length === 0) return prev;
          const merged = [...prev];
          if (merged[merged.length - 1].time === lastFresh.time) {
            merged[merged.length - 1] = lastFresh;
          } else if (lastFresh.time > merged[merged.length - 1].time) {
            merged.push(lastFresh);
          } else {
            return prev;
          }
          return merged;
        });
      } catch (e) {
        console.error("compare live poll failed:", e);
      }
    }
    loadCompare();
    if (mode === "live") {
      comparePollTimer = setInterval(pollCompareOnce, 5000);
    }
    return () => { cancelled = true; if (comparePollTimer) clearInterval(comparePollTimer); };
  }, [compareOpen, compareSymbol, interval, maxBars, mode]);

  function toggleCompare() {
    setCompareOpen((v) => {
      const next = !v;
      if (!next) setMaximizedPane((p) => (p === "compare" ? null : p));
      return next;
    });
  }
  function toggleMaximizePane(pane) {
    setMaximizedPane((p) => (p === pane ? null : pane));
  }
  /* سحب القاسم بين الشارت الرئيسي ولوحة المقارنة لتكبير/تصغير أي منهم يدوياً (زي تريدنغ فيو بالظبط) */
  function onDividerMouseDown(e) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = compareHeightPxRef.current;
    function onMove(ev) {
      const delta = ev.clientY - startY;
      const next = Math.max(80, startHeight - delta);
      compareHeightPxRef.current = next;
      setCompareHeightPx(next);
      chartRef.current?.__resize?.();
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  /* ===================== جلب البيانات ===================== */
  const loadData = useCallback(async () => {
    stopLivePoll();
    setLoading(true);
    setError("");
    setIsPlaying(false);
    drawingsRef.current = [];
    drawStateRef.current = null;
    forceFullReloadRef.current = true;

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
  /* علم بيتفعّل مع كل استدعاء loadData() (تبديل وضع/أصل/فريم/رجوع للمباشر بعد
     القص...) عشان نجبر تحديث الشارت الجاي يعمل setData كامل، بدل ما يعتمد بس
     على مقارنة الأطوال (طول المصفوفة القديمة ممكن يطابق الجديدة بالصدفة، زي
     لما ترجعي من التدريب للمباشر، فيغلط ويظنها "تيك حي عادي" ويستخدم update()
     بس عالشمعة الأخيرة، فتضل الشموع القديمة ظاهرة مع شمعة جديدة بعيدة زمنياً
     = فجوة وتعليق بالشارت). */
  const forceFullReloadRef = useRef(false);
  useEffect(() => {
    if (!seriesRef.current || allCandles.length === 0) return;
    const prevLen = prevCandlesRef.current?.length ?? -1;
    const prevReveal = prevRevealRef.current;
    const forceFullReload = forceFullReloadRef.current;
    forceFullReloadRef.current = false;

    // وضع التدريب: خطوة وحدة للأمام (تشغيل تلقائي / الشمعة التالية) بنفس مصفوفة الشموع
    const trainingStep = !forceFullReload && mode === "training" && allCandles.length === prevLen && revealCount === prevReveal + 1;
    // وضع السوق الحي: كل بولينغ (كل 5 ثواني) إما بيحدّث آخر شمعة أو بيضيف شمعة جديدة بس
    const liveTick = !forceFullReload && mode === "live" && revealCount === allCandles.length && (allCandles.length === prevLen || allCandles.length === prevLen + 1);

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
      if (data.error || !data.candles?.length) {
        console.error("live poll: empty/error response", data.error);
        handleLivePollFailure();
        return;
      }
      const fresh = sanitizeCandles(data.candles);
      if (fresh.length === 0) { handleLivePollFailure(); return; }
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
      livePollFailCountRef.current = 0; // نجح التحديث - نصفّر عداد الفشل
    } catch (e) {
      console.error("live poll failed:", e);
      handleLivePollFailure();
    }
  }

  /* لو التحديث اللايف الجزئي (pollLiveOnce) فشل عدة مرات متتالية (شبكة/تقييد
     مؤقت من مزوّد البيانات)، منعمل إعادة تحميل كاملة بدل ما نضل نحاول تحديثات
     صغيرة فاشلة للأبد بصمت - هيك الشارت الرئيسي ما يضل "متجمّد" على نقطة قديمة
     بينما لوحة المقارنة (يلي بتنجلب من جديد بشكل مستقل) عم تعرض بيانات أحدث. */
  function handleLivePollFailure() {
    livePollFailCountRef.current += 1;
    if (livePollFailCountRef.current >= 3) {
      livePollFailCountRef.current = 0;
      loadData();
    }
  }

  function startLivePoll(initialCandles) {
    stopLivePoll();
    if (initialCandles?.length) {
      forminCandleStartRef.current = initialCandles[initialCandles.length - 1].time;
      updateLivePrice(initialCandles[initialCandles.length - 1].close);
    }
    startCountdownTick();
    // مهم: ما منستدعي pollLiveOnce() فوراً هون. الشارت لسا ما طبّق البيانات الجديدة
    // كاملة (setData بتصير بـ useEffect منفصل بعد الرندر). لو استدعيناها فوراً ممكن
    // تحاول تحدّث (update) شمعة قبل ما ينضبط الشارت على المجموعة الجديدة، ومكتبة
    // lightweight-charts بترفض هيك تحديث وبتعمل throw exception يكسر الصفحة كلها
    // (هاي كانت سبب مشكلة "شارت عشوائي" اللي بتطلع وقت التبديل بوضع السوق الحي).
    setTimeout(pollLiveOnce, 0);
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

  /* ===================== أداة القص: اختيار نقطة بداية الاستعراض بالضغط على الشارت ===================== */
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

  /* شريط علوي واحد مضغوط (ستايل تريدنغ فيو): كل شي بصف واحد - الأصل/الفريم/السرعة
     يمين، وأزرار الإجراءات (عشوائي/قص/مقارنة/تصدير/إعادة تعيين/شاشة كاملة/إعدادات)
     شمال، بدون صناديق كبيرة فوق بعض زي قبل. */
  function renderTopBar() {
    const mini = (active) => ({ ...tabStyle(active), padding: "0.4rem 0.65rem", fontSize: 12.5, borderRadius: 8 });
    return (
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center",
        marginBottom: "0.6rem", background: "linear-gradient(145deg, #14120a, #0d0d0a)",
        border: `1px solid ${GOLD}26`, borderRadius: 10, padding: "0.4rem 0.6rem",
      }}>
        <select
          value={assetValue}
          onChange={(e) => setAssetValue(e.target.value)}
          disabled={randomChart}
          title="الأصل"
          style={{ ...selectStyle, minWidth: 130, padding: "0.35rem 0.5rem", fontSize: 12.5 }}
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

        <select value={interval} onChange={(e) => setIntervalValue(e.target.value)} title="الفريم"
          style={{ ...selectStyle, minWidth: 70, padding: "0.35rem 0.5rem", fontSize: 12.5 }}>
          {INTERVALS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>

        {mode === "training" && (
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} title="السرعة"
            style={{ ...selectStyle, minWidth: 70, padding: "0.35rem 0.5rem", fontSize: 12.5 }}>
            {SPEEDS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
        )}

        <span style={{ ...mini(mode === "live"), cursor: "default" }}>
          {mode === "live" ? "📡 مباشر" : "🎯 تاريخي"}
        </span>
        {mode === "training" && (
          <button onClick={() => switchMode("live")} style={mini(false)} title="ارجعي للمتابعة المباشرة للسوق">🔴 رجوع للمباشر</button>
        )}

        <div style={{ flex: 1 }} />

        {mode === "training" && (
          <>
            <button onClick={handleRandomStart} style={mini(false)} title="بداية عشوائية جديدة">🎲</button>
            <button onClick={handleReset} style={mini(false)} title="إعادة من البداية">⏮</button>
            <button onClick={togglePlay} disabled={finished || loading} style={mini(isPlaying)} title={isPlaying ? "إيقاف" : "تشغيل تلقائي"}>
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button onClick={handleNext} disabled={finished || loading} style={mini(false)} title="الشمعة التالية">⏭</button>
            <div style={{ width: 1, height: 22, background: "#2a2a2a" }} />
          </>
        )}
        {mode === "live" && (
          <>
            <button onClick={() => loadData()} style={mini(false)} title="تحديث">🔄</button>
            <div style={{ width: 1, height: 22, background: "#2a2a2a" }} />
          </>
        )}

        <button
          onClick={() => setRandomChart((r) => !r)}
          style={mini(randomChart)}
          title="حركة سعر مولّدة عشوائياً بدل السوق الحقيقي"
        >
          🎲 عشوائي
        </button>
        <button
          onClick={toggleCutMode}
          style={mini(cutMode)}
          title="اضغطي الزر، وبعدين دوسي على أي شمعة بالشارت لتبلّشي الاستعراض منها"
          disabled={!supported || allCandles.length === 0}
        >
          ✂️ {cutMode ? "دوسي على الشارت..." : "بداية"}
        </button>
        <button onClick={toggleCompare} style={mini(compareOpen)} title="اعرضي رمز ثاني بلوحة منفصلة أسفل الشارت للمقارنة">
          🔀 مقارنة
        </button>
        <button onClick={handleExportImage} style={mini(false)} title="تصدير كصورة">📷</button>
        <button onClick={handleResetView} style={mini(false)} title="إعادة الزوم والسكرول لوضعهم الطبيعي">⟲</button>
        <button onClick={toggleFullscreen} style={mini(isFullscreen)} title="شاشة كاملة">
          {isFullscreen ? "⤡" : "⤢"}
        </button>
        <button onClick={() => setSettingsOpen(true)} style={mini(false)} title="إعدادات الشارت">⚙️</button>
      </div>
    );
  }

  /* شريط أدوات الرسم العمودي (ستايل تريدنغ فيو) — عمود جانبي ثابت بجانب الشارت
     (مش طايف فوقه)، عالشمال دايماً بغض النظر عن اتجاه الصفحة، ومقسّم لأقسام.
     كل مجموعة فيها أكتر من أداة بتظهر كأيقونة وحدة + سهم صغير: ضغطة عالسهم
     بتفتح قائمة جانبية بأسماء كل الأدوات واضحة زي تريدنغ فيو تماماً. */
  function renderDrawToolbar() {
    function openFlyout(gi, btnEl) {
      groupBtnRefs.current[gi] = btnEl;
      setOpenToolGroup((cur) => (cur === gi ? null : gi));
    }
    function pickTool(gi, id) {
      setActiveTool(id);
      setToolGroupDefault((prev) => ({ ...prev, [gi]: id }));
      setOpenToolGroup(null);
    }
    return (
      <div style={{
        flex: "0 0 auto", alignSelf: "stretch", marginLeft: 8, position: "relative",
        display: "flex", flexDirection: "column", gap: 4,
        background: "#1a1a1a", border: "1px solid #2f2f2f", borderRadius: 12, padding: 7,
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        height: "100%", overflowY: "auto", overflowX: "visible",
      }}>
        {TOOL_GROUPS.map((group, gi) => {
          const hasMultiple = group.length > 1;
          const currentId = hasMultiple ? (toolGroupDefault[gi] || group[0]) : group[0];
          const isActive = group.includes(activeTool);
          return (
            <div key={gi} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {gi > 0 && <div style={{ height: 1, background: "#333", margin: "3px 4px" }} />}
              <button
                type="button"
                title={TOOL_TITLES[currentId]}
                onClick={(e) => { e.stopPropagation(); setActiveTool((cur) => (cur === currentId ? "cursor" : currentId)); }}
                style={{ ...toolBtnStyle(isActive), position: "relative" }}
              >
                <ToolIcon id={currentId} />
                {hasMultiple && (
                  <span
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); openFlyout(gi, e.currentTarget.parentElement); }}
                    style={{
                      position: "absolute", bottom: 1, right: 1, width: 0, height: 0,
                      borderLeft: "4px solid transparent", borderBottom: "4px solid #8a8a8a",
                      cursor: "pointer",
                    }}
                  />
                )}
              </button>
              {hasMultiple && openToolGroup === gi && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute", zIndex: 25, left: "100%", marginLeft: 8,
                    top: groupBtnRefs.current[gi]?.offsetTop || 0,
                    background: "#1c1c1c", border: "1px solid #333", borderRadius: 10,
                    boxShadow: "0 8px 28px rgba(0,0,0,0.55)", minWidth: 230,
                    maxHeight: 420, overflowY: "auto", padding: "6px 0",
                  }}
                >
                  {(TOOL_GROUP_SECTIONS[gi] || [{ title: null, tools: group }]).map((section, si) => (
                    <div key={si}>
                      {section.title && (
                        <div style={{
                          padding: "6px 14px 4px", fontSize: 10.5, fontWeight: 700,
                          color: "#777", letterSpacing: 0.5,
                        }}>
                          {section.title}
                        </div>
                      )}
                      {section.tools.map((id) => (
                        <div
                          key={id}
                          onClick={() => pickTool(gi, id)}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            gap: 12, padding: "8px 14px", cursor: "pointer", fontSize: 13,
                            color: activeTool === id ? GOLD_LIGHT : "#e5e5e5",
                            background: activeTool === id ? "#262626" : "transparent",
                          }}
                          onMouseEnter={(e) => { if (activeTool !== id) e.currentTarget.style.background = "#242424"; }}
                          onMouseLeave={(e) => { if (activeTool !== id) e.currentTarget.style.background = "transparent"; }}
                        >
                          <span>{TOOL_TITLES[id]}</span>
                          <span style={{ display: "flex", color: "#aaa", flexShrink: 0 }}><ToolIcon id={id} /></span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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

  /* شريط أدوات سريع وعائم يطلع فوق أي رسمة بمجرد ما تنكبس عليها كبسة وحدة (زي تريدنغ فيو):
     لون، سماكة، قفل، نسخ، حذف، وزر "..." لفتح لوحة الخصائص الكاملة لو احتجتي إعدادات أكتر */
  function renderSelectionToolbar() {
    const d = selectedDrawingId != null ? drawingsRef.current.find((dr) => dr.id === selectedDrawingId) : null;
    if (!d || d.tradeTag) return null;
    const style = d.style || {};
    const hasWidth = style.width !== undefined;
    const hasColor = style.color !== undefined || style.targetColor !== undefined;
    const locked = !!d.locked;
    return (
      <div
        ref={selectionToolbarRef}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute", zIndex: 21, transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 2,
          background: "#1a1a1a", border: "1px solid #333", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)", padding: "4px 5px",
        }}
      >
        {hasColor && (
          <input
            type="color"
            value={style.color || style.targetColor || GOLD_LIGHT}
            onChange={(e) => updateSelectedStyle({ color: e.target.value })}
            title="اللون"
            style={{ width: 24, height: 24, border: "1px solid #333", borderRadius: 5, background: "none", cursor: "pointer", padding: 0 }}
          />
        )}
        {hasWidth && (
          <select
            value={style.width || 1.5}
            onChange={(e) => updateSelectedStyle({ width: Number(e.target.value) })}
            title="السماكة"
            style={{ ...selectStyle, minWidth: 0, width: 52, padding: "0.3rem 0.35rem", fontSize: 12 }}
          >
            {[1, 1.5, 2, 3, 4].map((w) => (<option key={w} value={w}>{w}px</option>))}
          </select>
        )}
        <span style={selToolDivider} />
        <button type="button" onClick={duplicateSelectedDrawing} title="نسخ" style={selToolBtnStyle}>⧉</button>
        <button type="button" onClick={toggleSelectedLock} title={locked ? "فك القفل" : "قفل (منع التحريك)"} style={{ ...selToolBtnStyle, color: locked ? GOLD_LIGHT : "#ccc" }}>
          {locked ? "🔒" : "🔓"}
        </button>
        <button type="button" onClick={() => openProperties(d)} title="كل الإعدادات" style={selToolBtnStyle}>⋯</button>
        <span style={selToolDivider} />
        <button type="button" onClick={deleteSelectedDrawing} title="حذف" style={{ ...selToolBtnStyle, color: RED }}>🗑</button>
        <button type="button" onClick={clearSelection} title="إغلاق" style={selToolBtnStyle}>✕</button>
      </div>
    );
  }

  /* أدوات التحكم (الأصل/الفريم/السرعة + أزرار الاستعراض) */
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
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#999", marginTop: 8 }}>
          سبب الدخول
          <textarea
            value={tradeReason}
            onChange={(e) => setTradeReason(e.target.value)}
            placeholder="ليش دخلتي هالصفقة؟ (بينسجل مع الصفقة بالباك تست)"
            rows={2}
            style={{
              ...selectStyle, minWidth: 0, width: "100%", resize: "vertical",
              fontFamily: "inherit", padding: "6px 8px", lineHeight: 1.4,
            }}
          />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={confirmQuickTrade} disabled={savingTrade || !tradeReason.trim()} style={{ ...btnStyle("primary"), flex: 1, opacity: !tradeReason.trim() ? 0.5 : 1 }}>
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

  /* نافذة إعدادات الشارت الكاملة — ستايل تريدنغ فيو بالظبط: قائمة تبويبات عالجانب
     (رمز / خط الحالة / المقاييس والخطوط / لوحة / تداول / تنبيهات / أحداث) ومحتوى كل
     تبويب بمنطقة قابلة للتمرير لحالها. كل تغيير بينطبق فوراً وبينحفظ محلياً بالمتصفح. */
  function renderSettingsDialog() {
    if (!settingsOpen) return null;
    const set = (patch) => setChartSettings((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
    const row = (label, control) => (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #262626", gap: 12 }}>
        <span style={{ fontSize: 13, color: "#ccc" }}>{label}</span>
        {control}
      </div>
    );
    const sectionTitle = (label) => (
      <div style={{ fontSize: 11.5, color: "#777", margin: "16px 0 2px", fontWeight: 700 }}>{label}</div>
    );
    const colorInput = (val, onChange) => (
      <input type="color" value={val} onChange={(e) => onChange(e.target.value)}
        style={{ width: 40, height: 28, border: "1px solid #333", borderRadius: 6, background: "none", cursor: "pointer", padding: 0 }} />
    );
    const toggleInput = (val, onChange) => (
      <input type="checkbox" checked={val !== false} onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, cursor: "pointer", accentColor: GOLD }} />
    );
    const numberInput = (val, onChange, min = 0, max = 40) => (
      <input type="number" min={min} max={max} value={val}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        style={{ width: 60, background: "#0d0d0d", color: "#eee", border: "1px solid #333", borderRadius: 6, padding: "4px 6px", fontSize: 12.5, textAlign: "center" }} />
    );
    const textInput = (val, onChange, placeholder, width = 150) => (
      <input
        type="text" value={val} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width, background: "#0d0d0d", color: "#eee", border: "1px solid #333", borderRadius: 6, padding: "4px 6px", fontSize: 12.5 }}
      />
    );
    const disabledNote = (label) => (
      <div style={{ fontSize: 11.5, color: "#555", padding: "10px 0", borderBottom: "1px solid #262626", fontStyle: "italic" }}>
        {label}
      </div>
    );

    const TABS = [
      { key: "symbol", label: "رمز", icon: "𝍖" },
      { key: "status", label: "خط الحالة", icon: "≡" },
      { key: "scales", label: "المقاييس والخطوط", icon: "↕" },
      { key: "canvas", label: "لوحة", icon: "✎" },
      { key: "trading", label: "تداول", icon: "⤯" },
      { key: "alerts", label: "تنبيهات", icon: "🕐" },
      { key: "events", label: "أحداث", icon: "🗓" },
    ];

    function tabContent() {
      switch (settingsTab) {
        case "symbol":
          return (
            <>
              {sectionTitle("الشموع")}
              {row("لون شمعة الصعود", colorInput(chartSettings.up, (v) => set({ up: v })))}
              {row("لون شمعة الهبوط", colorInput(chartSettings.down, (v) => set({ down: v })))}
              {sectionTitle("القيم على الشارت")}
              {row("إظهار شريط O H L C", toggleInput(chartSettings.ohlcVisible, (v) => set({ ohlcVisible: v })))}
              {row("إظهار آخر قيمة على محور السعر", toggleInput(chartSettings.lastValueLabelVisible, (v) => set({ lastValueLabelVisible: v })))}
            </>
          );
        case "status":
          return (
            <>
              {sectionTitle("الأداة")}
              {row("رمز الأصل", toggleInput(chartSettings.statusShowSymbol, (v) => set({ statusShowSymbol: v })))}
              {row("الفريم الزمني", toggleInput(chartSettings.statusShowInterval, (v) => set({ statusShowInterval: v })))}
              {row("قيم الرسم البياني (O H L C)", toggleInput(chartSettings.statusShowValues, (v) => set({ statusShowValues: v })))}
              {row("خلفية شريط الحالة", toggleInput(chartSettings.statusShowBg, (v) => set({ statusShowBg: v })))}
            </>
          );
        case "scales":
          return (
            <>
              {sectionTitle("النص")}
              {row("لون نص المحاور (الأسعار والوقت)", colorInput(chartSettings.textColor || "#d1d4dc", (v) => set({ textColor: v })))}
              {sectionTitle("مقياس الأسعار")}
              {row("تحجيم تلقائي (Auto Scale)", toggleInput(chartSettings.autoScale, (v) => set({ autoScale: v })))}
              {sectionTitle("هوامش محور السعر (%)")}
              {row("الهامش الأعلى", numberInput(chartSettings.scaleMarginTop, (v) => set({ scaleMarginTop: v })))}
              {row("الهامش الأسفل", numberInput(chartSettings.scaleMarginBottom, (v) => set({ scaleMarginBottom: v })))}
              {sectionTitle("مقياس الوقت")}
              {disabledNote("يتبع توقيت جهازك تلقائياً")}
            </>
          );
        case "canvas":
          return (
            <>
              {sectionTitle("الخلفية")}
              {row("لون خلفية الشارت", colorInput(chartSettings.bg, (v) => set({ bg: v })))}
              {sectionTitle("الشبكة ومؤشر التقاطع")}
              {row("إظهار الشبكة", toggleInput(chartSettings.gridVisible, (v) => set({ gridVisible: v })))}
              {row("لون الشبكة", colorInput(chartSettings.gridColor, (v) => set({ gridColor: v })))}
              {row("لون مؤشر التقاطع", colorInput(chartSettings.crosshairColor, (v) => set({ crosshairColor: v })))}
              {sectionTitle("العلامة المائية")}
              {row("نص العلامة المائية", textInput(chartSettings.watermarkText, (v) => set({ watermarkText: v }), "فارغ = مخفية"))}
            </>
          );
        case "trading":
          return (
            <>
              {sectionTitle("أزرار التداول")}
              {row("إظهار أزرار شراء/بيع فوري", toggleInput(chartSettings.showTradeButtons, (v) => set({ showTradeButtons: v })))}
              {sectionTitle("الحجم الافتراضي")}
              {row("حجم الصفقة (لوت)", textInput(tradeLot, setTradeLot, "0.01", 80))}
            </>
          );
        case "alerts":
          return (
            <>
              {sectionTitle("رؤية خط الرسم البياني")}
              {row("خطوط التنبيه على الشارت", toggleInput(drawingsVisible, () => toggleDrawingsVisible()))}
              {row("التنبيهات النشطة فقط", toggleInput(chartSettings.activeAlertsOnly, (v) => set({ activeAlertsOnly: v })))}
              {sectionTitle("إشعارات")}
              {row("إخفاء \"التوست\" تلقائياً", toggleInput(chartSettings.autoHideToast, (v) => set({ autoHideToast: v })))}
            </>
          );
        case "events":
          return (
            <>
              {sectionTitle("الأحداث الاقتصادية")}
              {row("إظهار الأحداث على الشارت", toggleInput(chartSettings.showEvents, (v) => set({ showEvents: v })))}
              {disabledNote("تقويم الأحداث الاقتصادية بيوصل قريباً")}
            </>
          );
        default:
          return null;
      }
    }

    return (
      <div style={{
        position: "absolute", inset: 0, zIndex: 30, background: "#000000aa",
        display: "flex", alignItems: "center", justifyContent: "center",
      }} onClick={() => setSettingsOpen(false)}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 620, maxWidth: "92%", maxHeight: "82%", background: "#161616",
            border: `1px solid ${GOLD}44`, borderRadius: 14, padding: "1.1rem 1.3rem",
            display: "flex", flexDirection: "column",
          }}
        >
          <div style={{ fontWeight: 700, color: GOLD_LIGHT, marginBottom: 10, fontSize: 15, flexShrink: 0 }}>⚙️ إعدادات</div>
          <div style={{ display: "flex", flexDirection: "row", gap: 16, flex: 1, minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingLeft: 4 }}>
              {tabContent()}
            </div>
            <div style={{ width: 168, flexShrink: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSettingsTab(t.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, textAlign: "right",
                    padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: settingsTab === t.key ? "#262626" : "transparent",
                    color: settingsTab === t.key ? GOLD_LIGHT : "#ccc",
                    fontSize: 13, fontWeight: settingsTab === t.key ? 700 : 500,
                  }}
                >
                  <span style={{ width: 18, textAlign: "center", flexShrink: 0 }}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexShrink: 0 }}>
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

  /* نافذة إعدادات لوحة المقارنة: نوع الشارت (منطقة/خط/شموع) + ألوانه، بتنطبق فوراً وتنحفظ محلياً */
  function renderCompareSettingsDialog() {
    if (!compareSettingsOpen) return null;
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
    const typeOptions = [
      { value: "area", label: "منطقة (Area)" },
      { value: "line", label: "خط (Line)" },
      { value: "candles", label: "شموع (Candlestick)" },
    ];
    return (
      <div style={{
        position: "absolute", inset: 0, zIndex: 30, background: "#000000aa",
        display: "flex", alignItems: "center", justifyContent: "center",
      }} onClick={() => setCompareSettingsOpen(false)}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: 300, background: "#161616", border: `1px solid ${GOLD}44`, borderRadius: 14, padding: "1.1rem 1.3rem" }}
        >
          <div style={{ fontWeight: 700, color: GOLD_LIGHT, marginBottom: 6, fontSize: 15 }}>⚙️ إعدادات لوحة المقارنة</div>
          {row("نوع الشارت", (
            <select
              value={compareSettings.type}
              onChange={(e) => setCompareSettings((s) => ({ ...s, type: e.target.value }))}
              style={{ ...selectStyle, minWidth: 140, padding: "0.35rem 0.5rem" }}
            >
              {typeOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          ))}
          {compareSettings.type === "candles" ? (
            <>
              {row("لون شمعة الصعود", colorInput(compareSettings.up, (v) => setCompareSettings((s) => ({ ...s, up: v }))))}
              {row("لون شمعة الهبوط", colorInput(compareSettings.down, (v) => setCompareSettings((s) => ({ ...s, down: v }))))}
            </>
          ) : (
            <>
              {row("لون الخط", colorInput(compareSettings.lineColor, (v) => setCompareSettings((s) => ({ ...s, lineColor: v }))))}
              {compareSettings.type === "area" &&
                row("لون التعبئة", colorInput(compareSettings.fillColor, (v) => setCompareSettings((s) => ({ ...s, fillColor: v }))))}
            </>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => setCompareSettings(DEFAULT_COMPARE_SETTINGS)} style={{ ...btnStyle("secondary"), flex: 1 }}>
              الافتراضي
            </button>
            <button onClick={() => setCompareSettingsOpen(false)} style={{ ...btnStyle("primary"), flex: 1 }}>
              تم
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ملاحظة: renderControls تم دمجها بالكامل جوا renderTopBar (شريط واحد مضغوط
  // بدل صندوقين فوق بعض)، فما عاد في حاجة لها هون.


  /* بادج السوق الحي: سعر + عداد إغلاق الشمعة بتنسيق واضح + شريط تقدّم */
  function renderLiveBadge() {
    return null; // تم إخفاء شريط "مباشر / آخر سعر / إغلاق الشمعة خلال" بناءً على طلب المستخدم
    // eslint-disable-next-line no-unreachable
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
    const bgStyle = chartSettings.statusShowBg !== false ? "#00000066" : "transparent";
    return (
      <div style={{
        position: "absolute", top: 10, left: 10, zIndex: 8, pointerEvents: "none",
        display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem 0.7rem",
        fontSize: 12.5, fontFamily: "monospace, sans-serif",
      }}>
        {(chartSettings.statusShowSymbol !== false || chartSettings.statusShowInterval !== false) && (
          <span style={{ color: "#eee", fontWeight: 700, background: bgStyle, padding: "2px 8px", borderRadius: 6 }}>
            {chartSettings.statusShowSymbol !== false && (info?.label || assetValue)}
            {chartSettings.statusShowSymbol !== false && chartSettings.statusShowInterval !== false && " · "}
            {chartSettings.statusShowInterval !== false && intervalLabel}
          </span>
        )}
        {chartSettings.statusShowValues !== false && (
          <span style={{ color: col, background: bgStyle, padding: "2px 8px", borderRadius: 6 }}>
            O <b>{fmt(last.open)}</b>&nbsp;&nbsp;H <b>{fmt(last.high)}</b>&nbsp;&nbsp;L <b>{fmt(last.low)}</b>&nbsp;&nbsp;C <b>{fmt(last.close)}</b>
          </span>
        )}
      </div>
    );
  }

  /* لوحة شراء/بيع فوري عائمة فوق الشارت (نفس ستايل تريدنغ فيو تماماً): صندوقين
     صغار جنب بعض (بيع أحمر يمين... بالـRTL بيطلع عالشمال، شراء أزرق) والفرق
     (سبريد) بالنص. هاي بديل أزرار "شراء فوري / بيع فوري" الكبيرة يلي كانت
     آخذة مساحة بشريط الأدوات. */
  function renderQuickTradeWidget() {
    if (chartSettings.showTradeButtons === false) return null;
    if (!supported || allCandles.length === 0) return null;
    const list = mode === "training" ? allCandles.slice(0, revealCount) : allCandles;
    const last = list[list.length - 1];
    if (!last) return null;
    const SPREAD = last.close < 10 ? 0.00012 : last.close < 100 ? 0.0025 : 0.36;
    const digits = last.close < 10 ? 5 : last.close < 100 ? 4 : 2;
    const bid = last.close - SPREAD / 2;
    const ask = last.close + SPREAD / 2;
    const disabled = !!pendingTrade;
    const box = (label, price, color, onClick) => (
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
          minWidth: 78, padding: "0.3rem 0.55rem", borderRadius: 6, cursor: disabled ? "default" : "pointer",
          background: "#0d0d0acc", border: `1.5px solid ${color}`, color,
          fontFamily: "monospace, sans-serif", opacity: disabled ? 0.5 : 1,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>{price.toFixed(digits)}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700 }}>{label}</span>
      </button>
    );
    return (
      <div style={{
        position: "absolute", top: 42, left: 10, zIndex: 8,
        display: "flex", alignItems: "center", gap: 4,
      }}>
        {box("بيع", bid, RED, () => openQuickTrade("sell"))}
        <span style={{ fontSize: 11, color: "#888", padding: "0 2px" }}>{(ask - bid).toFixed(digits)}</span>
        {box("شراء", ask, "#4f7cff", () => openQuickTrade("buy"))}
      </div>
    );
  }

  return (
    <div>
      {!isFullscreen && renderTopBar()}

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
        {/* صف أفقي خارجي: شريط الأدوات عمود ثابت يمتد على كامل ارتفاع منطقة الشارت
            (اللوحة الرئيسية + القاسم + لوحة المقارنة سوا) بالظبط متل تريدنغ فيو،
            مش محصور بارتفاع اللوحة الرئيسية لحالها. الترتيب هون (المحتوى أولاً
            بالـ DOM ثم الشريط) مقصود: الصفحة كلها RTL، فبهيك ترتيب الشريط بيضل
            ثابت عالشمال دايماً من غير ما نضطر نقلب اتجاه أي نص عربي جوا الشارت. */}
        <div style={{ display: "flex", flexDirection: "row", flex: 1, minHeight: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0 }}>
            {/* اللوحة الرئيسية - ارتفاعها الفعلي مضبوط مباشرة بالبكسل من JS (mainPaneRef)
                عشان يضل مطابق تماماً لارتفاع الشارت نفسه (overflow:hidden هون بيمنعه
                من "يفلت" ويسيب فراغ أسود تحت الشارت) */}
            <div
              ref={mainPaneRef}
              style={{ display: maximizedPane === "compare" ? "none" : "flex", flexDirection: "column", flex: "0 0 auto", minHeight: 0, overflow: "hidden", position: "relative" }}
            >
              <div ref={chartAreaRef} style={{ position: "relative", width: "100%", height: "100%", flex: 1, minWidth: 0 }}>
                {!loading && allCandles.length > 0 && !editDraft && chartSettings.ohlcVisible !== false && renderOHLCTicker()}
                {!loading && allCandles.length > 0 && !editDraft && renderQuickTradeWidget()}
                {!loading && allCandles.length > 0 && renderPropertiesDialog()}
                {!loading && allCandles.length > 0 && renderSelectionToolbar()}
                {!loading && renderTradePanel()}
                {!loading && renderTradeToast()}
                {!loading && renderContextMenu()}
                {compareOpen && (
                  <div style={paneCornerBadgeStyle("right")}>
                    <button onClick={() => toggleMaximizePane("main")} style={paneCornerBtnStyle} title={maximizedPane === "main" ? "استعادة العرض المقسوم" : "تكبير هاي اللوحة (أو دبل-كليك على القاسم)"}>
                      {maximizedPane === "main" ? "⤡" : "⤢"}
                    </button>
                  </div>
                )}
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
                <div
                  ref={priceTagRef}
                  style={{
                    position: "absolute", right: 0, transform: "translateY(-50%)",
                    display: "none", flexDirection: "column", alignItems: "flex-end",
                    padding: "3px 8px", borderRadius: "4px 0 0 4px", zIndex: 4,
                    pointerEvents: "none", minWidth: 70, fontFamily: "monospace, sans-serif",
                  }}
                >
                  <span data-role="symbol" style={{ fontSize: 10, fontWeight: 700, color: "#0a0a0a" }} />
                  <span data-role="price" style={{ fontSize: 13, fontWeight: 800, color: "#0a0a0a", lineHeight: 1.2 }} />
                  <span data-role="countdown" style={{ fontSize: 10, color: "#0a0a0aaa", display: "none" }} />
                </div>
              </div>
            </div>

            {/* قاسم قابل للسحب لتكبير/تصغير لوحة المقارنة (زي تريدنغ فيو بالظبط) - اسحبيه لفوق/تحت،
                أو دبل-كليك عليه يرجّع النسبة الافتراضية */}
            {compareOpen && !maximizedPane && (
              <div
                onMouseDown={onDividerMouseDown}
                onDoubleClick={() => { compareHeightPxRef.current = DEFAULT_COMPARE_HEIGHT; setCompareHeightPx(DEFAULT_COMPARE_HEIGHT); chartRef.current?.__resize?.(); }}
                title="اسحبي لتكبير/تصغير لوحة المقارنة، أو دبل-كليك للرجوع للحجم الافتراضي"
                style={dividerStyle}
              >
                <span style={dividerGripStyle} />
              </div>
            )}

            {/* لوحة المقارنة: رمز ثاني للقراءة فقط، بدون أدوات رسم، مزامَنة سكرول/زوم مع اللوحة الرئيسية.
                نفس سطح الشارت الرئيسي بالضبط (بدون حدود/زوايا مدوّرة) عشان تبان لوحة وحدة متصلة زي تريدنغ فيو */}
            {compareOpen && (
              <div
                ref={comparePaneRef}
                style={{ display: maximizedPane === "main" ? "none" : "flex", flexDirection: "column", flex: "0 0 auto", minHeight: 0, overflow: "hidden", position: "relative" }}
              >
                <div style={paneCornerBadgeStyle()}>
                  <span>🔀</span>
                  <select
                    value={compareSymbol}
                    onChange={(e) => setCompareSymbol(e.target.value)}
                    style={{ ...selectStyle, minWidth: 130, padding: "0.2rem 0.4rem", fontSize: 11.5, background: "#0000" }}
                  >
                    {ASSETS.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.items.map((it) => (
                          <option key={it.v} value={it.v} disabled={!it.yahoo}>{it.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {compareLoading && <span style={{ fontSize: 11, color: "#888" }}>...جاري التحميل</span>}
                  {compareError && <span style={{ fontSize: 11, color: RED }}>{compareError}</span>}
                  <button onClick={() => setCompareSettingsOpen(true)} style={paneCornerBtnStyle} title="إعدادات لوحة المقارنة (نوع الشارت والألوان)">⚙️</button>
                  <button onClick={() => toggleMaximizePane("compare")} style={paneCornerBtnStyle} title={maximizedPane === "compare" ? "استعادة العرض المقسوم" : "تكبير هاي اللوحة (أو دبل-كليك على القاسم)"}>
                    {maximizedPane === "compare" ? "⤡" : "⤢"}
                  </button>
                  <button onClick={toggleCompare} style={paneCornerBtnStyle} title="إغلاق لوحة المقارنة">✕</button>
                </div>
                <div ref={compareContainerRef} style={{ width: "100%", height: "100%", flex: 1, minHeight: 0 }} />
                {renderCompareSettingsDialog()}
              </div>
            )}
          </div>
          {!loading && allCandles.length > 0 && renderDrawToolbar()}
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

      {openToolGroup !== null && (
        <div
          onClick={() => setOpenToolGroup(null)}
          style={{ position: "fixed", inset: 0, zIndex: 24 }}
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

const selToolBtnStyle = {
  width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
  background: "none", border: "none", borderRadius: 6, color: "#ccc", cursor: "pointer", fontSize: 14,
};
const selToolDivider = { width: 1, height: 18, background: "#333", margin: "0 2px", flexShrink: 0 };

function paneCornerBadgeStyle(side) {
  return {
    position: "absolute", top: 8, [side === "right" ? "right" : "left"]: 8, zIndex: 6,
    display: "flex", alignItems: "center", gap: 6,
    background: "rgba(13,13,10,0.72)", backdropFilter: "blur(2px)",
    border: `1px solid ${GOLD}22`, borderRadius: 6,
    padding: "0.2rem 0.45rem", fontSize: 12, fontWeight: 700, color: "#ddd",
    pointerEvents: "auto",
  };
}
const paneCornerBtnStyle = {
  background: "none", border: "none", color: GOLD_LIGHT,
  cursor: "pointer", fontSize: 13, padding: "0 0.15rem", lineHeight: 1,
};
/* القاسم القابل للسحب بين الشارت الرئيسي ولوحة المقارنة - سطح واحد متصل بدون فراغ، زي تريدنغ فيو بالظبط */
const dividerStyle = {
  height: 10, flexShrink: 0, cursor: "row-resize",
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "transparent",
};
const dividerGripStyle = {
  width: 40, height: 3, borderRadius: 3, background: `${GOLD}55`,
};

function btnStyle(kind) {
  const base = { padding: "0.55rem 1rem", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none" };
  if (kind === "primary") return { ...base, background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`, color: "#1a1200" };
  return { ...base, background: "transparent", border: `1px solid ${GOLD}44`, color: GOLD };
}
