"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownToLine, ArrowUpToLine, BarChart3, Bell, Blocks, Brain, ChevronDown, ChevronRight, CircleCheck as CheckCircle2, Clock, Crown, Droplets, ExternalLink, Eye, LayoutGrid, Radio, RefreshCw, RotateCcw, Rows3, Sparkles, Target, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { ASSETS, getAssetByValue } from "@/lib/assets";
import { analyzeSymbol, getCorrelatedSymbol } from "@/lib/qais/engine";
import { createClient } from "@/lib/supabase-client";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/* ============================================================================
   MarketIntelligenceView — "Qais Market Intelligence" — لوحة القيادة الرئيسية
   يشتغل عليها QAIS SK Engine (lib/qais/engine.js) بشكل مباشر وحي، وهي المصدر
   الوحيد اللي بيحسب كل شي هون: الشارت + لوحة التحليل + الأربع كروت تحت +
   ملخص السوق + الإشعارات. لا أرقام وهمية — كل قيمة إما محسوبة لحظياً من
   analyzeSymbol()، أو جايه من /api/radar (نفس المحرك، محفوظ بالكرون)، أو من
   /api/market-intelligence (Yahoo Finance فعلي).
   ============================================================================ */

const GOLD = "#DCD4F7";
const GOLD_LIGHT = "#F5F3FF";
const GREEN = "#10E5A0";
const RED = "#FF453A";
const BLUE = "#7C4DFF";
const AMBER = "#F0A13C";
const NEUTRAL = "#F5F3FF";
const CHART_H = 600;
const ANIM_MS = 450;

const glass = {
  background: "#141024",
  border: `1px solid #2A2145`,
  borderRadius: 0,
  boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
  backdropFilter: "blur(10px)",
};

const TF_LABELS = { m5: "M5", m15: "M15", h1: "H1", h4: "H4", daily: "D1" };
const TF_TOOLBAR_ORDER = ["m5", "m15", "h1", "h4", "daily"];
const YAHOO_OVERRIDE = { XAUEUR: "XAUEUR=X" };

/* مترجم على مستوى الموديول: الدوال يلي فوق (radarStatusMeta وغيرها) هي دوال
   خارج الكومبوننت وما فيها وصول مباشر لـ useLocale، فبنمررلها آخر ترجمة "t"
   محفوظة عبر setRadarTranslator (بتنعمل مزامنة كل رندر بالكومبوننت تحت). */
let _radarT = (key) => key;
function setRadarTranslator(fn) {
  if (typeof fn === "function") _radarT = fn;
}
function _t(...args) {
  return _radarT(...args);
}

async function fetchCandles(yahoo, interval, count = 5000) {
  try {
    const res = await fetch(`/api/replay-candles?symbol=${encodeURIComponent(yahoo)}&interval=${interval}&count=${count}`);
    const data = await res.json();
    return data.candles || [];
  } catch {
    return [];
  }
}

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

function fmt(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n >= 100 ? n.toFixed(2) : n.toFixed(4);
}

/* -------------------- الجلسات (UTC) — نفس الأوقات المعتمدة عالمياً --------------------
   أربع جلسات كاملة (Sydney/Tokyo/London/New York). Sydney بتلف منتصف الليل
   (21:00 → 06:00 UTC) فمنعاملها كنطاق "ملفوف" في كل الحسابات تحت. */
const SESSION_DEFS = [
  { key: "sydney", label: "Sydney", short: "SYD", start: 21, end: 6, color: "#DCD4F7" },
  { key: "tokyo", label: "Tokyo", short: "TOK", start: 0, end: 9, color: GOLD },
  { key: "london", label: "London", short: "LON", start: 7, end: 16, color: BLUE },
  { key: "newyork", label: "New York", short: "NY", start: 12, end: 21, color: GREEN },
];

/* أي جلستين متلاقيتين = أعلى سيولة باليوم، وبالأخص London + New York */
const OVERLAP_DEFS = [
  { keys: ["london", "newyork"], label: "London + New York", liquidity: "Very High" },
  { keys: ["tokyo", "london"], label: "Tokyo + London", liquidity: "High" },
  { keys: ["sydney", "tokyo"], label: "Sydney + Tokyo", liquidity: "Medium" },
];

/* محتوى تعليمي ثابت لكل جلسة — هاد يلي بيتعبى بكروت الشرح تحت الخط الزمني */
const SESSION_INFO = {
  sydney: { liquidity: "radar.levelLow", volatility: "radar.levelLow", behaviour: "radar.behQuiet", recommendation: "radar.recSydney" },
  tokyo: { liquidity: "radar.levelMedium", volatility: "radar.levelMedium", behaviour: "radar.behAsiaRange", recommendation: "radar.recTokyo" },
  london: { liquidity: "radar.levelVeryHigh", volatility: "radar.levelHigh", behaviour: "radar.behTrendExpansion", recommendation: "radar.recLondon" },
  newyork: { liquidity: "radar.levelHigh", volatility: "radar.levelHigh", behaviour: "radar.behNewsDriven", recommendation: "radar.recNewYork" },
  off: { liquidity: "radar.levelVeryLow", volatility: "radar.levelVeryLow", behaviour: "radar.behThin", recommendation: "radar.recOff" },
};

/* هل الساعة h ضمن نطاق الجلسة s؟ بيدعم النطاقات الملفوفة لمنتصف الليل (start > end) */
function isSessionActive(s, h) {
  return s.start < s.end ? h >= s.start && h < s.end : h >= s.start || h < s.end;
}

export function getSessionsStatus() {
  const h = new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
  return SESSION_DEFS.map((s) => ({ ...s, active: isSessionActive(s, h) }));
}

/* أفضل تداخل مطابق (لو أي جلستين نشطتين بنفس الوقت)، وإلا null */
export function getActiveOverlap(sessions) {
  const activeKeys = sessions.filter((s) => s.active).map((s) => s.key);
  if (activeKeys.length < 2) return null;
  return OVERLAP_DEFS.find((o) => o.keys.every((k) => activeKeys.includes(k))) || null;
}

export function getPrimarySession(sessions) {
  const overlap = getActiveOverlap(sessions);
  if (overlap) return `${overlap.label} Overlap`;
  const active = sessions.find((s) => s.active);
  if (active) return active.label;
  return _t("radar.sessionOff");
}

/* فرق الوقت (بالساعات) من now لغاية target، بيلف لليوم التالي لو الفرق سالب */
function hoursUntil(target, now) {
  let diff = target - now;
  if (diff <= 0) diff += 24;
  return diff;
}

function hoursLabel(h, t) {
  const totalMin = Math.max(0, Math.round(h * 60));
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh <= 0) return _t("radar.minShort", { n: mm });
  if (mm === 0) return _t("radar.hourShort", { n: hh });
  return _t("radar.hourMinShort", { n: hh, m: mm });
}

/* الجلسة النشطة هلأ (يلي رح تنتهي أقرب لو في أكثر من وحدة نشطة بنفس الوقت —
   حالة التداخل London/NY) + أقرب جلسة قادمة لسا ما بلشت */
function getSessionTimeline(sessions) {
  const now = new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
  const active = sessions.filter((s) => s.active);
  const inactive = sessions.filter((s) => !s.active);

  const current = active.length
    ? active.map((s) => ({ ...s, remaining: hoursUntil(s.end, now) })).sort((a, b) => a.remaining - b.remaining)[0]
    : null;

  const next = inactive.length
    ? inactive.map((s) => ({ ...s, startsIn: hoursUntil(s.start, now) })).sort((a, b) => a.startsIn - b.startsIn)[0]
    : null;

  return { now, current, next };
}

function relTime(iso, t) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return _t("radar.justNow");
  if (min < 60) return _t("radar.minutesAgo", { n: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return _t("radar.hoursAgo", { n: hr });
  return _t("radar.daysAgo", { n: Math.round(hr / 24) });
}

/* ============================================================================
   PRESENTATION-ONLY HELPERS — Chart Info Bar / Header status strip
   لا شي هون بيلمس محرك QAIS أو أي منطق قرار: كل القيم هون مجرد قراءة/تجميع
   عرضي لبيانات موجودة أصلاً (شموع حقيقية من allCandles، أو عناصر radarItems
   الجايه من /api/radar). ما في أي رقم مصطنع.
   ============================================================================ */

/* ATR(14) كلاسيكي (Wilder) من شموع حقيقية — مؤشر عرض فقط، ما بيتغذّى منه القرار */
function calcATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    if (!Number.isFinite(c.high) || !Number.isFinite(c.low) || !Number.isFinite(p.close)) continue;
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }
  if (trs.length < period) return null;
  const last = trs.slice(-period);
  return last.reduce((a, b) => a + b, 0) / last.length;
}

/* نسبة تغيّر اليوم: آخر شمعة يومية مقابل السابقة لها */
function dailyChangeFromCandles(dailyCandles) {
  if (!dailyCandles || dailyCandles.length < 2) return null;
  const last = dailyCandles[dailyCandles.length - 1];
  const prev = dailyCandles[dailyCandles.length - 2];
  if (!Number.isFinite(last?.close) || !Number.isFinite(prev?.close) || prev.close === 0) return null;
  return ((last.close - prev.close) / prev.close) * 100;
}

function lastVolume(candles) {
  if (!candles || !candles.length) return null;
  const v = candles[candles.length - 1]?.volume;
  return Number.isFinite(v) && v > 0 ? v : null;
}

function fmtVolume(n) {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function fmtPct(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtClock(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/* عدّاد تنازلي دقيق (H:MM:SS) لبدء أقرب جلسة — نفس بيانات hoursUntil، بس بدقة الثانية بدل الدقيقة */
function countdownLabel(hoursFraction) {
  const totalSec = Math.max(0, Math.round(hoursFraction * 3600));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

/* ألوان/تسميات نظام radar_status v2 — نفس القيم يلي بيرجعها المحرك (lib/qais/decision.js) بدون أي تغيير */
/* ============================================================================
   تبويبات لوح البيانات — الكوكبيت (تولبار + شارت + AI panel) بيضل ثابت فوق،
   وهاي التبويبات بتقسّم الأقسام التسعة يلي كانت كلها فوق بعض.
   ============================================================================ */
const DATA_TAB_KEY = "qta_radar_tab";

const DATA_TABS = [
  { key: "overview", labelKey: "radar.tabOverview", icon: Sparkles },
  { key: "liquidity", labelKey: "radar.tabLiquidity", icon: Droplets },
  { key: "market", labelKey: "radar.tabMarket", icon: LayoutGrid },
  { key: "opportunities", labelKey: "radar.tabOpportunities", icon: Zap },
];

function DataTabBar({ active, onSelect, counts }) {
  const { t } = useLocale();
  return (
    <div
      className="qmi-anim qmi-tabbar"
      style={{
        display: "flex",
        gap: 4,
        borderBottom: `1px solid #2A2145`,
        overflowX: "auto",
        paddingBottom: 0,
      }}
      role="tablist"
    >
      {DATA_TABS.map((tb) => {
        const on = active === tb.key;
        const Icon = tb.icon;
        const badge = counts?.[tb.key];
        return (
          <button
            key={tb.key}
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(tb.key)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              whiteSpace: "nowrap",
              background: on ? "#1C1630" : "transparent",
              border: "none",
              borderBottom: `2px solid ${on ? GOLD : "transparent"}`,
              color: on ? GOLD_LIGHT : "#6E6690",
              fontSize: 12.5,
              fontWeight: on ? 800 : 600,
              padding: "10px 16px",
              cursor: "pointer",
              transition: "color 150ms ease, background 150ms ease",
            }}
          >
            <Icon size={14} strokeWidth={1.75} aria-hidden />
            {t(tb.labelKey)}
            {badge != null && badge > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: on ? "#141024" : "#A79FC4",
                  background: on ? GOLD_LIGHT : "#241C3E",
                  borderRadius: 20,
                  padding: "1px 7px",
                  lineHeight: 1.6,
                }}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function radarStatusMeta(it) {
  const MAP = {
    green: { color: GREEN, label: it?.radar_signal_label || _t("radar.strongBuy") },
    blue: { color: BLUE, label: it?.radar_signal_label || _t("radar.buySetup") },
    yellow: { color: "#F0A13C", label: it?.radar_signal_label || _t("radar.neutralWaiting") },
    orange: { color: AMBER, label: it?.radar_signal_label || _t("radar.sellSetup") },
    red: { color: RED, label: it?.radar_signal_label || _t("radar.strongSell") },
    gray: { color: "#6E6690", label: it?.radar_signal_label || _t("radar.noSetup") },
  };
  return MAP[it?.radar_status] || MAP.gray;
}

export default function MarketIntelligenceView({ initialSymbol, embedded = false, onClose } = {}) {
  const { t, locale, dir } = useLocale();
  setRadarTranslator(t);
  const [symbol, setSymbol] = useState(initialSymbol || "XAUUSD");
  const [displayTF, setDisplayTF] = useState("h1");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [allCandles, setAllCandles] = useState({});
  const [tab, setTab] = useState("analysis"); // analysis | why

  const [snapshot, setSnapshot] = useState(null);
  const [radarItems, setRadarItems] = useState([]);
  const [openTradeSymbols, setOpenTradeSymbols] = useState(() => new Set());
  const [newsToday, setNewsToday] = useState({ high: 0 });
  const [sessions, setSessions] = useState(getSessionsStatus());
  const [selectedLiqSymbol, setSelectedLiqSymbol] = useState(null);
  const [lastUpdateAt, setLastUpdateAt] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [currencyTrend, setCurrencyTrend] = useState({});
  /* تبويب لوح البيانات تحت الكوكبيت. الصفحة كانت ٩ أقسام فوق بعض بسكرول
     طويل — هلأ الشارت والتحليل ثابتين فوق، والباقي بتبويبات. الاختيار
     بينحفظ محلياً حتى ما يرجع للأول كل مرة تفتح الصفحة. */
  const [dataTab, setDataTab] = useState(DATA_TABS[0].key);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DATA_TAB_KEY);
      if (saved && DATA_TABS.some((tb) => tb.key === saved)) setDataTab(saved);
    } catch {
      /* التخزين معطّل — بنكمل بالتبويب الافتراضي */
    }
  }, []);

  const selectDataTab = useCallback((key) => {
    setDataTab(key);
    try {
      window.localStorage.setItem(DATA_TAB_KEY, key);
    } catch {
      /* التخزين معطّل — بنكمل بدون حفظ التفضيل */
    }
  }, []);
  const prevCurrenciesRef = useRef(null);

  const wrapRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLinesRef = useRef([]);
  const resultRef = useRef(null);
  const displayTFRef = useRef(displayTF);
  const candlesRef = useRef({});
  /* الفريم اللي فعلاً محمّل بسلسلة الشارت حالياً. مصدر الحقيقة الوحيد لكل
     الرسم فوق الشارت — لأنه setData ممكن ما تنفّذ (شموع فاضية) فيبقى الشارت
     على فريم قديم بينما الحالة قالت غيره. */
  const renderedTFRef = useRef(null);
  /* كاش لمجموعة أوقات الشموع المعروضة — مربوط بمرجع المصفوفة نفسها */
  const timeSetRef = useRef({ src: null, set: null });
  const rafRef = useRef(null);
  const animStartRef = useRef(0);
  const chartCardRef = useRef(null);

  const asset = getAssetByValue(symbol);

  useEffect(() => { displayTFRef.current = displayTF; }, [displayTF]);
  useEffect(() => { candlesRef.current = allCandles; }, [allCandles]);
  // لما يُفتح هالمكوّن من داخل Trading Radar (Open Full Analysis) برمز مختلف، منزامنه هون
  useEffect(() => {
    if (initialSymbol) setSymbol(initialSymbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSymbol]);

  /* تحديث ساعة الجلسات كل دقيقة */
  useEffect(() => {
    const timer1 = setInterval(() => setSessions(getSessionsStatus()), 60000);
    return () => clearInterval(timer1);
  }, []);

  /* نبضة حيّة كل ثانية — تُستخدم فقط للعرض (عدّاد الجلسة القادمة + تحديث "منذ...")،
     لا تلمس أي بيانات أو منطق قرار، مجرد إعادة رسم العناصر الزمنية بدقة الثانية */
  useEffect(() => {
    const timer2 = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer2);
  }, []);

  /* ===================== تشغيل QAIS SK Engine للرمز المختار ===================== */
  const runAnalysis = useCallback(async () => {
    if (!asset?.yahoo) return;
    setLoading(true);
    setError("");
    try {
      const [daily, h4, h1, m15, m5] = await Promise.all([
        fetchCandles(asset.yahoo, "1day", 5000),
        fetchCandles(asset.yahoo, "4h", 5000),
        fetchCandles(asset.yahoo, "1h", 5000),
        fetchCandles(asset.yahoo, "15min", 5000),
        fetchCandles(asset.yahoo, "5min", 5000),
      ]);
      const candlesByTF = { daily, h4, h1, m15, m5 };
      if (Object.values(candlesByTF).every((c) => !c || c.length < 30)) {
        throw new Error(t("radar.insufficientData"));
      }

      // SMT (توثيق RADAR الجديد، الفصل ٥/٦: "SMT مؤكد على 1H أو 15M") — نجيب
      // الفريمين للأصل المترابط عشان المحرك يقدر يفحصهم بالترتيب (H1 أولاً)
      let correlated = null;
      const corrSymbol = getCorrelatedSymbol(symbol);
      if (corrSymbol) {
        const corrYahoo = getAssetByValue(corrSymbol)?.yahoo || YAHOO_OVERRIDE[corrSymbol];
        if (corrYahoo) {
          /* لازم نجيب نفس مجموعة الفريمات ونفس العمق يلي بيجيبهم الكرون
             (getCandles بيرجّع كل الفريمات بـ 5000 شمعة). قبل هيك العميل كان
             يجيب h1/m15 بـ300 شمعة بس — فنفس الرمز كان يعطي SMT مختلف
             بالشارت الحي عن الكرون. وكمان التحقق التاريخي من الـSMT بدّه
             فريمات الهيكلية (daily/h4) مش بس h1/m15. */
          const [corrDaily, corrH4, corrH1, corrM15] = await Promise.all([
            fetchCandles(corrYahoo, "1day", 5000),
            fetchCandles(corrYahoo, "4h", 5000),
            fetchCandles(corrYahoo, "1h", 5000),
            fetchCandles(corrYahoo, "15min", 5000),
          ]);
          const corrByTF = { daily: corrDaily || [], h4: corrH4 || [], h1: corrH1 || [], m15: corrM15 || [] };
          if (Object.values(corrByTF).some((c) => c.length >= 30)) {
            correlated = { symbol: corrSymbol, candlesByTF: corrByTF };
          }
        }
      }

      // فلتر الأخبار الاقتصادية (الفصل ٩) — ما بيوقف الصفحة لو فشل الطلب، بس
      // بيمنع اعتماد الصفقة لو في خبر مهم قريب فعلاً
      let newsBlocked = null;
      try {
        const newsRes = await fetch(`/api/economic-events/news-block?symbols=${encodeURIComponent(symbol)}`);
        if (newsRes.ok) {
          const newsData = await newsRes.json();
          newsBlocked = newsData?.blocked?.[symbol] || null;
        }
      } catch {
        // فشل جلب الأخبار لا يوقف التحليل — بس ما في فلترة أخبار لهالمرة
      }

      const analysis = analyzeSymbol({ symbol, candlesByTF, correlated, newsBlocked });
      if (analysis.error) throw new Error(analysis.error);

      setAllCandles(candlesByTF);
      setResult(analysis);
      resultRef.current = analysis;
      animStartRef.current = performance.now();
      setDisplayTF(analysis.sequence?.displayTF || analysis.executionTimeframe || analysis.mainTimeframe || "h1");
      setLastUpdateAt(new Date().toISOString());

      // -------- تصالح فوري مع radarItems (الفصل الإضافي: منع التناقض بين اللوحتين) --------
      // t("radar.activeOpportunities")/t("radar.liquidityMap") بتقرأ من radarItems (آخر لقطة محفوظة
      // بالكرون، ممكن تكون قديمة بكم دقيقة). لما نحسب تحليل حي جديد لنفس الرمز هون،
      // لازم نحدّث فوراً صف هذا الرمز بالذات جوا radarItems بنفس القيم الحية — وإلا
      // ممكن يظهر "SELL · Ready · 95%" تحت بينما فوق صار "WAIT" فعلياً (نفس الرمز،
      // بس بيانات بعمرين مختلفين). باقي الرموز غير المفتوحة حالياً بتضل من الكرون
      // لحد ما توصل دورتها الحية الخاصة فيها.
      setRadarItems((prev) => {
        const patched = {
          symbol,
          status: analysis.status,
          score: analysis.score,
          direction: analysis.direction,
          price: analysis.price,
          timeframe: analysis.timeframe,
          reason_tags: analysis.reasonTags,
          decision: analysis,
          updated_at: new Date().toISOString(),
          radar_status: analysis.radarStatus,
          radar_score: analysis.radarScore,
          radar_signal_label: analysis.radarSignalLabel,
          radar_signal_strength: analysis.radarSignalStrengthLabel,
          htf_trend: analysis.htfTrend,
          market_structure: analysis.marketStructure,
          bos_status: analysis.bosStatus,
          choch_status: analysis.chochStatus,
          fvg_status: analysis.fvgStatus,
          liquidity_status: analysis.liquidityStatus,
          premium_discount: analysis.premiumDiscount,
          session: analysis.session,
          session_label: analysis.sessionLabel,
          entry_status: analysis.entryStatus,
          risk_reward: analysis.riskReward,
          why: analysis.why,
        };
        const idx = prev.findIndex((i) => i.symbol === symbol);
        if (idx === -1) return [...prev, patched];
        const next = prev.slice();
        next[idx] = { ...next[idx], ...patched };
        return next;
      });
    } catch (e) {
      setError(e.message || t("radar.engineFailed"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // مهم: runAnalysis (وبالتالي إعادة حساب السيكونز/الأهداف بالكامل) بيتفعّل
  // فقط لما "symbol" يتغيّر (اختيار أصل جديد) — أي تفاعل بالشارت (سحب/زوم/
  // تحجيم/تمرير الفريمات) بيمر فقط بحلقة الرسم (draw) اللي بتحول نفس نقاط
  // 0/A/B/C والأهداف المحسوبة سلفاً لإحداثيات شاشة جديدة، بدون ما تلمس نتيجة
  // التحليل نفسها. يعني مسقط السيكونز ما بينعاد بناؤه أبداً أثناء حركة الشارت
  // — فقط لما السوق فعلياً يشكّل هيكلية جديدة (نتيجة analyzeSymbol تتغيّر)
  useEffect(() => { runAnalysis(); }, [runAnalysis]);

  /* ===================== AI Trade Lifecycle (Phase 4) ===================== */
  const [executedTrade, setExecutedTrade] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [executeError, setExecuteError] = useState("");
  const [syncedTrade, setSyncedTrade] = useState(null); // صفقة QAIS AI مفتوحة أصلاً على هاد الرمز (Chart Sync)
  const [syncLoading, setSyncLoading] = useState(false);

  const fetchSyncedTrade = useCallback(async (sym) => {
    setSyncLoading(true);
    try {
      const res = await fetch(`/api/ai-trades?symbol=${encodeURIComponent(sym)}`);
      const data = await res.json();
      setSyncedTrade(res.ok ? data.trade : null);
    } catch {
      setSyncedTrade(null);
    } finally {
      setSyncLoading(false);
    }
  }, []);

  // Chart Synchronization — كل ما يتغيّر الرمز، منفحص إذا فيه صفقة QAIS AI مفتوحة
  // أصلاً عليه. إذا موجودة، الرادار بيعرضها بدل ما يسمح بإنشاء صفقة جديدة مكررة.
  useEffect(() => {
    setExecutedTrade(null);
    setExecuteError("");
    fetchSyncedTrade(symbol);
  }, [symbol, fetchSyncedTrade]);

  const handleExecuteTrade = useCallback(async () => {
    if (!result || result.entryStatus !== "Ready" || executing || syncedTrade) return;
    setExecuting(true);
    setExecuteError("");
    try {
      const res = await fetch("/api/ai-trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, timeframe: TF_LABELS[displayTF] || "M15", decision: result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("radar.executeTradeFailed"));
      setExecutedTrade(data.trade);
      setSyncedTrade(data.trade);
    } catch (e) {
      setExecuteError(e.message || t("radar.executeTradeFailed"));
    } finally {
      setExecuting(false);
    }
  }, [result, symbol, displayTF, executing, syncedTrade]);

  const handleCheckSyncedTrade = useCallback(async () => {
    if (!syncedTrade) return;
    setSyncLoading(true);
    try {
      const res = await fetch(`/api/ai-trades/${syncedTrade.id}/check`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.trade) setSyncedTrade(data.trade);
    } catch {
      /* فشل الفحص — الطالب فيه يعيد المحاولة يدوياً */
    } finally {
      setSyncLoading(false);
    }
  }, [syncedTrade]);


  /* ===================== بيانات الكروت السفلية — Heat Map / Radar / News ===================== */
  const loadSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/market-intelligence?type=snapshot");
      const data = await res.json();
      if (!data.error) {
        // نتابع اتجاه كل عملة بمقارنتها بآخر سنابشوت حقيقي استلمناه (لا بيانات وهمية،
        // فقط فرق حقيقي بين آخر قراءتين حيّتين من نفس المصدر)
        const prev = prevCurrenciesRef.current;
        if (prev) {
          const trend = {};
          Object.entries(data.currencies || {}).forEach(([ccy, v]) => {
            const pv = prev[ccy];
            if (v == null || pv == null) { trend[ccy] = null; return; }
            const delta = v - pv;
            trend[ccy] = delta > 0.4 ? "up" : delta < -0.4 ? "down" : "flat";
          });
          setCurrencyTrend(trend);
        }
        prevCurrenciesRef.current = data.currencies || {};
        setSnapshot(data);
      }
    } catch {}
  }, []);

  const loadRadar = useCallback(async () => {
    try {
      const res = await fetch("/api/radar");
      const data = await res.json();
      if (data.items) setRadarItems(data.items);
    } catch {}
  }, []);

  // t("radar.activeOpportunities") بتعتمد بس على radarItems (لقطة الكرون) بمعزل عن أي
  // صفقة مفتوحة فعلياً — هيك ممكن يظهر رمز كـ"Ready" باتجاه معاكس تماماً لصفقة
  // شغّالة عليه هلق (Chart Sync بيعرض هاي الصفقة المقفلة، مش الفرصة الجديدة،
  // فبيحس الطالب إنو "ضغط BUY وفتحله SELL"). هون منجيب كل الرموز يلي عندها
  // صفقة مفتوحة عشان نستثنيها/نميّزها من الفرص "الجاهزة للتنفيذ".
  const loadOpenTrades = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-trades");
      const data = await res.json();
      const OPEN_STATUSES = ["Open", t("radar.running"), "TP1 Hit", "TP2 Hit", "TP3 Hit", "TP4 Hit"];
      const symbols = new Set((data.trades || []).filter((t) => OPEN_STATUSES.includes(t.status)).map((t) => t.symbol));
      setOpenTradeSymbols(symbols);
    } catch {}
  }, []);

  const loadNews = useCallback(async () => {
    try {
      const supabase = createClient();
      const todayStr = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("economic_events")
        .select("impact")
        .eq("event_date", todayStr);
      const high = (data || []).filter((e) => e.impact === "high").length;
      setNewsToday({ high });
    } catch {}
  }, []);

  useEffect(() => {
    loadSnapshot();
    loadRadar();
    loadOpenTrades();
    loadNews();
    const t1 = setInterval(loadSnapshot, 120000);
    const t2 = setInterval(loadRadar, 60000);
    const t2b = setInterval(loadOpenTrades, 60000);
    const t3 = setInterval(loadNews, 300000);
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t2b); clearInterval(t3); };
  }, [loadSnapshot, loadRadar, loadOpenTrades, loadNews]);

  /* ===================== إنشاء الشارت مرة وحدة ===================== */
  useEffect(() => {
    let cancelled = false;
    async function setup() {
      const { createChart, CrosshairMode, LineStyle } = await import("lightweight-charts");
      if (cancelled || !containerRef.current) return;

      const chart = createChart(containerRef.current, {
        layout: { background: { color: "transparent" }, textColor: "#A79FC4" },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.04)" },
          horzLines: { color: "rgba(255,255,255,0.04)" },
        },
        timeScale: { borderColor: "#241C3E", timeVisible: true, secondsVisible: false, rightOffset: 16 },
        rightPriceScale: { borderColor: "#241C3E" },
        width: containerRef.current.clientWidth,
        height: CHART_H,
        crosshair: { mode: CrosshairMode.Normal },
      });

      const series = chart.addCandlestickSeries({
        upColor: GREEN, downColor: RED, borderVisible: false, wickUpColor: GREEN, wickDownColor: RED,
      });

      chartRef.current = chart;
      seriesRef.current = series;
      chartRef.current.__LineStyle = LineStyle;

      /* -------- خط أنابيب الرسم: حلقة rAF دائمة، لا رسم عند الطلب --------
         المشكلة الأصلية: كنا نرسم مرة وحدة فقط رداً على حدث (تغيّر المدى
         المرئي)، يعني الأوفرلاي كان يتأخر خطوة كاملة عن رسم الشارت نفسه
         (اللي بيتحدث بشكل متزامن وبتردد أعلى أثناء السحب/الزوم/التمرير
         بالعجلة) — فرق التوقيت هاد هو سبب "القفزة" و"الفليكر" اللي كانت
         تظهر لجزء من الثانية قبل ما ترجع الرسومات لمكانها الصحيح.
         الحل: حلقة rAF واحدة تشتغل طول عمر الشارت (تبلش مع mount وتوقف مع
         unmount بس)، بترسم من جديد كل فريم من مصدر واحد (الوقت/السعر
         الحقيقيين عبر timeToCoordinate/priceToCoordinate)، بدون أي إحداثيات
         بكسل محفوظة مسبقاً. هيك الأوفرلاي بيبقى مقفول 100٪ على نفس فريم رسم
         الشارت الأصلي بغض النظر عن نوع التفاعل (سحب/زوم/تحجيم/ريبلاي/تحديث حي) */
      function paintLoop() {
        draw();
        rafRef.current = requestAnimationFrame(paintLoop);
      }
      rafRef.current = requestAnimationFrame(paintLoop);

      // نبقي subscribeVisibleTimeRangeChange كتحفيز إضافي رخيص (زيادة تأكيد،
      // مش مصدر أساسي للرسم بعد اليوم) — يضمن رسمة فورية حتى لو الفريم القادم
      // تأخر لأي سبب (تبويب غير نشط مثلاً)
      const requestDraw = () => draw();
      chart.timeScale().subscribeVisibleTimeRangeChange(requestDraw);

      const handleResize = () => {
        if (!containerRef.current) return;
        chart.applyOptions({ width: containerRef.current.clientWidth });
        // الرسم التالي بحلقة الـ rAF (سطر واحد بعد) بيلتقط الحجم الجديد أوتوماتيكياً
        draw();
      };
      window.addEventListener("resize", handleResize);
      handleResize();

      return () => {
        window.removeEventListener("resize", handleResize);
        chart.timeScale().unsubscribeVisibleTimeRangeChange(requestDraw);
        chart.remove();
      };
    }
    const cleanupPromise = setup();
    return () => {
      cancelled = true;
      cleanupPromise?.then((fn) => fn && fn());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;
    const container = containerRef.current;
    if (!canvas || !chart || !series || !container) return;

    const w = container.clientWidth;
    const h = CHART_H;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const r = resultRef.current;
    if (!r) return;
    /* نرسم دايماً على الفريم اللي فعلاً محمّل بالسلسلة — مش المطلوب */
    const renderedTF = renderedTFRef.current;
    if (!renderedTF) return;
    const candles = candlesRef.current[renderedTF];
    if (!candles || !candles.length) return;

    const ts = chart.timeScale();
    const priceToY = (p) => series.priceToCoordinate(p);
    const timeToX = (t) => ts.timeToCoordinate(t);

    /* عرض منطقة الرسم فعلياً = عرض الحاوية ناقص محور السعر اليمين.
       كنا نمرّر عرض الحاوية كامل، فليبلات TP1..TP4 كانت ترتسم فوق أرقام
       المحور (4600 / 4800 / 5000...) وفوق تاغ السعر الحالي — وهاد سبب
       التراكب والفوضى على يمين الشارت. */
    let priceAxisW = 0;
    try {
      priceAxisW = chart.priceScale("right").width() || 0;
    } catch {
      /* نسخة قديمة من المكتبة ما بتدعم width() — منكمل بدون خصم */
    }
    const plotW = Math.max(120, w - priceAxisW);

    const elapsed = performance.now() - animStartRef.current;
    const progress = Math.max(0, Math.min(1, elapsed / ANIM_MS));
    const ease = easeOutCubic(progress);

    const lastCandle = candles[candles.length - 1];
    const lastX = timeToX(lastCandle.time);
    if (lastX == null) return;

    const seq = r.sequence;
    /* مجموعة أوقات الشموع المعروضة — منبنيها مرة لكل مصفوفة شموع (مش كل فريم،
       لأنه حلقة rAF بتنادي draw ٦٠ مرة بالثانية) */
    if (timeSetRef.current.src !== candles) {
      timeSetRef.current = { src: candles, set: new Set(candles.map((c) => c.time)) };
    }
    const timeSet = timeSetRef.current.set;

    const seqRenderable =
      seq?.points && seq.displayTF === renderedTF && sequencePointsInData(seq, timeSet);

    if (seqRenderable) {
      drawSequenceHistory(ctx, seq, timeToX, priceToY, lastX, ease, t);
      // أهداف السيكونز (TP1..TP4) — تترسم تلقائياً فور تأكيد C، بغض النظر عن
      // اكتمال شروط الصفقة الكاملة (Entry/SL) — هاي أهداف الـ QAIS SK Engine
      // الرسمية المسقطة من C مباشرة (تاسع عشر)
      /* الأهداف بتنعرض بس لما تكون في **صفقة كاملة** (كل الشروط الإلزامية
         تحققت) — مش لمجرد إنه C تأكدت. قبل هيك كان الشرط `stage === confirmed`،
         فكانت تطلع أهداف لإعداد ناقص ما بينفع تدخل عليه. */
      if (r.tradeValid && seq.targets?.length) {
        drawSequenceProjection(ctx, seq, timeToX, priceToY, plotW, h, ease);
      }
    }
    /* كتلة الأوامر والـSMT — تحت كل شي (طبقة سياق) */
    drawOrderBlocks(ctx, r.orderBlocks, timeToX, priceToY, plotW, ease, r.price, timeSet);
    drawSMT(ctx, r.smtSignal, priceToY, plotW, ease);

    drawProjection(ctx, r, priceToY, lastX, plotW, h, ease);

    /* آخر صفقة كاملة تكوّنت تاريخياً — بتنرسم دايماً (حتى لو محققة) طالما
       هي على نفس فريم العرض. بتنرسم أخيراً حتى تقعد فوق باقي الطبقات. */
    if (r.lastTrade && r.lastTrade.displayTF === renderedTF) {
      drawLastTrade(ctx, r.lastTrade, timeToX, priceToY, plotW, h, ease, timeSet);
    }
  }

  useLayoutEffect(() => {
    if (!seriesRef.current) return;
    const candles = allCandles[displayTF];
    if (!candles || candles.length === 0) {
      /* ما في شموع للفريم المطلوب (فشل جلبها مثلاً). الشارت بيضل عارض شموع
         الفريم القديم — فلازم نلغي ختم "الفريم المرسوم" حتى الأوفرلاي ما
         يرسم نقاط A/B/C على مقياس زمني مش تبعها. هاي كانت المشكلة: أوقات
         الفريم الأعلى موجودة أصلاً بالفريم الأصغر (حدود H4 هي كمان حدود M15)،
         فـ timeToCoordinate كان يلاقيها ويرجّع إحداثي صحيح شكلاً بس بمكان
         غلط تماماً — فتطلع النقاط طايرة يمين بعيد عن الشموع. */
      renderedTFRef.current = null;
      return;
    }
    seriesRef.current.setData(candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
    /* ختم الفريم اللي فعلاً انرسم على الشارت — كل الأوفرلاي بيتحاكم عليه، مش
       على displayTF المطلوب ولا على ref بينتحدّث بعد الرسم */
    renderedTFRef.current = displayTF;
    displayTFRef.current = displayTF;
    candlesRef.current = allCandles;

    /* إعادة تفعيل التحجيم التلقائي لمحور السعر عند أي تبديل رمز/فريم.
       lightweight-charts بيطفي autoScale نهائياً أول ما المستخدم يسحب محور
       السعر بإيده — فلو بدّلت من NAS100 (مدى ~30,000) لـUSDJPY (~157)
       بيضل المحور عالق على المدى القديم والشموع بتنضغط برّا الشاشة
       فيبيّن الشارت فاضي. */
    try {
      chartRef.current?.priceScale("right").applyOptions({ autoScale: true });
    } catch {
      /* نسخة مكتبة ما بتدعم الخيار — منكمل */
    }
    chartRef.current?.timeScale().fitContent();
    applyContextPriceLines();
    draw(); // رسم متزامن فوري (قبل أي paint) — الحلقة الدائمة بترسم كل فريم بعدين
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCandles, displayTF, result]);

  function applyContextPriceLines() {
    const series = seriesRef.current;
    const r = resultRef.current;
    if (!series) return;
    priceLinesRef.current.forEach((pl) => series.removePriceLine(pl));
    priceLinesRef.current = [];
    if (!r) return;

    const add = (price, color, title) => {
      if (price == null || !Number.isFinite(price)) return;
      const pl = series.createPriceLine({
        price, color, lineWidth: 1, lineStyle: chartRef.current.__LineStyle.Dotted, axisLabelVisible: true, title,
      });
      priceLinesRef.current.push(pl);
    };

    const poi = r.poi?.touchedZone;
    if (poi) {
      const lo = poi.from ?? poi.level;
      const hi = poi.to ?? poi.level;
      if (lo != null) add(lo, `#3D2F63`, `POI ${poi.type}`);
      if (hi != null && hi !== lo) add(hi, `#3D2F63`, `POI ${poi.type}`);
    }
    if (r.ob?.eligible && r.ob.status !== "Invalid" && !r.tradeValid) {
      add(r.ob.levels.mt, `${NEUTRAL}88`, `MT (${r.ob.status})`);
    }
  }

  function resetChart() {
    const chart = chartRef.current;
    if (!chart) return;
    chart.timeScale().fitContent();
    chart.timeScale().scrollToRealTime();
    // ملاحظة: مافي داعي لاستدعاء رسم يدوي هون — حلقة الـ rAF المستمرة
    // (paintLoop) بترسم كل فريم طول عمر الشارت وبتلتقط هاد التغيير تلقائياً
    // بالفريم التالي مباشرة.
  }

  function openOpportunity(sym) {
    setSymbol(sym);
    chartCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const primarySession = useMemo(() => getPrimarySession(sessions), [sessions]);
  // Single source of truth: `signal` comes straight from the engine's decision
  // object (lib/qais/decision.js) instead of being re-derived here — this is
  // the exact field Active Opportunities/Liquidity Map compare against too.
  const signal = result?.signal ?? null;
  const biasLabel = result?.direction === "up" ? "Bullish" : result?.direction === "down" ? "Bearish" : "—";
  const biasColor = result?.direction === "up" ? GREEN : result?.direction === "down" ? RED : "#6E6690";

  /* -------- Chart Info Bar — كل القيم مشتقة من نفس الشموع المحمّلة فعلاً بالشارت -------- */
  const dailyCandles = allCandles.daily;
  const chartDailyChange = useMemo(() => dailyChangeFromCandles(dailyCandles), [dailyCandles]);
  const chartATR = useMemo(() => calcATR(dailyCandles, 14), [dailyCandles]);
  const chartVolume = useMemo(() => lastVolume(dailyCandles), [dailyCandles]);

  /* -------- Live Market Status Bar (الهيدر) — تجميع حي من radarItems الحقيقية -------- */
  const marketStatus = useMemo(() => {
    const withScore = radarItems.filter((i) => (i.radar_score ?? i.score ?? 0) > 0);
    const active = radarItems.filter((i) => ["green", "blue", "orange", "red"].includes(i.radar_status));
    const strongest = withScore.length
      ? withScore.reduce((a, b) => ((b.radar_score ?? b.score ?? 0) > (a.radar_score ?? a.score ?? 0) ? b : a))
      : null;
    const weakest = withScore.length
      ? withScore.reduce((a, b) => ((b.radar_score ?? b.score ?? 0) < (a.radar_score ?? a.score ?? 0) ? b : a))
      : null;
    const bullish = active.filter((i) => i.direction === "up").length;
    const bearish = active.filter((i) => i.direction === "down").length;
    const totalDir = bullish + bearish;
    const biasLbl = totalDir === 0 ? "Neutral" : bullish >= bearish ? "Bullish" : "Bearish";
    const avgConfidence = withScore.length
      ? Math.round(withScore.reduce((s, i) => s + (i.radar_score ?? i.score ?? 0), 0) / withScore.length)
      : null;
    const lastScan = radarItems.reduce((max, i) => (i.updated_at && (!max || new Date(i.updated_at) > new Date(max)) ? i.updated_at : max), null);
    return {
      lastScan,
      scanned: radarItems.length,
      activeCount: active.length,
      strongest,
      weakest,
      biasLbl,
      avgConfidence,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radarItems]);

  /* -------- AI Summary (top of page) — مجمّع تلقائياً من نفس بيانات marketStatus/snapshot/radarItems،
     بدون أي رقم جديد أو نص ثابت. مجرد صياغة لغوية لما هو محسوب أصلاً -------- */
  const aiSummary = useMemo(() => {
    const currencies = snapshot?.currencies || {};
    const entries = Object.entries(currencies).filter(([, v]) => v != null);
    const strongestCcy = entries.length ? entries.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
    const qualitySetups = radarItems.filter((i) => (i.radar_score ?? i.score ?? 0) >= 80).length;
    const leadAsset = marketStatus.strongest;
    const leadAssetSymbol = leadAsset ? (getAssetByValue(leadAsset.symbol)?.label || leadAsset.symbol) : null;

    const lines = [];
    lines.push(
      marketStatus.biasLbl === "Neutral"
        ? t("radar.mixedMarket")
        : t("radar.marketRemainsOverall", { bias: t(marketStatus.biasLbl === "Bullish" ? "radar.dBullish" : "radar.dBearish") })
    );
    if (leadAsset) {
      const zone = leadAsset.decision?.premiumDiscount;
      const dirTxt =
        leadAsset.direction === "up"
          ? t("radar.dirTxtBullish")
          : leadAsset.direction === "down"
          ? t("radar.dirTxtBearish")
          : t("radar.dirTxtRanging");
      const zoneNote =
        zone && zone !== "—"
          ? t("radar.leadSetupZoneNote", { zone: (zone === "Premium Zone" ? t("radar.dPremiumZone") : zone === "Discount Zone" ? t("radar.dDiscountZone") : zone).toLowerCase() })
          : "";
      lines.push(t("radar.leadSetupLine", { symbol: leadAssetSymbol, dirTxt, zoneNote }));
    }
    if (strongestCcy) {
      lines.push(t("radar.strongestCurrencyLine", { currency: strongestCcy[0] }));
    }
    lines.push(
      qualitySetups > 0
        ? t("radar.qualitySetupsSome", {
            count: qualitySetups,
            plural: qualitySetups === 1 ? "" : "s",
            verb: t(qualitySetups === 1 ? "radar.qualitySetupsSomeVerbSingle" : "radar.qualitySetupsSomeVerbPlural"),
          })
        : t("radar.qualitySetupsNone")
    );
    // فلتر الأخبار (الفصل ٩) — تحذير واضح لو أقوى فرصة حالياً محجوبة بسبب خبر مهم قريب
    const leadNewsBlock = leadAsset?.decision?.newsBlock;
    if (leadNewsBlock) {
      lines.push(t("radar.newsHoldLine", { symbol: leadAssetSymbol, currency: leadNewsBlock.currency, title: leadNewsBlock.title }));
    }

    return { lines, confidence: marketStatus.avgConfidence, biasLbl: marketStatus.biasLbl };
  }, [snapshot, radarItems, marketStatus]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <style>{`
        @keyframes qmiFadeIn { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); } }
        .qmi-anim { animation: qmiFadeIn 0.4s ease both; }
        @keyframes qmiPulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        .qmi-dot { animation: qmiPulse 1.8s ease-in-out infinite; }
        .qmi-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .qmi-scroll::-webkit-scrollbar-thumb { background: #2A2145; border-radius: 3px; }
        .qmi-concept-card { transition: transform .2s ease, border-color .2s ease, background .2s ease; }
        .qmi-concept-card:hover { transform: translateY(-2px); background: #141024; }
        .qmi-briefing-card { transition: transform .2s ease, border-color .2s ease, background .2s ease; }
        .qmi-briefing-card:hover { transform: translateY(-2px); background: #141024; }
        @keyframes qmiBarGrow { from { width: 0%; } }
        .qmi-conf-bar { animation: qmiBarGrow 0.9s ease both; }

        .qmi-summary-card { transition: box-shadow .25s ease, transform .25s ease; }
        .qmi-summary-card:hover { box-shadow: 0 10px 34px rgba(212,175,55,0.14); }

        .qmi-wstat { transition: transform .18s ease, background .18s ease, box-shadow .18s ease; border: 1px solid transparent; }
        .qmi-wstat:hover { transform: translateY(-2px); background: #141024; border-color: #2A2145; box-shadow: 0 6px 16px rgba(0,0,0,0.3); }

        /* شريط التبويبات — بيلزق فوق وقت السكرول حتى تقدر تبدّل بأي لحظة */
        .qmi-tabbar {
          position: sticky;
          top: 0;
          z-index: 5;
          background: #0E0A1A;
        }
        .qmi-tabbar::-webkit-scrollbar { height: 0; }
        .qmi-tabpanel { animation: qmiFadeIn 0.28s ease both; }

        .qmi-liq-row {
          display: grid;
          grid-template-columns: 1.1fr 0.8fr 0.7fr 1.3fr 1.2fr 1.1fr 1fr 0.8fr 1.2fr;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          font-size: 11.5px;
        }
        .qmi-liq-head { color: #6E6690; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; padding: 0 12px; }
        .qmi-liq-body {
          width: 100%;
          text-align: right;
          cursor: pointer;
          border-radius: 3px;
          transition: transform .18s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease;
        }
        .qmi-liq-body:hover { transform: translateY(-2px); border-color: #3D2F63 !important; box-shadow: 0 8px 22px rgba(0,0,0,0.35); }
        .qmi-liq-body span[data-label] { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        @media (max-width: 900px) {
          .qmi-liq-head { display: none; }
          .qmi-liq-row {
            grid-template-columns: 1fr 1fr;
            row-gap: 8px;
          }
          .qmi-liq-body span[data-label] {
            white-space: normal;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .qmi-liq-body span[data-label]::before {
            content: attr(data-label);
            font-size: 8.5px;
            font-weight: 700;
            color: #6E6690;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
        }

        /* الكوكبيت: شارت + لوحة الذكاء الاصطناعي جنب بعض، وبينزلوا فوق بعض
           على الشاشات الضيّقة بدل ما ينضغط الشارت لعرض غير مقروء. */
        @media (max-width: 1100px) {
          .qmi-cockpit { grid-template-columns: minmax(0, 1fr) !important; }
          .qmi-two-col { grid-template-columns: minmax(0, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .qmi-tabbar button { padding: 9px 11px !important; font-size: 11.5px !important; }
        }
      `}</style>

      {/* ================= HEADER ================= */}
      <div className="qmi-anim" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Crown size={19} strokeWidth={1.75} color={GOLD} aria-hidden />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#F5F3FF" }}>Qais Market Intelligence — Full Analysis</div>
          <div style={{ fontSize: 11.5, color: "#6E6690" }}>{t("radar.poweredBy")}</div>
        </div>
        {embedded && onClose && (
          <button
            onClick={onClose}
            style={{
              background: "#141024",
              border: `1px solid #3D2F63`,
              color: "#A79FC4",
              borderRadius: 3,
              width: 34,
              height: 34,
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
            }}
            title={t("radar.close")}
          >
            ✕
          </button>
        )}
      </div>

      {/* ================= LIVE MARKET STATUS (شريط رفيع — بيضل بالكوكبيت) ================= */}
      <LiveMarketStatusBar status={marketStatus} />

      {/* ================= TOP TOOLBAR ================= */}
      <div className="qmi-anim" style={{ ...glass, padding: "0.75rem 1.1rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          style={{ background: "#141024", color: "#F5F3FF", border: `1px solid #3D2F63`, borderRadius: 3, fontSize: 13, padding: "7px 10px", fontWeight: 700, minWidth: 150 }}
        >
          {ASSETS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.items.filter((i) => i.yahoo).map((i) => (
                <option key={i.v} value={i.v}>{i.label}</option>
              ))}
            </optgroup>
          ))}
        </select>

        <div style={{ width: 1, height: 22, background: "#1C1630" }} />

        <div style={{ display: "flex", gap: 4 }}>
          {TF_TOOLBAR_ORDER.filter((tf) => allCandles[tf]?.length).map((tf) => (
            <button
              key={tf}
              onClick={() => setDisplayTF(tf)}
              style={{
                background: displayTF === tf ? `#2A2145` : "transparent",
                border: `1px solid ${displayTF === tf ? GOLD : "#1C1630"}`,
                color: displayTF === tf ? GOLD_LIGHT : "#6E6690",
                borderRadius: 3, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              {TF_LABELS[tf]}
            </button>
          ))}
        </div>

        <button
          onClick={runAnalysis}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
            border: "none", color: "#141024", fontWeight: 800, borderRadius: 3, padding: "8px 16px", fontSize: 12.5, cursor: "pointer",
          }}
        >
          <Zap size={13} fill="#141024" />
          {loading ? t("radar.analyzing") : t("radar.aiAnalyze")}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#1C1630", border: `1px solid ${GREEN}40`, borderRadius: 20, padding: "6px 12px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN }} className="qmi-dot" />
          <span style={{ fontSize: 11.5, color: "#aaa" }}>{t("radar.confidence")}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: GREEN }}>{result?.aiConfidence ?? result?.radarScore ?? 0}%</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#141024", border: "1px solid #1C1630", borderRadius: 20, padding: "6px 12px" }}>
          <Radio size={12} color={BLUE} />
          <span style={{ fontSize: 12, color: "#A79FC4" }}>{t("radar.sessionLabel")}<b style={{ color: "#F5F3FF" }}>{primarySession}</b></span>
        </div>

        <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 6, background: "#141024", border: `1px solid ${biasColor}40`, borderRadius: 20, padding: "6px 12px" }}>
          <span style={{ fontSize: 12, color: "#A79FC4" }}>{t("radar.marketBiasLabel")}</span>
          <b style={{ fontSize: 12.5, color: biasColor }}>{biasLabel}</b>
        </div>
      </div>

      {error && <div style={{ ...glass, padding: "0.7rem 1rem", color: RED, fontSize: 12.5 }}>{error}</div>}

      {(result?.entryStatus === "Ready" || syncedTrade) && (
        <AITradeCard
          result={result}
          symbol={symbol}
          asset={asset}
          timeframeLabel={TF_LABELS[displayTF] || "M15"}
          executedTrade={executedTrade}
          executing={executing}
          executeError={executeError}
          onExecute={handleExecuteTrade}
          syncedTrade={syncedTrade}
          syncLoading={syncLoading}
          onCheckSynced={handleCheckSyncedTrade}
        />
      )}

      {/* ================= MAIN: CHART (≈70%) + AI PANEL (≈30%) ================= */}
      <div className="qmi-anim qmi-cockpit" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: "1rem", alignItems: "start" }}>
        <div ref={chartCardRef} style={{ ...glass, padding: "0.6rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.3rem 0.5rem 0.6rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#F5F3FF" }}>{asset?.label || symbol}</span>
              {result?.price != null && <span style={{ fontSize: 12.5, color: "#A79FC4" }}>{fmt(result.price)}</span>}
            </div>
            <button
              onClick={resetChart}
              title={t("radar.resetChartTitle")}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid #1C1630", color: "#aaa", borderRadius: 3, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
            >
              <RotateCcw size={11} />
              {t("radar.resetChart")}
            </button>
          </div>

          <ChartInfoBar
            price={result?.price}
            dailyChange={chartDailyChange}
            atr={chartATR}
            volume={chartVolume}
            lastUpdateAt={lastUpdateAt}
            nowTick={nowTick}
          />

          <div ref={wrapRef} style={{ position: "relative", width: "100%", height: CHART_H }}>
            <div ref={containerRef} style={{ width: "100%", height: CHART_H }} />
            <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
          </div>
        </div>

        <AIPanel result={result} signal={signal} tab={tab} setTab={setTab} primarySession={primarySession} />
      </div>

      {/* ================= لوح البيانات — تبويبات بدل تسعة أقسام فوق بعض ================= */}
      <DataTabBar active={dataTab} onSelect={selectDataTab} counts={{ opportunities: marketStatus.activeCount }} />

      <div className="qmi-tabpanel" role="tabpanel" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {dataTab === "overview" && (
          <>
            <AiSummaryCard summary={aiSummary} />
            <MarketSummaryCard snapshot={snapshot} radarItems={radarItems} newsToday={newsToday} />
          </>
        )}

        {dataTab === "liquidity" && (
          <LiquidityMapSection items={radarItems} selectedSymbol={selectedLiqSymbol} onSelect={setSelectedLiqSymbol} />
        )}

        {dataTab === "market" && (
          <div className="qmi-anim qmi-two-col" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(240px, 1fr))", gap: "1rem", alignItems: "start" }}>
            <CurrencyHeatMapCard snapshot={snapshot} trend={currencyTrend} />
            <SessionMapCard sessions={sessions} nowTick={nowTick} />
          </div>
        )}

        {dataTab === "opportunities" && (
          <div className="qmi-anim qmi-two-col" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1rem", alignItems: "start" }}>
            <LiveOpportunitiesCard items={radarItems} openTradeSymbols={openTradeSymbols} onOpen={openOpportunity} nowTick={nowTick} />
            <LiveNotificationsCard items={radarItems} onOpen={openOpportunity} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   AI Summary — كرت هيرو أعلى الصفحة. يترجم marketStatus/snapshot/radarItems
   لفقرة قصيرة مفهومة بلمحة، بدل ما يضطر المستخدم يقرأ كل قسم لحاله.
   ============================================================================ */
function AiSummaryCard({ summary }) {
  const { t } = useLocale();
  const { lines, confidence, biasLbl } = summary;
  const biasColor = biasLbl === "Bullish" ? GREEN : biasLbl === "Bearish" ? RED : "#6E6690";
  const confColor = confidence == null ? "#6E6690" : confidence >= 80 ? GREEN : confidence >= 50 ? GOLD_LIGHT : AMBER;

  return (
    <div
      className="qmi-anim qmi-summary-card"
      style={{
        ...glass,
        padding: "1.1rem 1.3rem",
        position: "relative",
        overflow: "hidden",
        border: `1px solid #2A2145`,
        background: `linear-gradient(135deg, rgba(212,175,55,0.09), rgba(20,22,26,0.94) 55%)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: "1 1 320px", minWidth: 260 }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}><Brain size={14} aria-hidden /></span>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 900, color: "#F5F3FF", letterSpacing: 0.2 }}>{t("radar.todaysAiSummary")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
              {lines.map((l, i) => (
                <div key={i} style={{ fontSize: 12.5, color: "#F5F3FF", lineHeight: 1.75 }}>
                  {l}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <div style={{ background: "#141024", border: `1px solid ${biasColor}40`, borderRadius: 0, padding: "8px 14px", textAlign: "center", minWidth: 92 }}>
            <div style={{ fontSize: 9, color: "#6E6690", letterSpacing: 0.4, textTransform: "uppercase" }}>{t("radar.marketBias")}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: biasColor, marginTop: 3 }}>
              {t(biasLbl === "Bullish" ? "radar.dBullish" : biasLbl === "Bearish" ? "radar.dBearish" : "radar.dNeutral")}
            </div>
          </div>
          <div style={{ background: "#141024", border: `1px solid ${confColor}40`, borderRadius: 0, padding: "8px 14px", textAlign: "center", minWidth: 92 }}>
            <div style={{ fontSize: 9, color: "#6E6690", letterSpacing: 0.4, textTransform: "uppercase" }}>{t("radar.overallConfidence")}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: confColor, marginTop: 3 }}>{confidence != null ? `${confidence}%` : "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Live Market Status Bar — شريط حالة السوق الحي أسفل العنوان مباشرة.
   كله مجمّع من radarItems (نفس /api/radar) — لا بيانات جديدة، فقط عرض مُجمّع.
   ============================================================================ */
function LiveMarketStatusBar({ status }) {
  const { t } = useLocale();
  const { lastScan, scanned, activeCount, strongest, weakest, biasLbl, avgConfidence } = status;
  const biasColor = biasLbl === "Bullish" ? GREEN : biasLbl === "Bearish" ? RED : "#6E6690";

  const items = [
    { label: t("radar.lastScan"), value: lastScan ? relTime(lastScan, t) : "—", icon: <Radio size={13} color={BLUE} /> },
    { label: t("radar.assetsScanned"), value: scanned, icon: <Eye size={13} color={GOLD_LIGHT} /> },
    { label: t("radar.activeOpportunities"), value: activeCount, icon: <Zap size={13} color={GOLD} /> },
    {
      label: t("radar.strongestAsset"),
      value: strongest ? `${strongest.symbol} · ${strongest.radar_score ?? strongest.score}%` : "—",
      icon: <TrendingUp size={13} color={GREEN} />,
      color: GREEN,
    },
    {
      label: t("radar.weakestAsset"),
      value: weakest ? `${weakest.symbol} · ${weakest.radar_score ?? weakest.score}%` : "—",
      icon: <TrendingDown size={13} color={RED} />,
      color: RED,
    },
    {
      label: t("radar.marketBias"),
      value: t(biasLbl === "Bullish" ? "radar.dBullish" : biasLbl === "Bearish" ? "radar.dBearish" : "radar.dNeutral"),
      icon: <Target size={13} color={biasColor} />,
      color: biasColor,
    },
    {
      label: t("radar.marketConfidence"),
      value: avgConfidence != null ? `${avgConfidence}%` : "—",
      icon: <Brain size={13} color={GOLD} />,
    },
  ];

  return (
    <div className="qmi-anim" style={{ ...glass, padding: "0.7rem 1rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 3, background: "#141024", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {it.icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 9.5, color: "#6E6690", whiteSpace: "nowrap" }}>{it.label}</div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: it.color || "#F5F3FF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {it.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   Chart Info Bar — شريط معلومات مضغوط فوق الشارت مباشرة (لا يستبدل الشارت،
   فقط يضيف سياق سريع). كل القيم من نفس شموع الشارت المحمّلة أصلاً.
   ============================================================================ */
function ChartInfoBar({ price, dailyChange, atr, volume, lastUpdateAt, nowTick }) {
  const { t } = useLocale();
  const changeColor = dailyChange == null ? "#6E6690" : dailyChange >= 0 ? GREEN : RED;
  void nowTick; // يفرض إعادة تقييم "منذ..." كل ثانية

  const cells = [
    { label: t("radar.price"), value: fmt(price) },
    { label: t("radar.dailyChange"), value: fmtPct(dailyChange), color: changeColor },
    { label: "ATR (14)", value: atr != null ? fmt(atr) : "—" },
    { label: t("radar.volume"), value: volume != null ? fmtVolume(volume) : "—" },
    { label: t("radar.spread"), value: "—", title: t("radar.notProvided") },
    { label: t("radar.lastUpdate"), value: lastUpdateAt ? relTime(lastUpdateAt, t) : "—" },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 0,
        background: "#0E0A1A",
        border: "1px solid #1C1630",
        borderRadius: 3,
        margin: "0 0.5rem 0.6rem",
        overflow: "hidden",
      }}
    >
      {cells.map((c, i) => (
        <div
          key={c.label}
          title={c.title}
          style={{
            flex: "1 1 110px",
            padding: "7px 12px",
            borderInlineStart: i === 0 ? "none" : "1px solid #1C1630",
          }}
        >
          <div style={{ fontSize: 9, color: "#6E6690" }}>{c.label}</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: c.color || "#F5F3FF" }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   رسم هيكل السيكونز (0 → A → B → C) على الشارت — منطق TradingView's Trend-Based
   Fib Extension حرفياً، بس بأربع نقاط مؤكَّدة هيكلياً بدل ثلاثة. لو C لسا ما
   تأكدت (stage="awaiting-c")، منرسم 0→A→B بس وبنص خفيف "بانتظار C" — بدون أي
   خطوط فيبوناتشي تصحيحية (القرار اعتمد بالكامل على هيكلية السوق لا على نسب
   الارتداد التقليدية).
   ============================================================================ */
/* ============================================================================
   هل السيكونز قابلة للرسم على الشموع المعروضة حالياً؟
   ----------------------------------------------------------------------------
   نقاط 0/A/B/C هي سوينغات تاريخية — لازم تكون كل وحدة فيها موجودة فعلياً
   بمصفوفة الشموع المعروضة. ما منعتمد على timeToCoordinate لحاله: لو الوقت
   مش من نفس البيانات، المكتبة بترجّع إحداثي مشتق بدل null، فتطلع النقاط
   طايرة يمين آخر شمعة — وهاد مستحيل منطقياً لنقطة من الماضي.
   منتحقق من العضوية أولاً، وبعدين منتأكد إنه ولا نقطة وقعت يمين آخر شمعة.
   ============================================================================ */
function sequencePointsInData(seq, timeSet) {
  if (!seq?.points || !timeSet) return false;
  const pts = [seq.points.origin, seq.points.A, seq.points.B, seq.points.C].filter(Boolean);
  if (pts.length < 3) return false;
  return pts.every((p) => timeSet.has(p.time));
}


/* ============================================================================
   آخر صفقة كاملة تكوّنت على الشارت — بتنرسم دايماً، حتى لو حققت أهدافها.
   بتتميّز بصرياً عن الإعداد الحيّ: خطوط أرفع وشفافية أعلى، ووسم واضح على
   نقطة الدخول ("محققة" لو وصلت هدف، "قيد التتبّع" لو لسا).
   ============================================================================ */

/* ============================================================================
   كتلة الأوامر (OB) والـ SMT — بينرسموا كنطاقات/مستويات سعرية أفقية تمتد
   على كل عرض الشارت، تماماً زي OB+/OB- بتريدنغ فيو.
   ----------------------------------------------------------------------------
   ليش أفقية ومش مربوطة بشمعة؟ لأنهم محسوبين على فريم التنفيذ (m5/m15) بينما
   الشارت عارض فريم أعلى (h4 مثلاً) — فأوقاتهم أصلاً مش موجودة بشموع العرض.
   المستوى السعري هو المعلومة المفيدة، والزمن ما بيضيف إشي هون.
   ============================================================================ */
function drawOrderBlocks(ctx, list, timeToX, priceToY, plotW, ease, lastPrice, timeSet) {
  if (!Array.isArray(list) || !list.length) return;

  /* كتلة الأوامر = **مجموعة مستويات**، مش صندوق مصمت.
     كل مستوى (MT / Open / Close / FVG / Outer Wick) بينرسم كخط أفقي مستقل
     بيبلّش من شمعة الكتلة وبيمتد لليمين — نفس أسلوب الشارت اليدوي.
     MT أقوى مستوى (حسب strengthOrder بالمحرّك) فبينرسم أوضح من الباقي. */
  const drawable = list
    .filter((o) => o.levels && o.high != null && o.low != null)
    .map((o) => ({ ...o, x0: o.time != null && (!timeSet || timeSet.has(o.time)) ? timeToX(o.time) : null }))
    .filter((o) => o.x0 != null);

  /* أقرب كتلتين للسعر — كل وحدة بتعطي حتى ٥ خطوط، فأكتر من هيك بيصير ازدحام */
  const near = drawable
    .sort((a, b) => Math.abs((a.mt ?? a.high) - lastPrice) - Math.abs((b.mt ?? b.high) - lastPrice))
    .slice(0, 2);

  ctx.save();
  ctx.globalAlpha = ease;
  const rightEdge = plotW - 46;

  for (const o of near) {
    const up = o.direction === "up";
    const tone = up ? GREEN : RED;
    const x0 = Math.max(0, o.x0);

    const rows = [
      { key: "MT", price: o.levels.mt, strong: true },
      { key: "Open", price: o.levels.open },
      { key: "Close", price: o.levels.close },
      { key: "FVG", price: o.levels.fvg },
      { key: "Wick", price: o.levels.outerWick },
    ].filter((r) => Number.isFinite(r.price));

    for (const r of rows) {
      const y = priceToY(r.price);
      if (y == null) continue;
      ctx.strokeStyle = r.strong ? `${tone}aa` : `${tone}45`;
      ctx.lineWidth = r.strong ? 1.4 : 1;
      ctx.setLineDash(r.strong ? [] : [5, 4]);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(rightEdge, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = r.strong ? "700 9px sans-serif" : "500 8.5px sans-serif";
      ctx.fillStyle = r.strong ? tone : `${tone}99`;
      ctx.textBaseline = "middle";
      ctx.fillText(r.key, x0 + 4, y - 5);
      ctx.textBaseline = "alphabetic";
    }

    // وسم الكتلة على اليمين، عند مستوى MT
    const yMt = priceToY(o.levels.mt);
    if (yMt != null) {
      ctx.font = "700 10px sans-serif";
      ctx.fillStyle = tone;
      ctx.textBaseline = "middle";
      ctx.fillText(up ? "+OB" : "-OB", rightEdge + 5, yMt);
      ctx.textBaseline = "alphabetic";
    }
  }

  ctx.restore();
}

function drawSMT(ctx, smt, priceToY, plotW, ease) {
  if (!smt || smt.point == null) return;
  const y = priceToY(smt.point);
  if (y == null) return;

  ctx.save();
  ctx.globalAlpha = ease;
  ctx.strokeStyle = `${BLUE}80`;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(plotW, y);
  ctx.stroke();
  ctx.setLineDash([]);

  const suffix = smt.correlatedWith ? `  ·  ${smt.correlatedWith}` : "";
  drawPill(ctx, 8, y, `SMT${suffix}`, BLUE, "700 10px sans-serif", "left");
  ctx.restore();
}

function drawLastTrade(ctx, trade, timeToX, priceToY, plotW, chartH, ease, timeSet) {
  if (!trade?.entry || !trade.targets?.length) return;
  if (timeSet && !timeSet.has(trade.entry.time)) return;

  const ex = timeToX(trade.entry.time);
  const ey = priceToY(trade.entry.price);
  if (ex == null || ey == null) return;

  const up = trade.direction === "up";
  const stopPrice = trade.points?.B?.price;
  const finalTarget = trade.targets[trade.targets.length - 1];
  const sy = stopPrice != null ? priceToY(stopPrice) : null;
  const ty = finalTarget ? priceToY(finalTarget.price) : null;
  if (sy == null || ty == null) return;

  /* صندوق الصفقة — مثبَّت من لحظة الدخول لقدّام، زي أداة Long/Short Position
     بتريدنغ فيو: أخضر ناحية الهدف وأحمر ناحية الوقف. بيوضّح المخاطرة/العائد
     بلمحة، وبيمنع "طوفان" خطوط الأهداف اللي كان بيعمل عجقة. */
  const boxRight = plotW - 58;
  const boxW = Math.max(24, boxRight - ex);

  ctx.save();
  ctx.globalAlpha = ease * 0.9;

  // منطقة الربح
  ctx.fillStyle = `${GREEN}1c`;
  ctx.fillRect(ex, Math.min(ey, ty), boxW, Math.abs(ey - ty));
  // منطقة المخاطرة
  ctx.fillStyle = `${RED}1c`;
  ctx.fillRect(ex, Math.min(ey, sy), boxW, Math.abs(ey - sy));

  // حدود
  ctx.strokeStyle = `${GREEN}55`;
  ctx.lineWidth = 1;
  ctx.strokeRect(ex + 0.5, Math.min(ey, ty) + 0.5, boxW - 1, Math.abs(ey - ty) - 1);
  ctx.strokeStyle = `${RED}55`;
  ctx.strokeRect(ex + 0.5, Math.min(ey, sy) + 0.5, boxW - 1, Math.abs(ey - sy) - 1);

  // خط الدخول
  ctx.strokeStyle = GOLD_LIGHT;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex + boxW, ey);
  ctx.stroke();

  // علامة الدخول
  ctx.beginPath();
  ctx.arc(ex, ey, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = "#141024";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = GOLD_LIGHT;
  ctx.stroke();

  /* تسميات مختصرة على حافة الصندوق — ثلاثة بس بدل خمس صناديق */
  const rows = [
    { y: ty, text: `${finalTarget.key}  ${fmt(finalTarget.price)}`, color: GREEN },
    { y: ey, text: `${_t("radar.entryPoint")}  ${fmt(trade.entry.price)}`, color: GOLD_LIGHT },
    { y: sy, text: `${_t("radar.stopLabel")}  ${fmt(stopPrice)}`, color: RED },
  ];
  ctx.font = "700 9.5px sans-serif";
  ctx.textBaseline = "middle";
  for (const rr of rows) {
    ctx.fillStyle = rr.color;
    ctx.fillText(rr.text, ex + boxW + 5, rr.y);
  }
  ctx.textBaseline = "alphabetic";

  /* ---- سبب الدخول ---- بدون هالكتلة الصفقة بتبيّن وكأنها انفتحت بلا مبرر.
     منعرض: من وين الدخول، هل الـSMT متحقق، وحدود الكتلة، ومستوى الإبطال. */
  const reasonLines = [
    `${_t("radar.entryReason")}: ${
      trade.entrySource === "orderBlock" ? _t("radar.viaOrderBlock") : _t("radar.viaRetracement")
    }`,
  ];
  if (trade.obZone) {
    reasonLines.push(`${_t("radar.obRange")}: ${fmt(trade.obZone.bottom)} – ${fmt(trade.obZone.top)}`);
  }
  reasonLines.push(
    `SMT: ${trade.smtVerified ? _t("radar.smtVerified") : _t("radar.smtUnverified")}`
  );
  reasonLines.push(`${_t("radar.invalidationAt")}: ${fmt(stopPrice)}`);

  const rlFont = "600 9px sans-serif";
  ctx.font = rlFont;
  const rlW = Math.max(...reasonLines.map((l) => ctx.measureText(l).width)) + 14;
  const rlH = reasonLines.length * 12 + 8;
  const rlX = Math.min(Math.max(4, ex - rlW / 2), plotW - rlW - 4);
  const rlY = up ? Math.max(4, Math.min(ey, sy) - rlH - 26) : Math.min(chartH - rlH - 4, Math.max(ey, sy) + 26);

  ctx.fillStyle = "rgba(18,20,24,0.94)";
  ctx.strokeStyle = "#3D2F63";
  ctx.lineWidth = 1;
  roundRect(ctx, rlX, rlY, rlW, rlH, 5);
  ctx.fill();
  ctx.stroke();
  ctx.textBaseline = "middle";
  reasonLines.forEach((l, i) => {
    ctx.fillStyle = i === 0 ? GOLD_LIGHT : "#A79FC4";
    ctx.fillText(l, rlX + 7, rlY + 10 + i * 12);
  });
  ctx.textBaseline = "alphabetic";

  // وسم الحالة فوق الصندوق
  /* ثلاث حالات مش ثنتين: محققة / ضاربة وقف / قيد التتبّع.
     كان أي صفقة مش محققة تطلع "قيد التتبّع" حتى لو كانت مضروبة وقف من زمان. */
  const stopped = trade.invalidated && !trade.achieved;
  const label = trade.achieved
    ? _t("radar.tradeAchieved")
    : stopped
      ? _t("radar.tradeStopped")
      : _t("radar.tradeTracking");
  drawPill(
    ctx,
    ex + boxW / 2,
    Math.min(ey, ty) - 10,
    `${_t("radar.lastTrade")} ${up ? "▲" : "▼"} · ${label}`,
    trade.achieved ? GREEN : stopped ? RED : GOLD_LIGHT,
    "700 10px sans-serif"
  );

  ctx.restore();
}

function drawSequenceHistory(ctx, seq, timeToX, priceToY, lastX, ease, t) {
  const { points, stage } = seq;
  // لو انلغت السيكونز (نقطة B انكسرت)، ما لازم نوصل الخط لـC ولا نرسمها
  // إطلاقاً — هيك كان عم يصير: نقطة B مكسورة فعلياً بس الخط عم يوصل لـC
  // وكأنو الإعداد لسا حي، وهاد مضلّل تماماً.
  const includeC = stage !== "invalidated" && points.C;
  const pts = [
    ["0", points.origin],
    ["A", points.A],
    ["B", points.B],
    ...(includeC ? [["C", points.C]] : []),
  ]
    .map(([label, p]) => (p ? { label, x: timeToX(p.time), y: priceToY(p.price) } : null))
    .filter((p) => p && p.x != null && p.y != null);

  if (pts.length < 3) return;

  /* حارس أخير: ولا نقطة هيكلية بتقدر تقع يمين آخر شمعة. لو صار هيك فمعناه
     الإحداثي انشتق من بيانات مش تبع الشارت المعروض — منوقف الرسم كامل بدل
     ما نعرض سيكونز طايرة بالفراغ. */
  if (lastX != null && pts.some((p) => p.x > lastX + 2)) return;

  ctx.save();
  ctx.globalAlpha = ease;

  // الخط الواصل 0→A→B→(C)
  ctx.strokeStyle = stage === "confirmed" ? `#3D2F63` : `#3D2F63`;
  ctx.lineWidth = 1.3;
  if (stage !== "confirmed") ctx.setLineDash([4, 3]); // خط متقطع طالما C لسا ما تأكدت (قيد التكوين)
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.setLineDash([]);

  // اتجاه الليبل (فوق/تحت) يتبادل تلقائياً حسب كون النقطة قمة أو قاع بالتسلسل
  const isAnchor = stage === "confirmed"; // C أصبحت نقطة انطلاق المسقط الرسمي
  pts.forEach((p, i) => {
    const isPeak = i > 0 ? p.y < pts[i - 1].y : p.y < (pts[1]?.y ?? p.y);
    const dy = isPeak ? -15 : 15;
    const isC = p.label === "C";

    // C كنقطة انطلاق المسقط: هالة مضيئة واضحة حول النقطة تميّزها بصرياً عن
    // 0/A/B (اللي هي مجرد سوينغز هيكلية عادية) — يشوفها المتداول فوراً كمصدر الأهداف
    if (isC && isAnchor) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = `${GREEN}50`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.strokeStyle = `${GREEN}25`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, isC && isAnchor ? 4.2 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#141024";
    ctx.fill();
    ctx.lineWidth = isC && isAnchor ? 1.8 : 1.4;
    ctx.strokeStyle = isC ? GREEN : GOLD_LIGHT;
    ctx.stroke();
    drawPill(ctx, p.x, p.y + dy, isC && isAnchor ? "(C) Anchor" : `(${p.label})`, isC ? GREEN : GOLD_LIGHT, "700 10.5px sans-serif");
  });

  // طالما C لسا ما تأكدت: ملاحظة صغيرة توضح إنه السيكونز قيد التكوين
  if (stage === "awaiting-c") {
    const last = pts[pts.length - 1];
    drawPill(ctx, last.x + 46, last.y, _t("radar.awaitingC"), `${GOLD_LIGHT}`, "600 9.5px sans-serif", "left");
  }

  ctx.restore();
}

/* ليبل بخلفية زجاجية مدوّرة — بديل للنص المكشوف اللي كان بيتراكب فوق الشموع
   والليبلات التانية. align: "center" (فوق نقطة) أو "left" (يبلش من x يمين) */
function drawPill(ctx, x, y, text, color, font, align = "center") {
  ctx.font = font;
  const tw = ctx.measureText(text).width;
  const padX = 6;
  const boxW = tw + padX * 2;
  const boxH = 15;
  const boxX = align === "left" ? x : align === "right" ? x - boxW : x - boxW / 2;
  const boxY = y - boxH / 2;

  ctx.fillStyle = "rgba(18,20,24,0.92)";
  ctx.strokeStyle = `${color}66`;
  ctx.lineWidth = 1;
  roundRect(ctx, boxX, boxY, boxW, boxH, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, boxX + padX, y + 0.5);
  ctx.textBaseline = "alphabetic";
}

/* ============================================================================
   مسقط أهداف السيكونز (Sequence Projection — TP1..TP4) — تاسع عشر:
   هاي الأهداف الرسمية اللي يطلعها QAIS SK Engine فور تأكيد نقطة C، بغض النظر
   عن اكتمال شروط الصفقة الكاملة (Entry/SL/OB..إلخ). تماماً متل أداة
   "Trend-Based Fib Extension" بتريدنغ فيو: كل هدف عبارة عن شعاع أفقي يبلش من
   C نفسها (مش من آخر شمعة) ويمتد يمين لحد حافة الشارت، بليبل واضح فيه:
   TPn + النسبة + السعر المسقط. لو تغيّرت C (سيكونز جديد) — الرسم بينعاد بالكامل
   من الصفر كل فريم (ما في state محفوظ)، فالأهداف القديمة بتختفي تلقائياً.
   ============================================================================ */
function drawSequenceProjection(ctx, seq, timeToX, priceToY, chartW, chartH, ease) {
  const { points, targets, direction } = seq;
  const C = points?.C;
  if (!C || !targets?.length) return;

  const cx = timeToX(C.time);
  const cy = priceToY(C.price);
  if (cx == null || cy == null) return;

  const rows = targets
    .map((t, i) => ({
      y: priceToY(t.price),
      price: t.price,
      ratio: t.ratio,
      key: t.key, // "TP1".."TP4"
      idx: i + 1,
      color: i === 0 ? GREEN : BLUE,
      hit: !!t.hit,
    }))
    .filter((row) => row.y != null);
  if (!rows.length) return;

  const rightEdge = chartW - 6;
  const bendX = Math.max(cx + 40, rightEdge - 100);

  ctx.save();
  ctx.globalAlpha = ease;

  // -------- الدليل العمودي الخفيف من C نحو الأهداف — يوضّح بصرياً إنه C هي
  // نقطة انطلاق المسقط بالكامل، مش مجرد سوينغ عادي --------
  const farthestY = direction === "up" ? Math.min(...rows.map((r) => r.y)) : Math.max(...rows.map((r) => r.y));
  ctx.strokeStyle = `${GREEN}45`;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, farthestY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Decluttering: نفصل موقع الليبل عن السعر الحقيقي عشان الأهداف المتقاربة
  // (TP2/TP3 مثلاً) ما تتراكب ليبلاتها فوق بعض.
  // الصندوق ارتفاعه 32px، فالفجوة لازم تكون أكبر منه — كانت 34 يعني 2px بس
  // بين صندوق وصندوق، وبتبيّن ملزوقين. وكمان كان الترتيب بيدفع لتحت بس،
  // فآخر ليبل ممكن ينزل برّا الشارت. هلأ منوزّعهم ومنحصرهم جوّا الحدود.
  const sorted = [...rows].sort((a, b) => a.y - b.y);
  const rowGap = 40;
  const halfBox = 20;
  let prevLabelY = -Infinity;
  sorted.forEach((row) => {
    row.labelY = Math.max(row.y, prevLabelY + rowGap);
    prevLabelY = row.labelY;
  });
  // لو الكومة طلعت من تحت الشارت، ارفعها كلها لفوق بنفس المقدار
  const overflowBottom = sorted[sorted.length - 1].labelY - (chartH - halfBox);
  if (overflowBottom > 0) sorted.forEach((row) => (row.labelY -= overflowBottom));
  // وبعدها تأكد ما في ولا واحد طالع من فوق
  sorted.forEach((row) => {
    row.labelY = Math.max(halfBox, Math.min(chartH - halfBox, row.labelY));
  });

  sorted.forEach((row) => {
    // الشعاع الأفقي — يبلش بالضبط من C (مش من آخر شمعة) ويمتد للمستقبل
    ctx.strokeStyle = row.hit ? `${row.color}b0` : `${row.color}70`;
    ctx.lineWidth = row.hit ? 1.8 : 1.2;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, row.y);
    ctx.lineTo(bendX, row.y);
    ctx.stroke();
    // قطعة انزياح قصيرة لموقع الليبل لو تراكبت المستويات
    ctx.beginPath();
    ctx.moveTo(bendX, row.y);
    ctx.lineTo(rightEdge - 4, row.labelY);
    ctx.stroke();
    ctx.setLineDash([]);

    drawEdgeBox(
      ctx,
      rightEdge,
      row.labelY,
      [`${row.key}  ·  Target ${row.idx} (${row.ratio.toFixed(3)})`, fmt(row.price)],
      row.color,
      row.hit
    );
  });

  ctx.restore();
}

/* ============================================================================
   مسقط الصفقة (Entry/SL/TP) — بنفس منطق أداة "Trend-Based Fib Extension"
   بتريدنغ فيو: خط أفقي مستمر لكل مستوى من آخر شمعة لغاية حافة محور السعر،
   وليبل (النسبة + السعر) ملزوق على الحافة اليمين، بدل تِكات قصيرة مبعثرة.
   ============================================================================ */
function drawProjection(ctx, r, priceToY, lastX, chartW, chartH, ease) {
  const ready = r.tradeValid && r.entry != null && r.stopLoss != null;
  if (!ready) return;

  const targets = r.targets || [];
  const entryY = priceToY(r.entry);
  const slY = priceToY(r.stopLoss);
  if (entryY == null || slY == null) return;

  const rightEdge = chartW - 6;
  const bendX = Math.max(lastX + 40, rightEdge - 90);
  const riskPct = (Math.abs(r.entry - r.stopLoss) / r.entry) * 100;

  const rows = [
    { y: entryY, color: GOLD_LIGHT, dash: [2, 3], lines: ["ENTRY", fmt(r.entry)] },
    { y: slY, color: RED, dash: [2, 3], lines: [`SL · ${r.slSource === "SMT" ? "SMT" : _t("radar.obInvalidation")}`, fmt(r.stopLoss), `Risk ${riskPct.toFixed(2)}%`] },
  ];
  targets.forEach((t) => {
    const y = priceToY(t.price);
    if (y == null) return;
    const color = t.color === "green" ? GREEN : BLUE;
    const rr = Math.abs(t.price - r.entry) / Math.abs(r.entry - r.stopLoss);
    rows.push({ y, color, dash: [5, 4], glow: t.hit, lines: [`${t.key} · ${t.ratio} Fib`, fmt(t.price), `RR 1 : ${rr.toFixed(2)}`] });
  });

  // Decluttering: بنفصل موقع الليبل (labelY) عن موقع السعر الحقيقي (y) عشان
  // ولا ليبل يتراكب فوق التاني، بغض النظر قد إيش المستويات قريبة من بعض.
  const sorted = [...rows].sort((a, b) => a.y - b.y);
  const rowGap = 42;
  const halfBox = 22;
  let prevLabelY = -Infinity;
  sorted.forEach((row) => {
    row.labelY = Math.max(row.y, prevLabelY + rowGap);
    prevLabelY = row.labelY;
  });
  // نفس معالجة مسقط السيكونز: لو الكومة طلعت تحت حدود الشارت ارفعها كلها،
  // وبعدين احصر كل ليبل جوّا الحدود حتى ما ينقص واحد منهم من الشاشة
  const overflowBottom = sorted[sorted.length - 1].labelY - (chartH - halfBox);
  if (overflowBottom > 0) sorted.forEach((row) => (row.labelY -= overflowBottom));
  sorted.forEach((row) => {
    row.labelY = Math.max(halfBox, Math.min(chartH - halfBox, row.labelY));
  });

  ctx.save();
  ctx.globalAlpha = ease;

  sorted.forEach((row) => {
    // الخط الأفقي من آخر شمعة لحد قرب المحور (بسعره الحقيقي، بدون انزياح)
    ctx.strokeStyle = `${row.color}70`;
    ctx.lineWidth = row.glow ? 1.6 : 1;
    ctx.setLineDash(row.dash);
    ctx.beginPath();
    ctx.moveTo(lastX, row.y);
    ctx.lineTo(bendX, row.y);
    ctx.stroke();
    // قطعة قصيرة تربط السعر الحقيقي بموقع الليبل لو انزاح بسبب الديكلترينغ
    ctx.beginPath();
    ctx.moveTo(bendX, row.y);
    ctx.lineTo(rightEdge - 4, row.labelY);
    ctx.stroke();
    ctx.setLineDash([]);

    drawEdgeBox(ctx, rightEdge, row.labelY, row.lines, row.color, row.glow);
  });

  // خط المسقط القطري (زي أداة Trend-Based Extension) — من نقطة الدخول الحالية
  // لحد أبعد هدف، لإعطاء إحساس بصري بمسار/زخم الحركة المتوقعة
  const farthest = sorted[sorted.length - 1];
  if (farthest) {
    ctx.strokeStyle = `#2A2145`;
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 4]);
    ctx.beginPath();
    ctx.moveTo(lastX, entryY);
    ctx.lineTo(rightEdge - 4, farthest.labelY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // القطعة الرأسية القصيرة بين Entry وSL جنب آخر شمعة — إحساس فوري بحجم المخاطرة
  ctx.strokeStyle = `${RED}99`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(lastX + 3, entryY);
  ctx.lineTo(lastX + 3, slY);
  ctx.stroke();

  ctx.restore();
}

/* صندوق ليبل ملزوق على حافة محور السعر (يمين الشارت) — عنوان بولد + سطر/سطرين
   تفاصيل تحته، بالإضافة لنقطة صغيرة عالخط الحقيقي. لو "glow" (هدف تحقق) منزيد
   هالة حول النقطة. */
function drawEdgeBox(ctx, edgeX, y, lines, color, glow) {
  const lineH = 12;
  ctx.font = "700 10.5px sans-serif";
  const w0 = ctx.measureText(lines[0]).width;
  ctx.font = "500 9.5px sans-serif";
  const wRest = lines.slice(1).reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
  const textW = Math.max(w0, wRest);
  const padX = 8;
  const boxW = textW + padX * 2;
  const boxH = lines.length * lineH + 8;
  const boxX = edgeX - boxW - 2;
  const boxY = y - boxH / 2;

  ctx.fillStyle = "rgba(18,20,24,0.94)";
  ctx.strokeStyle = `${color}88`;
  ctx.lineWidth = 1;
  roundRect(ctx, boxX, boxY, boxW, boxH, 6);
  ctx.fill();
  ctx.stroke();

  if (glow) {
    ctx.beginPath();
    ctx.arc(boxX - 6, y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = `${color}55`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(boxX - 6, y, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.font = "700 10.5px sans-serif";
  ctx.fillStyle = color;
  ctx.fillText(lines[0], boxX + padX, boxY + 11);
  ctx.font = "500 9.5px sans-serif";
  ctx.fillStyle = "#A79FC4";
  for (let i = 1; i < lines.length; i++) {
    ctx.fillText(lines[i], boxX + padX, boxY + 11 + lineH * i);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ============================================================================
   AI Trade Card (Phase 4) — بتظهر بس لما entryStatus === "Ready" (نفس الشرط
   يلي بيتحكم بالـ signal/status بكل مكان تاني بالواجهة). ما بتحسب أي شي جديد —
   كل قيمة مسحوبة مباشرة من result (نتيجة analyzeSymbol() الجاهزة).
   ============================================================================ */
/* ============================================================================
   AI Trade Card (Phase 4) — إما تعرض إعداد جاهز للتنفيذ (entryStatus === "Ready")
   أو، لو فيه صفقة QAIS AI مفتوحة أصلاً على هاد الرمز (Chart Sync)، بتعرض تلك
   الصفقة وتقدمها الحالي بدل زر التنفيذ. ما بتحسب أي شي جديد بحالة "جاهز
   للتنفيذ" — كل قيمة مسحوبة مباشرة من result (نتيجة analyzeSymbol() الجاهزة).
   ============================================================================ */
function AITradeCard({ result: r, symbol, asset, timeframeLabel, executedTrade, executing, executeError, onExecute, syncedTrade, syncLoading, onCheckSynced }) {
  const { t, locale } = useLocale();
  // -------- حالة 1: فيه صفقة مفتوحة أصلاً على هاد الرمز (Chart Sync) --------
  if (syncedTrade) {
    const isBuy = syncedTrade.direction === "up";
    const dirColor = isBuy ? GREEN : RED;
    const stColor = statusColor(syncedTrade.status);
    return (
      <div
        className="qmi-anim"
        style={{ ...glass, border: `1.5px solid #3D2F63`, boxShadow: `0 8px 30px rgba(0,0,0,0.4), 0 0 0 1px #2A2145`, padding: "1rem 1.2rem" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${dirColor}1f`, border: `1px solid ${dirColor}66`, color: dirColor, fontWeight: 900, fontSize: 13, borderRadius: 3, padding: "5px 12px" }}>
              {isBuy ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {isBuy ? "BUY" : "SELL"}
            </div>
            <span style={{ fontWeight: 800, fontSize: 14, color: "#F5F3FF" }}>{asset?.label || symbol}</span>
            <span style={{ fontSize: 11.5, color: "#A79FC4", background: "#141024", border: "1px solid #1C1630", borderRadius: 3, padding: "3px 8px" }}>
              {syncedTrade.timeframe}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: stColor, background: `${stColor}1a`, border: `1px solid ${stColor}55`, borderRadius: 3, padding: "3px 9px" }}>
              {syncedTrade.status}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={onCheckSynced}
              disabled={syncLoading}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid #1C1630", color: "#aaa", borderRadius: 3, padding: "5px 10px", fontSize: 11, cursor: syncLoading ? "default" : "pointer" }}
            >
              <RefreshCw size={11} /> {syncLoading ? t("radar.checkingPrice") : t("radar.checkPriceNow")}
            </button>
            <Link
              href={`/ai-trades/${syncedTrade.id}`}
              style={{ display: "flex", alignItems: "center", gap: 5, background: `#2A2145`, border: `1px solid #3D2F63`, color: GOLD_LIGHT, borderRadius: 3, padding: "5px 10px", fontSize: 11, fontWeight: 700, textDecoration: "none" }}
            >
              {t("radar.fullDetails")} <ExternalLink size={11} />
            </Link>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
          <TradeCardStat label={t("radar.confidence")} value={syncedTrade.confidence != null ? `${syncedTrade.confidence}%` : "—"} color={GOLD_LIGHT} />
          <TradeCardStat label={t("radar.entry")} value={fmt(syncedTrade.entry)} />
          <TradeCardStat label={t("radar.stopLoss")} value={fmt(syncedTrade.stop_loss)} color={RED} />
          <TradeCardStat label="TP1" value={fmt(syncedTrade.tp1)} color={GREEN} />
          <TradeCardStat label="TP2" value={fmt(syncedTrade.tp2)} color={GREEN} />
          <TradeCardStat label="TP3" value={fmt(syncedTrade.tp3)} color={BLUE} />
          <TradeCardStat label="TP4" value={fmt(syncedTrade.tp4)} color={BLUE} />
          <TradeCardStat label={t("radar.riskReward")} value={syncedTrade.risk_reward != null ? `${syncedTrade.risk_reward}R` : "—"} />
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: "#6E6690" }}>
          {t("radar.lastCheckedPrice")} <b style={{ color: "#A79FC4" }}>{fmt(syncedTrade.last_checked_price)}</b>
        </div>
      </div>
    );
  }

  // -------- حالة 2: إعداد جديد جاهز للتنفيذ (entryStatus === "Ready") --------
  const isBuy = r.direction === "up";
  const dirColor = isBuy ? GREEN : RED;
  const targets = Array.isArray(r.targets) ? r.targets : [];
  const tpPrice = (i) => {
    const t = targets[i];
    if (!t) return null;
    return t.price ?? t.level ?? null;
  };
  const tps = [tpPrice(0), tpPrice(1), tpPrice(2), tpPrice(3)];

  return (
    <div
      className="qmi-anim"
      style={{
        ...glass,
        border: `1.5px solid #3D2F63`,
        boxShadow: `0 8px 30px rgba(0,0,0,0.4), 0 0 0 1px #2A2145`,
        padding: "1rem 1.2rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: `${dirColor}1f`, border: `1px solid ${dirColor}66`,
              color: dirColor, fontWeight: 900, fontSize: 13, borderRadius: 3, padding: "5px 12px",
            }}
          >
            {isBuy ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {isBuy ? "BUY" : "SELL"}
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: "#F5F3FF" }}>{asset?.label || symbol}</span>
          <span style={{ fontSize: 11.5, color: "#A79FC4", background: "#141024", border: "1px solid #1C1630", borderRadius: 3, padding: "3px 8px" }}>
            {timeframeLabel}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: GOLD_LIGHT, background: `#2A2145`, border: `1px solid #3D2F63`, borderRadius: 3, padding: "3px 8px" }}>
            <CheckCircle2 size={11} />{t("radar.entryStatusReady")}</span>
        </div>
        <span style={{ fontSize: 11, color: "#6E6690" }}>{new Date().toLocaleString(locale === "ar" ? "ar-EG" : "en-GB")}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginBottom: 16 }}>
        <TradeCardStat label={t("radar.confidence")} value={`${r.aiConfidence ?? r.radarScore ?? 0}%`} color={GOLD_LIGHT} />
        <TradeCardStat label={t("radar.entry")} value={fmt(r.entry)} />
        <TradeCardStat label={t("radar.stopLoss")} value={fmt(r.stopLoss)} color={RED} />
        <TradeCardStat label="TP1" value={fmt(tps[0])} color={GREEN} />
        <TradeCardStat label="TP2" value={fmt(tps[1])} color={GREEN} />
        <TradeCardStat label="TP3" value={fmt(tps[2])} color={BLUE} />
        <TradeCardStat label="TP4" value={fmt(tps[3])} color={BLUE} />
        <TradeCardStat label={t("radar.riskReward")} value={r.riskReward != null ? `${r.riskReward}R` : "—"} />
      </div>

      {executeError && <div style={{ color: RED, fontSize: 12, marginBottom: 10 }}>{executeError}</div>}

      {executedTrade ? (
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: `${GREEN}18`, border: `1px solid ${GREEN}55`, color: GREEN,
            fontWeight: 800, fontSize: 13.5, borderRadius: 3, padding: "12px 20px",
          }}
        >
          <CheckCircle2 size={16} /> {t("radar.tradeExecutedInAcademy")} — Status: {executedTrade.status}
        </div>
      ) : (
        <button
          onClick={onExecute}
          disabled={executing}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
            border: "none", color: "#141024", fontWeight: 900, fontSize: 14.5,
            borderRadius: 3, padding: "13px 20px", cursor: executing ? "default" : "pointer",
            opacity: executing ? 0.7 : 1,
          }}
        >
          <Zap size={16} fill="#141024" />
          {executing ? t("radar.executing") : t("radar.executeTrade")}
        </button>
      )}
    </div>
  );
}

function statusColor(status) {
  if (status === "Closed Winner") return GREEN;
  if (status === "Stopped Out") return RED;
  if (status === "Open") return "#A79FC4";
  return GOLD_LIGHT; // Running / TPx Hit
}

function TradeCardStat({ label, value, color = "#F5F3FF" }) {
  return (
    <div style={{ background: "#141024", border: "1px solid #1C1630", borderRadius: 3, padding: "7px 10px" }}>
      <div style={{ fontSize: 10.5, color: "#6E6690", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

/* ============================================================================
   لوحة تحليل QAIS SK Engine — يمين الشارت (٣٠٪) — كل قيمة من analyzeSymbol()
   ============================================================================ */
function AIPanel({ result: r, signal, tab, setTab, primarySession }) {
  const { t } = useLocale();
  // Single source of truth: every value below reads directly from the same
  // decision object (r) that Active Opportunities / Liquidity Map / AI
  // Briefing also read — nothing here is recomputed independently anymore.
  const STATUS_COLOR = { green: GREEN, blue: BLUE, orange: AMBER, yellow: "#F0A13C", red: RED, gray: "#6E6690" };
  const scoreColor = STATUS_COLOR[r?.radarStatus] || "#6E6690";
  // Quality Score = how complete the setup is. AI Confidence = how likely it is to play out.
  // Shown separately and labeled — see decision.js for the full definitions.
  const qualityScore = r?.qualityScore ?? r?.score ?? 0;
  const aiConfidence = r?.aiConfidence ?? r?.radarScore ?? 0;
  const signalColor = signal === "BUY" ? GREEN : signal === "SELL" ? RED : "#6E6690";

  const htfTrend = r?.htfTrend ?? (r?.context?.weekly?.trend || r?.structureLadder?.[0]?.trend || r?.direction);
  const marketStructure = r?.marketStructure || (r?.direction === "up" ? t("radar.hhHl") : r?.direction === "down" ? t("radar.lhLl") : "—");
  const bosOk = r?.bosStatus === "Detected";
  const chochOk = r?.chochStatus === "Detected";
  const liquidityLabel = r?.liquidityStatus || t("radar.notSwept");
  const premiumDiscount = r?.premiumDiscount || "—";
  const volume = r?.volumeConfirmed ? t("radar.levelHigh") : r?.ob?.eligible ? t("radar.levelMedium") : t("radar.levelLow");
  // entryStatus and signalStrength come straight from the engine — both are
  // gated by the same tradeValid boolean as `signal`, so they can never say
  // "Ready" / t("radar.strong") while signal says WAIT.
  const entryStatus = r?.entryStatus || t("radar.monitoring");
  const signalStrength = r?.radarSignalStrengthLabel || "—";
  const lastTarget = r?.targets?.[r.targets.length - 1];
  const rr = lastTarget && r?.entry != null && r?.stopLoss != null
    ? Math.abs(lastTarget.price - r.entry) / Math.abs(r.entry - r.stopLoss)
    : null;

  // -------- تسلسل الأهمية البصرية (نفس القيم المحسوبة فوق تماماً، فقط إعادة تنظيم للعرض) --------
  // Tier 1: أهم شي يشوفه المتداول أول ثانية — Signal / Confidence / Current Status / Session
  const tier1 = [
    { label: t("radar.signal"), value: signal || "—", color: signalColor },
    { label: t("radar.aiConfidence"), value: `${aiConfidence}%`, color: scoreColor },
    { label: t("radar.qualityScore"), value: `${qualityScore}%`, color: qualityScore >= 80 ? GREEN : qualityScore >= 50 ? GOLD_LIGHT : "#6E6690" },
    { label: t("radar.currentStatus"), value: entryStatus, color: entryStatus === "Ready" ? GREEN : GOLD_LIGHT },
    { label: t("radar.session"), value: primarySession, color: BLUE },
  ];
  // Tier 2: اتجاه وهيكلية السوق
  const tier2 = [
    { label: t("radar.trend"), value: r?.direction === "up" ? "Bullish" : r?.direction === "down" ? "Bearish" : "—", color: r?.direction === "up" ? GREEN : r?.direction === "down" ? RED : "#6E6690" },
    { label: t("radar.htfTrend"), value: htfTrend === "up" ? "Bullish" : htfTrend === "down" ? "Bearish" : "—", color: htfTrend === "up" ? GREEN : htfTrend === "down" ? RED : "#6E6690" },
    { label: t("radar.marketStructure"), value: marketStructure },
    { label: t("radar.liquidity"), value: liquidityLabel },
  ];
  // Tier 3: تفاصيل الأكشن السعري
  const tier3 = [
    { label: t("radar.orderBlock"), value: r?.ob?.eligible ? `${r.ob.status} ${r.direction === "up" ? "Bullish" : "Bearish"} OB` : t("radar.notFormed") },
    { label: t("radar.fvg"), value: r?.ob?.fvgExists ? "Open" : "None" },
    { label: "CHOCH", value: chochOk ? t("radar.confirmed") : t("radar.pending"), color: chochOk ? GREEN : "#6E6690" },
    { label: "BOS", value: bosOk ? t("radar.confirmed") : t("radar.pending"), color: bosOk ? GREEN : "#6E6690" },
  ];
  // معلومات إضافية (Premium/Discount, Volume, Signal Strength) — نفس القيم القديمة، منعرضها ضمن تير 3 كصف ثاني
  const tier3b = [
    { label: t("radar.premiumDiscount"), value: premiumDiscount },
    { label: t("radar.volume"), value: volume },
    { label: t("radar.signalStrength"), value: signalStrength },
  ];

  return (
    <div style={{ ...glass, padding: "1rem", display: "flex", flexDirection: "column", gap: 12, maxHeight: CHART_H + 56, overflowY: "auto" }} className="qmi-scroll">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Sparkles size={14} color={GOLD} />
        <span style={{ fontSize: 12.5, fontWeight: 800, color: "#F5F3FF", letterSpacing: 0.3 }}>{t("radar.skAnalysis")}</span>
      </div>

      {!r ? (
        <div style={{ color: "#6E6690", fontSize: 12.5, padding: "1rem 0", textAlign: "center" }}>{t("radar.loadingAnalysis")}</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#F5F3FF" }}>{r.symbol}</div>
              <div style={{ fontSize: 11, color: "#6E6690" }}>{fmt(r.price)}</div>
            </div>
            {signal && (
              <span style={{ background: `${signalColor}22`, border: `1px solid ${signalColor}`, color: signalColor, fontWeight: 800, fontSize: 13, borderRadius: 3, padding: "6px 14px" }}>
                {signal}
              </span>
            )}
            <div
              style={{
                width: 58, height: 58, borderRadius: "50%", flexShrink: 0,
                background: `conic-gradient(${scoreColor} ${aiConfidence * 3.6}deg, #1C1630 0deg)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#141024", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#F5F3FF" }}>{aiConfidence}%</span>
              </div>
            </div>
          </div>

          {r.newsBlock && (
            <div
              style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.4)",
                borderRadius: 3, padding: "8px 10px",
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}><AlertTriangle size={14} aria-hidden /></span>
              <div style={{ fontSize: 11.5, color: "#FF453A", lineHeight: 1.6 }}>
                <b style={{ color: "#FF453A" }}>News Block ({r.newsBlock.currency})</b> — {r.newsBlock.title}
                {" — "}
                {r.newsBlock.minutesFromNow >= 0
                  ? `in ${r.newsBlock.minutesFromNow} min`
                  : `${Math.abs(r.newsBlock.minutesFromNow)} min ago`}
                . No new entries until the news-safety window clears.
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 4, background: "#141024", borderRadius: 3, padding: 3 }}>
            <button
              onClick={() => setTab("analysis")}
              style={{ flex: 1, background: tab === "analysis" ? `#2A2145` : "transparent", color: tab === "analysis" ? GOLD_LIGHT : "#6E6690", border: "none", borderRadius: 3, padding: "6px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >{t("radar.analysis")}</button>
            <button
              onClick={() => setTab("why")}
              style={{ flex: 1, background: tab === "why" ? `#2A2145` : "transparent", color: tab === "why" ? GOLD_LIGHT : "#6E6690", border: "none", borderRadius: 3, padding: "6px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Why This Trade?
            </button>
          </div>

          {tab === "analysis" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* -------- Tier 1: الأهم — يُقرأ خلال ثانية واحدة -------- */}
              <div>
                <TierLabel text={t("radar.keySignal")} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {tier1.map((it) => (
                    <PriorityStat key={it.label} label={it.label} value={it.value} color={it.color} size="lg" />
                  ))}
                </div>
              </div>

              {/* -------- Tier 2: اتجاه وهيكلية السوق -------- */}
              <div>
                <TierLabel text="Trend &amp; Structure" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  {tier2.map((it) => (
                    <PriorityStat key={it.label} label={it.label} value={it.value} color={it.color} size="md" />
                  ))}
                </div>
              </div>

              {/* -------- Tier 3: تفاصيل الأكشن السعري -------- */}
              <div>
                <TierLabel text={t("radar.priceActionDetail")} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {tier3.map((it) => (
                    <PriorityStat key={it.label} label={it.label} value={it.value} color={it.color} size="sm" />
                  ))}
                  {tier3b.map((it) => (
                    <PriorityStat key={it.label} label={it.label} value={it.value} color={it.color} size="sm" />
                  ))}
                </div>
              </div>

              {/* -------- أخيراً: مستويات الصفقة -------- */}
              <div>
                <TierLabel text={t("radar.tradeLevels")} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <MiniStat label={t("radar.entryZone")} value={fmt(r.entry)} color={GOLD_LIGHT} />
                  <MiniStat label={t("radar.stopLoss")} value={fmt(r.stopLoss)} color={RED} />
                  <MiniStat label={t("radar.takeProfit")} value={lastTarget ? fmt(lastTarget.price) : "—"} color={GREEN} />
                  <MiniStat label={t("radar.rrRatio")} value={rr ? `1 : ${rr.toFixed(1)}` : "—"} color={BLUE} />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {r.reasonTags?.length > 0 && (
                <div style={{ fontSize: 12, color: "#A79FC4", lineHeight: 1.7 }}>
                  {t("radar.signalBasedOn")} <b style={{ color: GOLD_LIGHT }}>{r.reasonTags.join(" + ")}</b>
                </div>
              )}
              {(r.reasonsChecklist || []).map((c) => (
                <div key={c.key} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: c.ok ? "#ddd" : "#6E6690" }}>
                  <span style={{ color: c.ok ? GREEN : "#4A4368" }}>{c.ok ? "✓" : "○"}</span>
                  <span>{c.label}</span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: "#6E6690", marginTop: 6, lineHeight: 1.7 }}>
                QAIS Quality Score: {qualityScore}/100 — {r.tradeValid ? t("radar.allConditionsMet") : t("radar.conditionsPending")}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: "#141024", borderRadius: 3, padding: "7px 9px" }}>
      <div style={{ fontSize: 10, color: "#6E6690" }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: color || "#F5F3FF" }}>{value}</div>
    </div>
  );
}

/* عنوان صغير لكل مجموعة أهمية داخل لوحة التحليل — يفصل بصرياً بين المستويات */
function TierLabel({ text }) {
  return (
    <div style={{ fontSize: 9.5, fontWeight: 800, color: "#6E6690", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>
      {text}
    </div>
  );
}

/* بطاقة إحصائية بثلاث كثافات بصرية (lg/md/sm) — تُستخدم لبناء تسلسل الأهمية بلوحة التحليل */
function PriorityStat({ label, value, color, size = "md" }) {
  const sizing = {
    lg: { pad: "10px 12px", labelSize: 10, valueSize: 15, borderW: 3 },
    md: { pad: "8px 10px", labelSize: 9.5, valueSize: 12.5, borderW: 2 },
    sm: { pad: "6px 9px", labelSize: 9, valueSize: 11, borderW: 2 },
  }[size];
  const c = color || "#6E6690";
  return (
    <div
      style={{
        background: "#141024",
        borderRadius: 3,
        padding: sizing.pad,
        /* الاختصار border لازم ييجي أول، وبعده الحواف المفردة — عكسها بيخلي
           React يحذّر من تضارب shorthand مع non-shorthand ويسبّب رفّة بالتنسيق */
        border: "1px solid #141024",
        borderInlineStartWidth: sizing.borderW,
        borderInlineStartStyle: "solid",
        borderInlineStartColor: c,
      }}
    >
      <div style={{ fontSize: sizing.labelSize, color: "#6E6690", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: sizing.valueSize, fontWeight: 800, color: size === "sm" ? "#A79FC4" : c }}>{value}</div>
    </div>
  );
}

/* ============================================================================
   كرت 1: Currency Heat Map — من /api/market-intelligence?type=snapshot
   ============================================================================ */
export function CurrencyHeatMapCard({ snapshot, trend = {} }) {
  const { t } = useLocale();
  const currencies = snapshot?.currencies || {};
  const entries = Object.entries(currencies)
    .filter(([, v]) => v != null)
    .sort((a, b) => b[1] - a[1]);

  function meta(v) {
    if (v >= 65) return { label: t("radar.strong"), color: GREEN };
    if (v <= 40) return { label: "Weak", color: RED };
    return { label: "Neutral", color: "#6E6690" };
  }

  // اتجاه حقيقي مبني على فرق آخر سنابشوتين حيّين (لا شي مصطنع) — trend[ccy] تُحسب بـ loadSnapshot أعلى بالمكوّن الأب
  function trendMeta(ccy, color) {
    const trendVal = trend[ccy];
    if (trendVal === "up") return { arrow: "↑", text: t("radar.strengthIncreasing"), color: GREEN };
    if (trendVal === "down") return { arrow: "↓", text: t("radar.losingStrength"), color: RED };
    if (trendVal === "flat") return { arrow: "→", text: t("radar.holdingSteady"), color: "#6E6690" };
    return { arrow: "", text: "", color };
  }

  return (
    <CardShell title={t("radar.currencyHeatMap")} icon={LayoutGrid}>
      {entries.length === 0 ? (
        <EmptyNote text={t("radar.loadingCurrencyStrength")} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {entries.map(([ccy, v]) => {
            const m = meta(v);
            const tm = trendMeta(ccy, m.color);
            return (
              <div key={ccy} style={{ background: "#141024", border: `1px solid ${m.color}33`, borderRadius: 3, padding: "8px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "#6E6690", fontWeight: 700 }}>{ccy}</span>
                  {tm.arrow && <span style={{ fontSize: 12, fontWeight: 800, color: tm.color }}>{tm.arrow}</span>}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{v}</div>
                <div style={{ fontSize: 10, color: m.color }}>{m.label}</div>
                {tm.text && <div style={{ fontSize: 9, color: tm.color, marginTop: 2 }}>{tm.text}</div>}
              </div>
            );
          })}
        </div>
      )}
    </CardShell>
  );
}

/* ============================================================================
   كرت 2: Session Map — محسوب من الوقت الحالي (UTC)
   ============================================================================ */
export function SessionMapCard({ sessions, nowTick }) {
  const { t } = useLocale();
  const { next } = useMemo(() => getSessionTimeline(sessions), [sessions]);
  const overlap = useMemo(() => getActiveOverlap(sessions), [sessions]);
  const activeSessions = sessions.filter((s) => s.active);

  const currentLabel = overlap ? `${overlap.label} Overlap` : activeSessions[0]?.label || t("radar.sessionOff");
  const info = overlap
    ? { liquidity: overlap.liquidity, volatility: t("radar.levelVeryHigh"), behaviour: t("radar.behTrendBreakouts"), recommendation: "The busiest window of the day — best conditions for breakout and trend-continuation trades." }
    : SESSION_INFO[activeSessions[0]?.key] || SESSION_INFO.off;

  // عدّاد تنازلي حي بدقة الثانية لأقرب جلسة قادمة — نفس next.startsIn (بالساعات)، محسوب هون
  // بدقة أعلى اعتماداً على نبضة nowTick (كل ثانية) بدل الاعتماد فقط على تحديث sessions كل دقيقة
  const liveCountdown = useMemo(() => {
    if (!next) return null;
    const d = new Date(nowTick);
    const hFrac = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    let diff = next.start - hFrac;
    if (diff <= 0) diff += 24;
    return countdownLabel(diff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, nowTick]);

  return (
    <CardShell title={t("radar.sessionMap")} icon={Clock}>
      <div style={{ fontSize: 10.5, color: "#6E6690", marginBottom: 10, lineHeight: 1.6 }}>
        A live 24-hour view of the four major FX sessions. The white line is right now — watch for the gold-striped zone, that's when two sessions overlap and liquidity is highest.
      </div>

      <SessionTimelineVisual sessions={sessions} overlap={overlap} nowTick={nowTick} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0 12px" }}>
        {sessions.map((s) => (
          <div
            key={s.key}
            title={`${s.label} · ${String(s.start).padStart(2, "0")}:00–${String(s.end).padStart(2, "0")}:00 UTC`}
            style={{
              display: "flex", alignItems: "center", gap: 5, background: "#141024",
              border: `1px solid ${s.active ? s.color : "#1C1630"}88`, borderRadius: 20, padding: "3px 9px",
              transition: "border-color .4s ease, background .4s ease",
            }}
          >
            <span className={s.active ? "qmi-dot" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: s.active ? s.color : "#4A4368" }} />
            <span style={{ fontSize: 10, color: s.active ? "#F5F3FF" : "#6E6690", fontWeight: s.active ? 800 : 600 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* -------- كروت الشرح: الجلسة الحالية / مستوى السيولة / التقلب / السلوك / أسلوب التداول المقترح -------- */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ background: "#141024", borderRadius: 3, padding: "7px 9px" }}>
          <div style={{ fontSize: 10, color: "#6E6690", display: "flex", alignItems: "center", gap: 5 }}>
            <span className="qmi-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: GOLD_LIGHT, display: "inline-block" }} />{t("radar.currentSession")}</div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: GOLD_LIGHT }}>{currentLabel}</div>
        </div>
        <MiniStat label={t("radar.liquidityLevel")} value={t(info.liquidity)} color={GREEN} />
        <MiniStat label={t("radar.expectedVolatility")} value={t(info.volatility)} color={AMBER} />
        <MiniStat label={t("radar.typicalBehaviour")} value={t(info.behaviour)} color={BLUE} />
      </div>
      <div style={{ marginTop: 8, background: "#141024", borderRadius: 3, padding: "9px 11px" }}>
        <div style={{ fontSize: 9.5, color: "#6E6690", marginBottom: 3 }}>{t("radar.recommendedStyle")}</div>
        <div style={{ fontSize: 11.5, color: "#F5F3FF", fontWeight: 700, lineHeight: 1.6 }}>{t(info.recommendation)}</div>
      </div>

      {next && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "1px solid #ffffff10" }}>
          <span style={{ fontSize: 10.5, color: "#6E6690" }}>{t("radar.nextSession")}<b style={{ color: "#A79FC4" }}>{next.label}</b>
          </span>
          <span
            style={{
              fontSize: 11, fontWeight: 800, color: GOLD_LIGHT, background: `#2A2145`,
              border: `1px solid #3D2F63`, borderRadius: 20, padding: "2px 9px", fontVariantNumeric: "tabular-nums",
            }}
          >
            {liveCountdown || hoursLabel(next.startsIn, t)}
          </span>
        </div>
      )}
    </CardShell>
  );
}

/* خط الجلسات المرئي: 24 ساعة، بدعم النطاقات الملفوفة (Sydney) + تظليل التداخل الفعلي + مؤشر الوقت الحالي */
function SessionTimelineVisual({ sessions, overlap, nowTick }) {
  const { t } = useLocale();
  const d = new Date(nowTick ?? Date.now());
  const now = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;

  function segmentsOf(s) {
    return s.start < s.end ? [[s.start, s.end]] : [[s.start, 24], [0, s.end]];
  }

  const overlapSegments = useMemo(() => {
    if (!overlap) return [];
    const [a, b] = overlap.keys.map((k) => sessions.find((s) => s.key === k));
    if (!a || !b) return [];
    const out = [];
    for (const [as, ae] of segmentsOf(a)) {
      for (const [bs, be] of segmentsOf(b)) {
        const lo = Math.max(as, bs);
        const hi = Math.min(ae, be);
        if (hi > lo) out.push([lo, hi]);
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlap, sessions]);

  return (
    <div>
      <div style={{ position: "relative", height: 34, background: "#0E0A1A", borderRadius: 3, overflow: "hidden", border: "1px solid #1C1630" }}>
        {sessions.map((s) =>
          segmentsOf(s).map(([st, en], i) => (
            <div
              key={`${s.key}-${i}`}
              title={s.label}
              style={{
                position: "absolute",
                left: `${(st / 24) * 100}%`,
                width: `${((en - st) / 24) * 100}%`,
                top: 4,
                bottom: 4,
                background: `${s.color}${s.active ? "55" : "20"}`,
                border: `1px solid ${s.color}${s.active ? "aa" : "40"}`,
                borderRadius: 3,
                transition: "all .3s ease",
              }}
            />
          ))
        )}
        {overlapSegments.map(([st, en], i) => (
          <div
            key={`ov-${i}`}
            title={`${overlap.label} — highest liquidity`}
            style={{
              position: "absolute",
              left: `${(st / 24) * 100}%`,
              width: `${((en - st) / 24) * 100}%`,
              top: 0,
              bottom: 0,
              background: `repeating-linear-gradient(45deg, #3D2F63, #3D2F63 3px, transparent 3px, transparent 6px)`,
              border: `1px solid ${GOLD}`,
              borderRadius: 3,
              boxShadow: `0 0 8px #3D2F63`,
            }}
          />
        ))}
        <div
          className="qmi-dot"
          style={{ position: "absolute", left: `${(now / 24) * 100}%`, top: -2, bottom: -2, width: 2, background: "#fff", boxShadow: "0 0 6px #fff", transition: "left 1s linear" }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "#4A4368", marginTop: 3 }}>
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>

      {/* -------- شرح دائم لعناصر الخط الزمني: الخط الأبيض = الآن، والشرائط الذهبية = تداخل جلستين -------- */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6, fontSize: 9, color: "#6E6690" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 2, height: 9, background: "#fff", display: "inline-block", boxShadow: "0 0 4px #fff" }} />{t("radar.rightNow")}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 12, height: 9, borderRadius: 2, display: "inline-block", background: `repeating-linear-gradient(45deg, #3D2F63, #3D2F63 2px, transparent 2px, transparent 4px)`, border: `1px solid ${GOLD}` }} /> Session overlap · highest liquidity
        </span>
      </div>

      {overlap && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 10.5, color: GOLD_LIGHT, fontWeight: 700 }}>{overlap.label} overlap — {overlap.liquidity} liquidity right now
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   كرت 3: Active Opportunities — من /api/radar (نفس QAIS Engine، مخزّنة بالكرون)
   يعرض كل صف كامل (رمز/اتجاه/سكور/حالة/فريم) بدل رقم واحد فقط — كل القيم من
   نفس أعمدة radar v2 الحقيقية (radar_status/radar_score/entry_status/timeframe).
   ============================================================================ */
const OPP_PREVIEW_COUNT = 5;

function LiveOpportunitiesCard({ items, openTradeSymbols, onOpen, nowTick }) {
  const { t } = useLocale();
  void nowTick; // يفرض إعادة تقييم "منذ..." كل ثانية لعرض عمر كل صف بدقة
  const [showAll, setShowAll] = useState(false);

  // t("radar.activeOpportunities") must only contain setups that are genuinely
  // actionable right now (entry_status === "Ready", the same tradeValid-gated
  // field the Analysis Panel and every other card read). Everything else is
  // still forming and gets shown as Building/Watching/Monitoring further
  // down — never mislabeled as a ready opportunity.
  //
  // رمز عليه صفقة QAIS AI مفتوحة فعلياً بيتنقل لقائمة منفصلة (openPositions)
  // بدل ما يظهر كفرصة "جاهزة" جديدة — هيك ما بيصير التعارض (يشوف الطالب
  // BUY جاهزة، يضغط، ويلاقي صفقة SELL شغّالة من قبل بدل ما ينفّذ اللي شافه).
  const { ready, forming, openPositions } = useMemo(() => {
    const order = { green: 0, blue: 1, orange: 2, red: 3, yellow: 4, gray: 5 };
    const byScore = (a, b) =>
      (order[a.radar_status] ?? 9) - (order[b.radar_status] ?? 9) || (b.radar_score ?? b.score ?? 0) - (a.radar_score ?? a.score ?? 0);
    const hasOpenTrade = (i) => openTradeSymbols?.has(i.symbol);
    const ready = items.filter((i) => i.entry_status === "Ready" && !hasOpenTrade(i)).sort(byScore);
    const forming = items.filter((i) => i.entry_status !== "Ready" && !hasOpenTrade(i)).sort(byScore);
    const openPositions = items.filter(hasOpenTrade).sort(byScore);
    return { ready, forming, openPositions };
  }, [items, openTradeSymbols]);

  const sorted = ready.length ? ready : forming; // fall back to showing forming setups only when nothing is ready yet
  const visible = showAll ? sorted : sorted.slice(0, OPP_PREVIEW_COUNT);

  return (
    <CardShell title={t("radar.activeOpportunities")} icon={Zap}>
      {items.length === 0 ? (
        <EmptyNote text={t("radar.noMonitoredAssets")} />
      ) : sorted.length === 0 ? (
        <EmptyNote text="No actionable setups right now — the engine is still scanning." />
      ) : (
        <>
          {!ready.length && (
            <div style={{ fontSize: 10.5, color: GOLD_LIGHT, marginBottom: 8, fontWeight: 700 }}>
              No setup is fully confirmed yet — showing what's currently forming.
            </div>
          )}
          {openPositions.length > 0 && (
            <div style={{ fontSize: 10.5, color: "#6E6690", marginBottom: 8 }}>
              {openPositions.length} symbol{openPositions.length > 1 ? "s" : ""} already {"have"} an open trade — hidden from new opportunities until closed.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {visible.map((it) => {
              const meta = radarStatusMeta(it);
              const isReady = it.entry_status === "Ready";
              const dirLabel = it.direction === "up" ? (isReady ? "BUY" : t("radar.buyBias")) : it.direction === "down" ? (isReady ? "SELL" : t("radar.sellBias")) : "—";
              const dirColor = it.direction === "up" ? GREEN : it.direction === "down" ? RED : "#6E6690";
              const confidence = it.radar_score ?? it.score ?? 0;
              return (
                <button
                  key={it.symbol}
                  onClick={() => onOpen(it.symbol)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "right",
                    background: "#141024", border: "1px solid transparent", borderRadius: 3, padding: "8px 10px",
                    cursor: "pointer", transition: "border-color .2s ease, background .2s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = `#3D2F63`)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
                >
                  {/* مؤشر ملوّن صغير لحالة الإشارة */}
                  <span className={["green", "red"].includes(it.radar_status) ? "qmi-dot" : ""} style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#F5F3FF" }}>{it.symbol}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, color: dirColor, background: `${dirColor}22`, borderRadius: 3, padding: "1px 6px" }}>{dirLabel}</span>
                      {it.timeframe && (
                        <span style={{ fontSize: 8.5, fontWeight: 700, color: "#6E6690", background: "#141024", borderRadius: 3, padding: "1px 6px" }}>{it.timeframe}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 9.5, color: meta.color, marginTop: 2, fontWeight: 700 }}>
                      {it.entry_status || meta.label}
                      {it.updated_at && (
                        <span style={{ color: "#6E6690", fontWeight: 600 }}> · {relTime(it.updated_at, t)}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: "left", flexShrink: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: confidence >= 80 ? GREEN : confidence >= 60 ? GOLD_LIGHT : "#A79FC4" }}>{confidence}%</div>
                    <div style={{ fontSize: 8, color: "#6E6690" }}>{t("radar.score")}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {sorted.length > OPP_PREVIEW_COUNT && (
            <button
              onClick={() => setShowAll((v) => !v)}
              style={{
                marginTop: 9, width: "100%", background: "transparent", border: `1px solid #3D2F63`,
                color: GOLD_LIGHT, borderRadius: 3, padding: "7px 0", fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >
              {showAll ? t("radar.showLess") : `View All Opportunities (${sorted.length})`}
            </button>
          )}
        </>
      )}
    </CardShell>
  );
}

/* ============================================================================
   Liquidity Map — قسم كامل بعرض الصفحة: كروت شرح المفاهيم + جدول قابل للنقر +
   Analysis Workspace دائم تحته (بيتحدّث بس، من غير أي popup). من نفس بيانات
   /api/radar (decision كامل لكل رمز مراقَب).
   ============================================================================ */
export function LiquidityMapSection({ items, selectedSymbol, onSelect, limit = 8 }) {
  const { t } = useLocale();
  const sorted = useMemo(
    () =>
      [...items]
        .filter((i) => i.decision)
        .sort((a, b) => (b.radar_score ?? b.score ?? 0) - (a.radar_score ?? a.score ?? 0))
        .slice(0, limit),
    [items, limit]
  );
  const active = items.find((i) => i.symbol === selectedSymbol) || sorted[0] || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="qmi-anim" style={{ ...glass, padding: "1.1rem" }}>
        <SectionHeader
          icon={Droplets}
          title={t("radar.liquidityMap")}
          subtitle="Where price is hunting liquidity right now. Click any row to load its full breakdown in the Analysis Workspace below — nothing pops up, the page just updates."
        />

        {/* -------- كروت شرح المفاهيم (بدل الفقرة الطويلة) -------- */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, margin: "16px 0 18px" }}>
          <ConceptCard icon={ArrowUpToLine} title={t("radar.aboveHigh")} lines={[t("radar.sweptHighs"), t("radar.takesBuySide")]} color={RED} />
          <ConceptCard icon={ArrowDownToLine} title={t("radar.belowLow")} lines={[t("radar.sweptLows"), t("radar.takesSellSide")]} color={GREEN} />
          <ConceptCard icon={Blocks} title={t("radar.orderBlock")} lines={[t("radar.obDesc")]} color={GOLD_LIGHT} />
          <ConceptCard icon={Rows3} title={t("radar.fvg")} lines={[t("radar.fvgDesc")]} color={BLUE} />
          <ConceptCard icon={Target} title={t("radar.qualityScore")} lines={[t("radar.qualityDescLong")]} color={GOLD} />
          <ConceptCard icon={Brain} title={t("radar.aiConfidence")} lines={[t("radar.confidenceDescLong")]} color={GOLD_LIGHT} />
        </div>

        {sorted.length === 0 ? (
          <EmptyNote text={t("radar.waitingFirstCycle")} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div className="qmi-liq-row qmi-liq-head">
              <span>{t("radar.symbol")}</span>
              <span>{t("radar.direction")}</span>
              <span>{t("radar.score")}</span>
              <span>{t("radar.liquidityStatus")}</span>
              <span>{t("radar.orderBlock")}</span>
              <span>{t("radar.fvg")}</span>
              <span>{t("radar.confidence")}</span>
              <span>{t("radar.timeframe")}</span>
              <span>{t("radar.status")}</span>
            </div>
            {sorted.map((it) => {
              const d = it.decision;
              const swept = !!d?.liquidityStatus?.startsWith?.("Swept");
              const liqLabel = swept ? (it.direction === "up" ? t("radar.belowLow") : t("radar.aboveHigh")) : d?.liquidityStatus || t("radar.notSwept");
              const liqColor = swept ? (it.direction === "up" ? GREEN : RED) : "#6E6690";
              const obLabel = d?.ob?.eligible ? `${it.direction === "up" ? "Bullish" : "Bearish"} OB` : "—";
              const fvgLabel = d?.fvgStatus || "—";
              // Quality Score (setup completeness) vs AI Confidence (likelihood to play out) —
              // two distinct metrics, same numbers Active Opportunities / Analysis Panel show.
              const score = it.score ?? 0;
              const confidence = it.radar_score ?? d?.radarScore ?? 0;
              const confLabel = confidence >= 80 ? t("radar.levelHigh") : confidence >= 50 ? t("radar.levelMedium") : t("radar.levelLow");
              const confColor = confidence >= 80 ? GREEN : confidence >= 50 ? GOLD_LIGHT : "#6E6690";
              const dirLabel = it.direction === "up" ? "BUY" : it.direction === "down" ? "SELL" : "—";
              const dirColor = it.direction === "up" ? GREEN : it.direction === "down" ? RED : "#6E6690";
              const meta = radarStatusMeta(it);
              const isSelected = active?.symbol === it.symbol;
              return (
                <button
                  key={it.symbol}
                  onClick={() => onSelect(it.symbol)}
                  className="qmi-liq-row qmi-liq-body"
                  style={{
                    background: isSelected ? `#2A2145` : "#141024",
                    border: `1px solid ${isSelected ? `#3D2F63` : "transparent"}`,
                    boxShadow: isSelected ? `0 6px 18px #2A2145` : "0 2px 8px rgba(0,0,0,0.18)",
                  }}
                >
                  <span data-label={t("radar.symbol")} style={{ fontWeight: 800, color: "#F5F3FF", display: "flex", alignItems: "center", gap: 6 }}>
                    {isSelected && <span style={{ width: 5, height: 5, borderRadius: "50%", background: GOLD, flexShrink: 0 }} />}
                    {it.symbol}
                  </span>
                  <span data-label={t("radar.direction")}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: dirColor, background: `${dirColor}20`, borderRadius: 3, padding: "3px 8px" }}>{dirLabel}</span>
                  </span>
                  <span data-label={t("radar.score")} style={{ fontWeight: 800, color: score >= 85 ? GREEN : "#A79FC4" }}>{score}%</span>
                  <span data-label={t("radar.liquidityStatus")} style={{ color: liqColor, fontWeight: 700 }}>{liqLabel}</span>
                  <span data-label={t("radar.orderBlock")} style={{ color: d?.ob?.eligible ? GOLD_LIGHT : "#6E6690" }}>{obLabel}</span>
                  <span data-label={t("radar.fvg")} style={{ color: fvgLabel === "Present" ? BLUE : "#6E6690" }}>{fvgLabel}</span>
                  <span data-label={t("radar.confidence")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 34, height: 5, borderRadius: 3, background: "#0E0A1A", overflow: "hidden", flexShrink: 0 }}>
                      <span style={{ display: "block", height: "100%", width: `${confidence}%`, background: confColor, borderRadius: 3 }} />
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: confColor }}>{confLabel}</span>
                  </span>
                  <span data-label={t("radar.timeframe")} style={{ color: "#A79FC4", fontWeight: 700 }}>{it.timeframe || "—"}</span>
                  <span data-label={t("radar.status")}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 800, color: meta.color, background: `${meta.color}1f`, borderRadius: 3, padding: "3px 8px" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: meta.color }} />
                      {it.entry_status || meta.label}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <AnalysisWorkspace item={active} />
    </div>
  );
}

/* ============================================================================
   Qais SK Engine — AI Briefing generator
   يبني بريفنغ مؤسسي كامل (وضع السوق الآن، ايش ناقص، سيناريو صعودي/هبوطي،
   شرح الثقة، وتوصية نهائية) من بيانات القرار الحقيقية (d) — ولا نص ثابت.
   ============================================================================ */
/* ثابت على مستوى الموديول — بينبنى وقت الاستيراد، قبل ما يكون في `t`.
   فالقيم بتضل نصوص، وبتنترجم وقت العرض عبر _t لو إلها مفتاح. */
const CHECKLIST_KEYS = {
  trend: "radar.checklistTrend",
  bosConfirmed: "radar.bosConfirmation",
  mssConfirmed: "radar.mssConfirmation",
  liquidityHit: "radar.checklistLiquidityHit",
  priceLocationOk: "radar.fibValid",
  smtPresent: "radar.checklistSmt",
  obCreated: "radar.checklistObCreated",
  retest: "radar.checklistRetest",
  riskOk: "radar.checklistRiskOk",
  targetsCalculated: "radar.checklistTargets",
  priceInWCL: "radar.checklistPriceInWcl",
  newsClear: "radar.checklistNewsClear",
};

/* بيترجم قيمة سيشن خام جايه من lib/qais/session.js (مثلاً "London + New York"
   أو "Market Closed") لنفس أسماء الجلسات المترجمة أصلاً بالقاموس، بدل ما تضل
   إنجليزي دايماً جوا نص الإحاطة. */
function translateSessionLabel(label) {
  if (!label) return label;
  if (label === "Market Closed") return _t("radar.sessionOff");
  const map = {
    Sydney: _t("radar.sessionSydney"),
    Tokyo: _t("radar.sessionTokyo"),
    London: _t("radar.sessionLondon"),
    "New York": _t("radar.sessionNewYork"),
  };
  return label
    .split(" + ")
    .map((part) => map[part] || part)
    .join(" + ");
}

/* بيترجم "Premium Zone" / "Discount Zone" الخام الجايه من lib/qais/decision.js
   عبر نفس مفاتيح radar.dPremiumZone / radar.dDiscountZone الموجودة أصلاً. */
function translateZoneLabel(zone) {
  if (zone === "Premium Zone") return _t("radar.dPremiumZone").toLowerCase();
  if (zone === "Discount Zone") return _t("radar.dDiscountZone").toLowerCase();
  return zone;
}

function buildAiBriefing(item, d) {
  if (!d) return null;

  const symbol = item.symbol;
  const dir = d.direction; // 'up' | 'down' | null
  const dirKey = dir === "up" ? "radar.dBullish" : dir === "down" ? "radar.dBearish" : "radar.dNeutral";
  const dirLabel = _t(dirKey);
  const htfDirKey = d.htfTrend === "up" ? "radar.dBullish" : d.htfTrend === "down" ? "radar.dBearish" : null;
  const htfLabel = htfDirKey ? _t(htfDirKey) : null;
  const liq = d.liquidityStatus || "";
  const swept = liq.startsWith("Swept");
  const approaching = liq === "Approaching";
  const zone = d.premiumDiscount;
  const session = translateSessionLabel(d.sessionLabel) || _t("radar.rightNow");
  const bosOk = d.bosStatus === "Detected";
  const obReady = !!d.ob?.eligible && d.ob.status !== "Invalid";
  const obQuality = d.ob?.quality;
  const tradeValid = !!d.tradeValid;
  const targets = d.targets || [];
  const tp1 = targets[0];
  const tpLast = targets[targets.length - 1];
  // AI Briefing's "confidence" is the same AI Confidence number shown in the
  // Analysis Panel and Active Opportunities (radarScore) — not the legacy
  // quality-completeness score, so the briefing never contradicts the rest
  // of the page.
  const score = d.aiConfidence ?? d.radarScore ?? d.score ?? 0;

  /* ---------- 1) Current Market Situation ---------- */
  let situation;
  if (!dir) {
    situation = _t("radar.briefNoTrend", { symbol });
  } else {
    let s = _t("radar.briefSituationBase", { symbol, dir: dirLabel });
    if (swept) {
      s += liq.includes("Below") ? _t("radar.briefSweptBelow") : liq.includes("Above") ? _t("radar.briefSweptAbove") : _t("radar.briefSweptGeneric");
    } else if (approaching) {
      s += _t("radar.briefApproaching");
    }
    s += ".";
    if (htfLabel && htfLabel !== dirLabel) {
      s += _t("radar.briefHtfAgainst", { trend: htfLabel });
    } else if (htfLabel && htfLabel === dirLabel) {
      s += _t("radar.briefHtfAlign", { trend: htfLabel });
    }
    if (zone && zone !== "—") {
      const favors = (dir === "up" && zone === "Discount Zone") || (dir === "down" && zone === "Premium Zone");
      const zoneVars = { zone: translateZoneLabel(zone), session };
      s += favors ? _t("radar.briefZoneFavor", zoneVars) : _t("radar.briefZoneNeutral", zoneVars);
    }
    situation = s;
  }

  /* ---------- 2) What Are We Waiting For ---------- */
  const waitingFor = (d.reasonsChecklist || []).filter((c) => !c.ok).map((c) => (CHECKLIST_KEYS[c.key] ? _t(CHECKLIST_KEYS[c.key]) : c.label));

  /* ---------- 3) Bullish Scenario ---------- */
  let bullish;
  if (dir === "up" && tradeValid && tp1) {
    bullish =
      tpLast && tpLast !== tp1
        ? _t("radar.briefBullishInControlExtend", { price: fmt(tp1.price), price2: fmt(tpLast.price) })
        : _t("radar.briefBullishInControlSingle", { price: fmt(tp1.price) });
  } else if (dir === "up" && !tradeValid) {
    bullish = _t("radar.briefBullishConditional", { condition: waitingFor[0] ? waitingFor[0].toLowerCase() : _t("radar.briefRemainingChecklist") });
  } else {
    bullish = dir === "down" ? _t("radar.briefBullishNeedsReclaimBearish") : _t("radar.briefBullishNeedsReclaimPlain");
  }

  /* ---------- 4) Bearish Scenario ---------- */
  let bearish;
  if (dir === "down" && tradeValid && tp1) {
    bearish =
      tpLast && tpLast !== tp1
        ? _t("radar.briefBearishInControlExtend", { price: fmt(tp1.price), price2: fmt(tpLast.price) })
        : _t("radar.briefBearishInControlSingle", { price: fmt(tp1.price) });
  } else if (dir === "down" && !tradeValid) {
    bearish = _t("radar.briefBearishConditional", { condition: waitingFor[0] ? waitingFor[0].toLowerCase() : _t("radar.briefRemainingChecklist") });
  } else {
    bearish = _t("radar.briefBearishNeedsReject");
  }

  /* ---------- 5) AI Confidence ---------- */
  const confidenceLabel = score >= 80 ? _t("radar.levelHigh") : score >= 50 ? _t("radar.levelMedium") : _t("radar.levelLow");
  const confidenceReasons = [];
  confidenceReasons.push(dir ? _t("radar.briefTrendIs", { dir: dirLabel }) : _t("radar.noTrendYet"));
  confidenceReasons.push(swept ? _t("radar.liquiditySwept") : approaching ? _t("radar.liquidityNotSwept") : _t("radar.noSweepYet"));
  confidenceReasons.push(bosOk ? _t("radar.bosConfirmed") : _t("radar.bosNotConfirmed"));
  if (obReady) confidenceReasons.push(_t("radar.briefObQualityReason", { quality: obQuality }));
  confidenceReasons.push(tradeValid ? _t("radar.entryComplete") : _t("radar.entryIncomplete"));

  /* ---------- 6) Recommendation ---------- */
  let recommendation;
  if (tradeValid && dir === "up") recommendation = { text: _t("radar.buyValid"), tone: "buy" };
  else if (tradeValid && dir === "down") recommendation = { text: _t("radar.sellValid"), tone: "sell" };
  else if (!dir) recommendation = { text: _t("radar.briefRecRanging"), tone: "range" };
  else if (approaching) recommendation = { text: _t("radar.waitSweep"), tone: "wait" };
  else if (!bosOk) recommendation = { text: _t("radar.waitBos"), tone: "wait" };
  else recommendation = { text: _t("radar.briefRecDefaultWait"), tone: "wait" };

  /* ---------- 7) Risk Factors ---------- */
  const riskFactors = [];
  if (htfLabel && dir && htfLabel !== dirLabel) {
    riskFactors.push(_t("radar.briefRiskCounterTrend", { trend: htfLabel }));
  }
  if (obReady && obQuality != null && obQuality < 60) {
    riskFactors.push(_t("radar.briefRiskObQuality", { quality: obQuality }));
  }
  if (!swept && approaching) {
    riskFactors.push(_t("radar.briefRiskNoSweep"));
  }
  if (!bosOk) {
    riskFactors.push(_t("radar.briefRiskNoBos"));
  }
  if (zone && ((dir === "up" && zone === "Premium Zone") || (dir === "down" && zone === "Discount Zone"))) {
    riskFactors.push(_t("radar.briefRiskZone", { zone: translateZoneLabel(zone), dir: dirLabel }));
  }
  if (score < 50) {
    riskFactors.push(_t("radar.briefRiskLowConfidence"));
  }
  if (riskFactors.length === 0) {
    riskFactors.push(_t("radar.briefRiskNone"));
  }

  return {
    situation,
    waitingFor,
    bullish,
    bearish,
    riskFactors,
    confidence: { score, label: confidenceLabel, reasons: confidenceReasons },
    recommendation,
  };
}

const BRIEFING_TONE = {
  buy: { color: GREEN, bg: "rgba(2,192,118,0.08)" },
  sell: { color: RED, bg: "rgba(246,70,93,0.08)" },
  wait: { color: AMBER, bg: "rgba(245,158,11,0.08)" },
  range: { color: AMBER, bg: "rgba(245,158,11,0.08)" },
};

function BriefingCard({ icon: Icon, title, color, delay, confidence, children }) {
  const confColor = confidence == null ? "#6E6690" : confidence >= 80 ? GREEN : confidence >= 50 ? GOLD_LIGHT : AMBER;
  return (
    <div
      className="qmi-anim qmi-briefing-card"
      style={{
        animationDelay: `${delay}ms`,
        background: "#141024",
        border: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 0,
        padding: "13px 15px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 9 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {Icon && <Icon size={15} strokeWidth={1.75} color={color} aria-hidden />}
          <span style={{ fontSize: 11.5, fontWeight: 800, color, letterSpacing: 0.4, textTransform: "uppercase" }}>{title}</span>
        </div>
        {confidence != null && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: confColor,
              background: `${confColor}1f`,
              border: `1px solid ${confColor}40`,
              borderRadius: 20,
              padding: "2px 9px",
              flexShrink: 0,
            }}
          >
            {confidence}% conf.
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function AiBriefing({ item, d }) {
  const { t } = useLocale();
  const briefing = useMemo(() => buildAiBriefing(item, d), [item, d]);

  if (!briefing) {
    return (
      <div style={{ marginTop: 12, background: "#141024", border: `1px solid #2A2145`, borderRadius: 3, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Sparkles size={12} color={GOLD} />
          <span style={{ fontSize: 11, fontWeight: 800, color: GOLD_LIGHT, letterSpacing: 0.3 }}>{t("radar.aiSummary")}</span>
        </div>
        <div style={{ fontSize: 12, color: "#A79FC4", lineHeight: 1.8 }}>Waiting for the Qais SK Engine to complete the first analysis cycle for {item.symbol}.</div>
      </div>
    );
  }

  const tone = BRIEFING_TONE[briefing.recommendation.tone] || BRIEFING_TONE.wait;
  const RecIcon = briefing.recommendation.tone === "buy" ? TrendingUp : briefing.recommendation.tone === "sell" ? TrendingDown : CheckCircle2;

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <Sparkles size={13} color={GOLD} />
        <span style={{ fontSize: 12, fontWeight: 800, color: GOLD_LIGHT, letterSpacing: 0.5 }}>{t("radar.aiBriefing")}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* 1. Current Market Situation */}
        <BriefingCard icon={Brain} title={t("radar.currentSituation")} color={BLUE} delay={0} confidence={briefing.confidence.score}>
          <div style={{ fontSize: 12, color: "#F5F3FF", lineHeight: 1.8 }}>{briefing.situation}</div>
        </BriefingCard>

        {/* 2. What Are We Waiting For */}
        <BriefingCard icon={Eye} title="What Are We Waiting For" color={BLUE} delay={60} confidence={briefing.confidence.score}>
          {briefing.waitingFor.length === 0 ? (
            <div style={{ fontSize: 12, color: GREEN, lineHeight: 1.8, display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={13} color={GREEN} /> All entry confirmations are complete — nothing left to wait for.
            </div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
              {briefing.waitingFor.map((w, i) => (
                <li key={i} style={{ fontSize: 12, color: "#F5F3FF", lineHeight: 1.6 }}>
                  {w}
                </li>
              ))}
            </ul>
          )}
        </BriefingCard>

        {/* 3. Bullish Scenario */}
        <BriefingCard icon={TrendingUp} title={t("radar.bullishScenario")} color={GREEN} delay={120} confidence={briefing.confidence.score}>
          <div style={{ fontSize: 12, color: "#F5F3FF", lineHeight: 1.8 }}>{briefing.bullish}</div>
        </BriefingCard>

        {/* 4. Bearish Scenario */}
        <BriefingCard icon={TrendingDown} title={t("radar.bearishScenario")} color={RED} delay={180} confidence={briefing.confidence.score}>
          <div style={{ fontSize: 12, color: "#F5F3FF", lineHeight: 1.8 }}>{briefing.bearish}</div>
        </BriefingCard>

        {/* 5. Risk Factors */}
        <BriefingCard icon={AlertTriangle} title={t("radar.riskFactors")} color={AMBER} delay={240} confidence={briefing.confidence.score}>
          <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 5 }}>
            {briefing.riskFactors.map((r, i) => (
              <li key={i} style={{ fontSize: 12, color: "#F5F3FF", lineHeight: 1.7 }}>
                {r}
              </li>
            ))}
          </ul>
        </BriefingCard>

        {/* 6. AI Recommendation */}
        <BriefingCard icon={Target} title={t("radar.aiRecommendation")} color={tone.color} delay={300} confidence={briefing.confidence.score}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: tone.bg,
              border: `1px solid ${tone.color}44`,
              borderRadius: 3,
              padding: "9px 11px",
              marginBottom: 10,
            }}
          >
            <RecIcon size={15} color={tone.color} />
            <span style={{ fontSize: 12.5, fontWeight: 800, color: tone.color }}>{briefing.recommendation.text}</span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: GOLD_LIGHT }}>{briefing.confidence.score}%</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: BLUE }}>{briefing.confidence.label} confidence</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "#0E0A1A", overflow: "hidden", marginBottom: 8 }}>
            <div
              className="qmi-conf-bar"
              style={{ height: "100%", width: `${briefing.confidence.score}%`, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`, borderRadius: 3 }}
            />
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
            {briefing.confidence.reasons.map((r, i) => (
              <li key={i} style={{ fontSize: 11.5, color: "#aaa", lineHeight: 1.6 }}>
                {r}
              </li>
            ))}
          </ul>
        </BriefingCard>
      </div>
    </div>
  );
}

/* -------------------- Analysis Workspace: دائم، بيتحدث بس لما تتغير الأصل المختار -------------------- */
function AnalysisWorkspace({ item }) {
  const { t } = useLocale();
  if (!item) {
    return (
      <div className="qmi-anim" style={{ ...glass, padding: "1.1rem" }}>
        <SectionHeader icon={Brain} title={t("radar.analysisWorkspace")} subtitle={t("radar.clickAsset")} />
        <EmptyNote text={t("radar.noAssetSelected")} />
      </div>
    );
  }

  const d = item.decision;
  const dirLabel = item.direction === "up" ? "Bullish" : item.direction === "down" ? "Bearish" : "Neutral";
  const dirColor = item.direction === "up" ? GREEN : item.direction === "down" ? RED : "#6E6690";
  const htfLabel = d?.htfTrend === "up" ? "Bullish" : d?.htfTrend === "down" ? "Bearish" : "—";
  const htfColor = d?.htfTrend === "up" ? GREEN : d?.htfTrend === "down" ? RED : "#6E6690";
  const swept = !!d?.liquidityStatus?.startsWith?.("Swept");
  const liqTypeLabel = swept
    ? item.direction === "up"
      ? "Below Low — Sell-Side Liquidity Taken"
      : "Above High — Buy-Side Liquidity Taken"
    : d?.liquidityStatus || t("radar.notSweptYet");
  const obLabel = d?.ob?.eligible ? `${dirLabel} OB · ${d.ob.status} · Quality ${d.ob.quality}%` : t("radar.obInvalid");
  const lastTarget = d?.targets?.[d.targets.length - 1];
  const expectedMove = d?.entry != null && lastTarget ? `${fmt(d.entry)} → ${fmt(lastTarget.price)}` : "—";
  // Same AI Confidence / Quality Score / Entry Status fields the Analysis
  // Panel and Active Opportunities use — single source of truth.
  const confidence = d?.aiConfidence ?? d?.radarScore ?? 0;
  const qualityScore = d?.qualityScore ?? d?.score ?? 0;
  const entryStatus = d?.entryStatus || t("radar.monitoring");
  const structureLabel = d?.marketStructure || (d?.bosStatus === "Detected" ? t("radar.bos") : t("radar.ranging"));

  /* -------- Smart Explanations — كل قيمة بتفسّر حالها بجملة بسيطة، مبنية من
     نفس القيم المحسوبة فوق فقط (لا نص عشوائي، ولا رقم جديد) -------- */
  const explain = {
    trend:
      item.direction === "up"
        ? t("radar.higherLows")
        : item.direction === "down"
        ? t("radar.lowerHighs")
        : t("radar.noCommitment"),
    htf:
      d?.htfTrend == null
        ? t("radar.noHtfBias")
        : d.htfTrend === item.direction
        ? t("radar.htfAgrees")
        : "The bigger picture disagrees — this move is against the broader trend.",
    structure:
      d?.bosStatus === "Detected"
        ? "A new swing has broken the previous structure, confirming the current direction."
        : "Price hasn't broken a clear structural level yet — still building the next move.",
    liqType: swept
      ? item.direction === "up"
        ? t("radar.sellSideTaken")
        : t("radar.buySideTaken")
      : "This liquidity pool hasn't been taken yet — price may still reach for it first.",
    ob: d?.ob?.eligible
      ? "Institutional supply/demand zone — price could react strongly if it retests this area."
      : t("radar.obNone"),
    fvg: d?.fvgStatus === "Present" ? t("radar.fvgRevisit") : t("radar.fvgNone"),
  };

  return (
    <div key={item.symbol} className="qmi-anim" style={{ ...glass, padding: "1.1rem" }}>
      <SectionHeader icon={Brain} title={t("radar.analysisWorkspace")} subtitle={`Full breakdown for ${item.symbol} — always visible, refreshes automatically when you pick another asset above.`} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginTop: 14 }}>
        <WorkspaceStat label={t("radar.liquidityStatus")} value={d?.liquidityStatus || "—"} explain={explain.liqType} />
        <WorkspaceStat label={t("radar.marketStructure")} value={structureLabel} explain={explain.structure} />
        <WorkspaceStat label={t("radar.trend")} value={dirLabel} color={dirColor} explain={explain.trend} />
        <WorkspaceStat label={t("radar.htfTrend")} value={htfLabel} color={htfColor} explain={explain.htf} />
        <WorkspaceStat label={t("radar.liquidityType")} value={liqTypeLabel} color={swept ? (item.direction === "up" ? GREEN : RED) : "#6E6690"} explain={explain.liqType} />
        <WorkspaceStat label={t("radar.orderBlock")} value={obLabel} color={d?.ob?.eligible ? GOLD_LIGHT : "#6E6690"} explain={explain.ob} />
        <WorkspaceStat label={t("radar.fvg")} value={d?.fvgStatus || "—"} color={d?.fvgStatus === "Present" ? BLUE : "#6E6690"} explain={explain.fvg} />
        <WorkspaceStat label={t("radar.expectedMove")} value={expectedMove} color={GOLD_LIGHT} />
        <WorkspaceStat label={t("radar.entryZone")} value={fmt(d?.entry)} color={GOLD_LIGHT} />
        <WorkspaceStat label={t("radar.stopLoss")} value={fmt(d?.stopLoss)} color={RED} />
        <WorkspaceStat label={t("radar.takeProfit")} value={lastTarget ? fmt(lastTarget.price) : "—"} color={GREEN} />
        <WorkspaceStat label={t("radar.entryStatus")} value={entryStatus} color={entryStatus === "Ready" ? GREEN : GOLD_LIGHT} />
        <WorkspaceStat label={t("radar.qualityScore")} value={`${qualityScore}%`} color={qualityScore >= 85 ? GREEN : GOLD_LIGHT} explain={t("radar.qualityDesc")} />
        <WorkspaceStat label={t("radar.aiConfidence")} value={`${confidence}%`} color={confidence >= 85 ? GREEN : GOLD_LIGHT} explain={t("radar.confidenceDesc")} />
      </div>

      <AiBriefing item={item} d={d} />
    </div>
  );
}

function WorkspaceStat({ label, value, color, explain }) {
  return (
    <div className="qmi-wstat" style={{ background: "#141024", borderRadius: 3, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: "#6E6690", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: color || "#F5F3FF", lineHeight: 1.4 }}>{value}</div>
      {explain && <div style={{ fontSize: 10.5, color: "#6E6690", lineHeight: 1.55, marginTop: 4 }}>{explain}</div>}
    </div>
  );
}

/* -------------------- كرت شرح مفهوم واحد (تعليمي، بدون بيانات حيّة) -------------------- */
function ConceptCard({ icon: Icon, title, lines, color }) {
  return (
    <div className="qmi-concept-card" style={{ background: "#141024", border: `1px solid ${color}33`, borderRadius: 0, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
        {Icon && <Icon size={15} strokeWidth={1.75} color={color} aria-hidden />}
        <span style={{ fontSize: 12, fontWeight: 800, color: color || "#F5F3FF" }}>{title}</span>
      </div>
      {lines.map((l, i) => (
        <div key={i} style={{ fontSize: 11, color: "#A79FC4", lineHeight: 1.6 }}>
          {l}
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
      {Icon && <Icon size={18} strokeWidth={1.75} color={GOLD_LIGHT} style={{ marginTop: 1, flexShrink: 0 }} aria-hidden />}
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: "#F5F3FF" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: "#6E6690", marginTop: 2, lineHeight: 1.6 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

/* ============================================================================
   Market Summary
   ============================================================================ */
function MarketSummaryCard({ snapshot, radarItems, newsToday }) {
  const { t } = useLocale();
  const currencies = snapshot?.currencies || {};
  const entries = Object.entries(currencies).filter(([, v]) => v != null);
  const strongest = entries.length ? entries.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
  const weakest = entries.length ? entries.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;

  const active = radarItems.filter((i) => i.status === "green" || i.status === "orange");
  const bullish = active.filter((i) => i.direction === "up").length;
  const bearish = active.filter((i) => i.direction === "down").length;
  const total = bullish + bearish;
  const biasLabel = total === 0 ? "—" : bullish >= bearish ? "Bullish" : "Bearish";
  const biasPct = total === 0 ? 0 : Math.round((Math.max(bullish, bearish) / total) * 100);
  const biasColor = biasLabel === "Bullish" ? GREEN : biasLabel === "Bearish" ? RED : "#6E6690";

  return (
    <CardShell title={t("radar.marketSummary")} icon={BarChart3}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        <SummaryStat label={t("radar.overallBias")} value={biasLabel} sub={total ? `${biasPct}% confidence` : t("radar.notEnoughDataShort")} color={biasColor} />
        <SummaryStat label={t("radar.strongestCurrency")} value={strongest ? strongest[0] : "—"} sub={strongest ? `${strongest[1]}` : ""} color={GREEN} />
        <SummaryStat label={t("radar.weakestCurrency")} value={weakest ? weakest[0] : "—"} sub={weakest ? `${weakest[1]}` : ""} color={RED} />
        <SummaryStat label={t("radar.activeOpportunities")} value={active.length} sub={t("radar.liveFromRadar")} color={GOLD_LIGHT} />
        <SummaryStat label={t("radar.highImpactNews")} value={newsToday.high} sub={t("radar.today")} color={AMBER} />
      </div>
    </CardShell>
  );
}

function SummaryStat({ label, value, sub, color }) {
  return (
    <div style={{ background: "#141024", borderRadius: 3, padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, color: "#6E6690" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || "#F5F3FF" }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, color: "#6E6690", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

/* ============================================================================
   Live Notifications
   ============================================================================ */
function LiveNotificationsCard({ items, onOpen }) {
  const { t } = useLocale();
  const notifs = useMemo(
    () =>
      [...items]
        .filter((i) => i.entry_status === "Ready" && i.updated_at)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 5),
    [items]
  );

  return (
    <CardShell title={t("radar.liveNotifications")} icon={Bell}>
      {notifs.length === 0 ? (
        <EmptyNote text={t("radar.noNewNotifications")} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifs.map((it) => (
            <button
              key={it.symbol}
              onClick={() => onOpen(it.symbol)}
              style={{ display: "flex", alignItems: "center", gap: 9, background: "#141024", border: "none", borderRadius: 3, padding: "8px 10px", cursor: "pointer", textAlign: "right" }}
            >
              <Bell size={13} color={GOLD} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11.5, color: "#F5F3FF", fontWeight: 700 }}>
                  New Opportunity — {it.symbol} <span style={{ color: it.direction === "up" ? GREEN : RED }}>{it.direction === "up" ? "BUY" : "SELL"}</span>
                </div>
                <div style={{ fontSize: 10, color: "#6E6690" }}>{it.radar_score ?? it.score}% Confidence · {relTime(it.updated_at, t)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </CardShell>
  );
}

/* ============================================================================
   عناصر مشتركة
   ============================================================================ */
export function CardShell({ title, icon: Icon, children }) {
  return (
    <div style={{ ...glass, padding: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        {Icon && <Icon size={15} strokeWidth={1.75} color={GOLD_LIGHT} aria-hidden />}
        <span style={{ fontSize: 12.5, fontWeight: 800, color: "#F5F3FF" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function EmptyNote({ text }) {
  return <div style={{ fontSize: 11.5, color: "#6E6690", padding: "1rem 0", textAlign: "center" }}>{text}</div>;
}
