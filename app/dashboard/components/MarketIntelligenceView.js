"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import { Sparkles, RotateCcw, ChevronDown, ChevronRight, Zap, Bell, Radio } from "lucide-react";
import { ASSETS, getAssetByValue } from "@/lib/assets";
import { analyzeSymbol, getCorrelatedSymbol } from "@/lib/qais/engine";
import { createClient } from "@/lib/supabase-client";

/* ============================================================================
   MarketIntelligenceView — "Qais Market Intelligence" — لوحة القيادة الرئيسية
   يشتغل عليها QAIS SK Engine (lib/qais/engine.js) بشكل مباشر وحي، وهي المصدر
   الوحيد اللي بيحسب كل شي هون: الشارت + لوحة التحليل + الأربع كروت تحت +
   ملخص السوق + الإشعارات. لا أرقام وهمية — كل قيمة إما محسوبة لحظياً من
   analyzeSymbol()، أو جايه من /api/radar (نفس المحرك، محفوظ بالكرون)، أو من
   /api/market-intelligence (Yahoo Finance فعلي).
   ============================================================================ */

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2D57E";
const GREEN = "#02C076";
const RED = "#F6465D";
const BLUE = "#4f7cff";
const AMBER = "#f59e0b";
const NEUTRAL = "#c9c9c9";
const CHART_H = 600;
const ANIM_MS = 450;

const glass = {
  background: "linear-gradient(145deg, rgba(34,37,43,0.9), rgba(20,22,26,0.92))",
  border: `1px solid ${GOLD}22`,
  borderRadius: 16,
  boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
  backdropFilter: "blur(10px)",
};

const TF_LABELS = { m5: "M5", m15: "M15", h1: "H1", h4: "H4", daily: "D1" };
const TF_TOOLBAR_ORDER = ["m5", "m15", "h1", "h4", "daily"];
const YAHOO_OVERRIDE = { XAUEUR: "XAUEUR=X" };

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
  { key: "sydney", label: "Sydney", short: "SYD", start: 21, end: 6, color: "#9b6cf0" },
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
  sydney: { liquidity: "Low", volatility: "Low", behaviour: "Quiet, narrow ranges", recommendation: "Avoid new trend trades — wait for Tokyo/London to build direction." },
  tokyo: { liquidity: "Medium", volatility: "Medium", behaviour: "Asia range building", recommendation: "Trade the range and fade extremes; save breakouts for London." },
  london: { liquidity: "Very High", volatility: "High", behaviour: "Trend Expansion", recommendation: "Trade pullbacks with the trend." },
  newyork: { liquidity: "High", volatility: "High", behaviour: "News-driven continuation or reversal", recommendation: "Watch US news releases; follow or fade the London trend with confirmation." },
  off: { liquidity: "Very Low", volatility: "Very Low", behaviour: "Thin, illiquid, wider spreads", recommendation: "Avoid opening new trades — wait for a major session to open." },
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
  return "Off-Hours";
}

/* فرق الوقت (بالساعات) من now لغاية target، بيلف لليوم التالي لو الفرق سالب */
function hoursUntil(target, now) {
  let diff = target - now;
  if (diff <= 0) diff += 24;
  return diff;
}

function hoursLabel(h) {
  const totalMin = Math.max(0, Math.round(h * 60));
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh <= 0) return `${mm} د`;
  if (mm === 0) return `${hh} س`;
  return `${hh} س ${mm} د`;
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

function relTime(iso) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "الآن";
  if (min < 60) return `منذ ${min} د`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `منذ ${hr} س`;
  return `منذ ${Math.round(hr / 24)} يوم`;
}

export default function MarketIntelligenceView({ initialSymbol, embedded = false, onClose } = {}) {
  const [symbol, setSymbol] = useState(initialSymbol || "XAUUSD");
  const [displayTF, setDisplayTF] = useState("h1");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [allCandles, setAllCandles] = useState({});
  const [tab, setTab] = useState("analysis"); // analysis | why

  const [snapshot, setSnapshot] = useState(null);
  const [radarItems, setRadarItems] = useState([]);
  const [newsToday, setNewsToday] = useState({ high: 0 });
  const [sessions, setSessions] = useState(getSessionsStatus());
  const [selectedLiqSymbol, setSelectedLiqSymbol] = useState(null);

  const wrapRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLinesRef = useRef([]);
  const resultRef = useRef(null);
  const displayTFRef = useRef(displayTF);
  const candlesRef = useRef({});
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
    const t = setInterval(() => setSessions(getSessionsStatus()), 60000);
    return () => clearInterval(t);
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
        throw new Error("بيانات غير كافية من مزوّد الأسعار لهذا الرمز حالياً");
      }

      let correlated = null;
      const corrSymbol = getCorrelatedSymbol(symbol);
      if (corrSymbol) {
        const corrYahoo = getAssetByValue(corrSymbol)?.yahoo || YAHOO_OVERRIDE[corrSymbol];
        if (corrYahoo) {
          const corrH1 = await fetchCandles(corrYahoo, "1h", 300);
          if (corrH1?.length >= 30) correlated = { symbol: corrSymbol, candlesByTF: { h1: corrH1 } };
        }
      }

      const analysis = analyzeSymbol({ symbol, candlesByTF, correlated });
      if (analysis.error) throw new Error(analysis.error);

      setAllCandles(candlesByTF);
      setResult(analysis);
      resultRef.current = analysis;
      animStartRef.current = performance.now();
      setDisplayTF(analysis.sequence?.displayTF || analysis.executionTimeframe || analysis.mainTimeframe || "h1");
    } catch (e) {
      setError(e.message || "فشل تشغيل محرك التحليل");
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

  /* ===================== بيانات الكروت السفلية — Heat Map / Radar / News ===================== */
  const loadSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/market-intelligence?type=snapshot");
      const data = await res.json();
      if (!data.error) setSnapshot(data);
    } catch {}
  }, []);

  const loadRadar = useCallback(async () => {
    try {
      const res = await fetch("/api/radar");
      const data = await res.json();
      if (data.items) setRadarItems(data.items);
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
    loadNews();
    const t1 = setInterval(loadSnapshot, 120000);
    const t2 = setInterval(loadRadar, 60000);
    const t3 = setInterval(loadNews, 300000);
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); };
  }, [loadSnapshot, loadRadar, loadNews]);

  /* ===================== إنشاء الشارت مرة وحدة ===================== */
  useEffect(() => {
    let cancelled = false;
    async function setup() {
      const { createChart, CrosshairMode, LineStyle } = await import("lightweight-charts");
      if (cancelled || !containerRef.current) return;

      const chart = createChart(containerRef.current, {
        layout: { background: { color: "transparent" }, textColor: "#d1d4dc" },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.04)" },
          horzLines: { color: "rgba(255,255,255,0.04)" },
        },
        timeScale: { borderColor: "#3a3a3a", timeVisible: true, secondsVisible: false, rightOffset: 16 },
        rightPriceScale: { borderColor: "#3a3a3a" },
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
    const candles = candlesRef.current[displayTFRef.current];
    if (!candles || !candles.length) return;

    const ts = chart.timeScale();
    const priceToY = (p) => series.priceToCoordinate(p);
    const timeToX = (t) => ts.timeToCoordinate(t);

    const elapsed = performance.now() - animStartRef.current;
    const progress = Math.max(0, Math.min(1, elapsed / ANIM_MS));
    const ease = easeOutCubic(progress);

    const lastCandle = candles[candles.length - 1];
    const lastX = timeToX(lastCandle.time);
    if (lastX == null) return;

    const seq = r.sequence;
    if (seq?.points && seq.displayTF && seq.displayTF === displayTFRef.current) {
      drawSequenceHistory(ctx, seq, timeToX, priceToY, lastX, ease);
      // أهداف السيكونز (TP1..TP4) — تترسم تلقائياً فور تأكيد C، بغض النظر عن
      // اكتمال شروط الصفقة الكاملة (Entry/SL) — هاي أهداف الـ QAIS SK Engine
      // الرسمية المسقطة من C مباشرة (تاسع عشر)
      if (seq.stage === "confirmed" && seq.targets?.length) {
        drawSequenceProjection(ctx, seq, timeToX, priceToY, w, h, ease);
      }
    }
    drawProjection(ctx, r, priceToY, lastX, w, h, ease);
  }

  useLayoutEffect(() => {
    if (!seriesRef.current) return;
    const candles = allCandles[displayTF];
    if (!candles || candles.length === 0) return;
    seriesRef.current.setData(candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
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
      if (lo != null) add(lo, `${GOLD}66`, `POI ${poi.type}`);
      if (hi != null && hi !== lo) add(hi, `${GOLD}66`, `POI ${poi.type}`);
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
    scheduleDraw();
  }

  function openOpportunity(sym) {
    setSymbol(sym);
    chartCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const primarySession = useMemo(() => getPrimarySession(sessions), [sessions]);
  const signal = result ? (result.tradeValid ? (result.direction === "up" ? "BUY" : "SELL") : "WAIT") : null;
  const biasLabel = result?.direction === "up" ? "Bullish" : result?.direction === "down" ? "Bearish" : "—";
  const biasColor = result?.direction === "up" ? GREEN : result?.direction === "down" ? RED : "#888";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <style>{`
        @keyframes qmiFadeIn { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); } }
        .qmi-anim { animation: qmiFadeIn 0.4s ease both; }
        @keyframes qmiPulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        .qmi-dot { animation: qmiPulse 1.8s ease-in-out infinite; }
        .qmi-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .qmi-scroll::-webkit-scrollbar-thumb { background: ${GOLD}33; border-radius: 6px; }
        .qmi-concept-card { transition: transform .2s ease, border-color .2s ease, background .2s ease; }
        .qmi-concept-card:hover { transform: translateY(-2px); background: #181a1f; }
      `}</style>

      {/* ================= HEADER ================= */}
      <div className="qmi-anim" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>👑</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#f5f5f5" }}>Qais Market Intelligence — Full Analysis</div>
          <div style={{ fontSize: 11.5, color: "#888" }}>Powered by QAIS SK Engine</div>
        </div>
        {embedded && onClose && (
          <button
            onClick={onClose}
            style={{
              background: "#14161a",
              border: `1px solid ${GOLD}40`,
              color: "#ccc",
              borderRadius: 10,
              width: 34,
              height: 34,
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
            }}
            title="Close"
          >
            ✕
          </button>
        )}
      </div>

      {/* ================= TOP TOOLBAR ================= */}
      <div className="qmi-anim" style={{ ...glass, padding: "0.75rem 1.1rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          style={{ background: "#14161a", color: "#f0f0f0", border: `1px solid ${GOLD}40`, borderRadius: 8, fontSize: 13, padding: "7px 10px", fontWeight: 700, minWidth: 150 }}
        >
          {ASSETS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.items.filter((i) => i.yahoo).map((i) => (
                <option key={i.v} value={i.v}>{i.label}</option>
              ))}
            </optgroup>
          ))}
        </select>

        <div style={{ width: 1, height: 22, background: "#2a2a2a" }} />

        <div style={{ display: "flex", gap: 4 }}>
          {TF_TOOLBAR_ORDER.filter((tf) => allCandles[tf]?.length).map((tf) => (
            <button
              key={tf}
              onClick={() => setDisplayTF(tf)}
              style={{
                background: displayTF === tf ? `${GOLD}1f` : "transparent",
                border: `1px solid ${displayTF === tf ? GOLD : "#2e2e2e"}`,
                color: displayTF === tf ? GOLD_LIGHT : "#888",
                borderRadius: 6, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer",
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
            border: "none", color: "#181A20", fontWeight: 800, borderRadius: 8, padding: "8px 16px", fontSize: 12.5, cursor: "pointer",
          }}
        >
          <Zap size={13} fill="#181A20" />
          {loading ? "جارٍ التحليل..." : "AI Analyze"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0f3d2c", border: `1px solid ${GREEN}40`, borderRadius: 20, padding: "6px 12px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN }} className="qmi-dot" />
          <span style={{ fontSize: 11.5, color: "#aaa" }}>Confidence</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: GREEN }}>{result?.score ?? 0}%</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#14161a", border: "1px solid #2e2e2e", borderRadius: 20, padding: "6px 12px" }}>
          <Radio size={12} color={BLUE} />
          <span style={{ fontSize: 12, color: "#ccc" }}>Session: <b style={{ color: "#f0f0f0" }}>{primarySession}</b></span>
        </div>

        <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 6, background: "#14161a", border: `1px solid ${biasColor}40`, borderRadius: 20, padding: "6px 12px" }}>
          <span style={{ fontSize: 12, color: "#ccc" }}>Market Bias:</span>
          <b style={{ fontSize: 12.5, color: biasColor }}>{biasLabel}</b>
        </div>
      </div>

      {error && <div style={{ ...glass, padding: "0.7rem 1rem", color: RED, fontSize: 12.5 }}>{error}</div>}

      {/* ================= MAIN: CHART (≈70%) + AI PANEL (≈30%) ================= */}
      <div className="qmi-anim" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: "1rem", alignItems: "start" }}>
        <div ref={chartCardRef} style={{ ...glass, padding: "0.6rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.3rem 0.5rem 0.6rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#f0f0f0" }}>{asset?.label || symbol}</span>
              {result?.price != null && <span style={{ fontSize: 12.5, color: "#999" }}>{fmt(result.price)}</span>}
            </div>
            <button
              onClick={resetChart}
              title="إعادة تعيين الشارت"
              style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid #2e2e2e", color: "#aaa", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
            >
              <RotateCcw size={11} />
              إعادة تعيين
            </button>
          </div>
          <div ref={wrapRef} style={{ position: "relative", width: "100%", height: CHART_H }}>
            <div ref={containerRef} style={{ width: "100%", height: CHART_H }} />
            <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
          </div>
        </div>

        <AIPanel result={result} signal={signal} tab={tab} setTab={setTab} primarySession={primarySession} />
      </div>

      {/* ================= THREE PREMIUM CARDS ================= */}
      <div className="qmi-anim" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(240px, 1fr))", gap: "1rem" }}>
        <CurrencyHeatMapCard snapshot={snapshot} />
        <SessionMapCard sessions={sessions} />
        <LiveOpportunitiesCard items={radarItems} onOpen={openOpportunity} />
      </div>

      {/* ================= LIQUIDITY MAP + PERMANENT ANALYSIS WORKSPACE ================= */}
      <LiquidityMapSection items={radarItems} selectedSymbol={selectedLiqSymbol} onSelect={setSelectedLiqSymbol} />

      {/* ================= MARKET SUMMARY + NOTIFICATIONS ================= */}
      <div className="qmi-anim" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "1rem", alignItems: "start" }}>
        <MarketSummaryCard snapshot={snapshot} radarItems={radarItems} newsToday={newsToday} />
        <LiveNotificationsCard items={radarItems} onOpen={openOpportunity} />
      </div>
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
function drawSequenceHistory(ctx, seq, timeToX, priceToY, lastX, ease) {
  const { points, stage } = seq;
  const pts = [
    ["0", points.origin],
    ["A", points.A],
    ["B", points.B],
    ...(points.C ? [["C", points.C]] : []),
  ]
    .map(([label, p]) => (p ? { label, x: timeToX(p.time), y: priceToY(p.price) } : null))
    .filter((p) => p && p.x != null && p.y != null);

  if (pts.length < 3) return;

  ctx.save();
  ctx.globalAlpha = ease;

  // الخط الواصل 0→A→B→(C)
  ctx.strokeStyle = stage === "confirmed" ? `${GOLD}b0` : `${GOLD}60`;
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
    ctx.fillStyle = "#181A20";
    ctx.fill();
    ctx.lineWidth = isC && isAnchor ? 1.8 : 1.4;
    ctx.strokeStyle = isC ? GREEN : GOLD_LIGHT;
    ctx.stroke();
    drawPill(ctx, p.x, p.y + dy, isC && isAnchor ? "(C) Anchor" : `(${p.label})`, isC ? GREEN : GOLD_LIGHT, "700 10.5px sans-serif");
  });

  // طالما C لسا ما تأكدت: ملاحظة صغيرة توضح إنه السيكونز قيد التكوين
  if (stage === "awaiting-c") {
    const last = pts[pts.length - 1];
    drawPill(ctx, last.x + 46, last.y, "بانتظار تأكيد C", `${GOLD_LIGHT}`, "600 9.5px sans-serif", "left");
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
  const boxX = align === "left" ? x : x - boxW / 2;
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

  // Decluttering: نفس منطق مسقط الصفقة — نفصل موقع الليبل عن السعر الحقيقي
  // عشان الأهداف المتقاربة (TP2/TP3 مثلاً) ما تتراكب ليبلاتها فوق بعض
  const sorted = [...rows].sort((a, b) => a.y - b.y);
  const rowGap = 34;
  let prevLabelY = -Infinity;
  sorted.forEach((row) => {
    row.labelY = Math.max(row.y, prevLabelY + rowGap);
    prevLabelY = row.labelY;
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
    { y: slY, color: RED, dash: [2, 3], lines: [`SL · ${r.slSource === "SMT" ? "SMT" : "OB Invalidation"}`, fmt(r.stopLoss), `Risk ${riskPct.toFixed(2)}%`] },
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
  const rowGap = 38;
  let prevLabelY = -Infinity;
  sorted.forEach((row) => {
    row.labelY = Math.max(row.y, prevLabelY + rowGap);
    prevLabelY = row.labelY;
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
    ctx.strokeStyle = `${GOLD}35`;
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
  ctx.fillStyle = "#ccc";
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
   لوحة تحليل QAIS SK Engine — يمين الشارت (٣٠٪) — كل قيمة من analyzeSymbol()
   ============================================================================ */
function AIPanel({ result: r, signal, tab, setTab, primarySession }) {
  const STATUS_COLOR = { green: GREEN, orange: AMBER, yellow: "#eab308", red: RED, gray: "#888" };
  const scoreColor = STATUS_COLOR[r?.status] || "#888";
  const score = r?.score ?? 0;
  const signalColor = signal === "BUY" ? GREEN : signal === "SELL" ? RED : "#888";

  const htfTrend = r?.context?.weekly?.trend || r?.structureLadder?.[0]?.trend || r?.direction;
  const marketStructure = r?.direction === "up" ? "HH / HL" : r?.direction === "down" ? "LH / LL" : "—";
  const bosOk = !!r?.structureLadder?.find((s) => s.isMain)?.hasBOS;
  const chochOk = !!r?.structureLadder?.find((s) => s.isMain)?.hasMSS;
  const poi = r?.poi?.touchedZone;
  const liquidityLabel = poi ? (r.direction === "up" ? `Swept (Below)` : `Swept (Above)`) : "No POI Yet";
  const premiumDiscount = r?.priceLocation ? (r.priceLocation.zone === "discount" ? "Discount" : r.priceLocation.zone === "premium" ? "Premium" : "Equilibrium") : "—";
  const volume = r?.ob?.merged ? "High" : r?.ob?.eligible ? "Medium" : "Low";
  const entryStatus = r?.tradeValid ? "Ready" : r?.ob?.eligible ? "Forming" : "Waiting";
  const signalStrength = score >= 85 ? "Very Strong" : score >= 70 ? "Strong" : score >= 50 ? "Moderate" : "Weak";
  const lastTarget = r?.targets?.[r.targets.length - 1];
  const rr = lastTarget && r?.entry != null && r?.stopLoss != null
    ? Math.abs(lastTarget.price - r.entry) / Math.abs(r.entry - r.stopLoss)
    : null;

  const rows = [
    ["Trend", r?.direction === "up" ? "Bullish" : r?.direction === "down" ? "Bearish" : "—", "Liquidity", liquidityLabel],
    ["HTF Trend", htfTrend === "up" ? "Bullish" : htfTrend === "down" ? "Bearish" : "—", "Premium/Discount", premiumDiscount],
    ["Market Structure", marketStructure, "Session", primarySession],
    ["BOS", bosOk ? "Confirmed" : "Pending", "Volume", volume],
    ["CHOCH", chochOk ? "Confirmed" : "Pending", "Risk Reward", rr ? `1 : ${rr.toFixed(1)}` : "—"],
    ["Order Block", r?.ob?.eligible ? `${r.ob.status} ${r.direction === "up" ? "Bullish" : "Bearish"} OB` : "Not Formed", "Entry Status", entryStatus],
    ["Fair Value Gap", r?.ob?.fvgExists ? "Open" : "None", "Signal Strength", signalStrength],
  ];

  return (
    <div style={{ ...glass, padding: "1rem", display: "flex", flexDirection: "column", gap: 12, maxHeight: CHART_H + 56, overflowY: "auto" }} className="qmi-scroll">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Sparkles size={14} color={GOLD} />
        <span style={{ fontSize: 12.5, fontWeight: 800, color: "#f0f0f0", letterSpacing: 0.3 }}>QAIS SK ENGINE ANALYSIS</span>
      </div>

      {!r ? (
        <div style={{ color: "#777", fontSize: 12.5, padding: "1rem 0", textAlign: "center" }}>جاري تحميل التحليل...</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#f0f0f0" }}>{r.symbol}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{fmt(r.price)}</div>
            </div>
            {signal && (
              <span style={{ background: `${signalColor}22`, border: `1px solid ${signalColor}`, color: signalColor, fontWeight: 800, fontSize: 13, borderRadius: 8, padding: "6px 14px" }}>
                {signal}
              </span>
            )}
            <div
              style={{
                width: 58, height: 58, borderRadius: "50%", flexShrink: 0,
                background: `conic-gradient(${scoreColor} ${score * 3.6}deg, #23262d 0deg)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#181A20", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#f0f0f0" }}>{score}%</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 4, background: "#14161a", borderRadius: 8, padding: 3 }}>
            <button
              onClick={() => setTab("analysis")}
              style={{ flex: 1, background: tab === "analysis" ? `${GOLD}1f` : "transparent", color: tab === "analysis" ? GOLD_LIGHT : "#888", border: "none", borderRadius: 6, padding: "6px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Analysis
            </button>
            <button
              onClick={() => setTab("why")}
              style={{ flex: 1, background: tab === "why" ? `${GOLD}1f` : "transparent", color: tab === "why" ? GOLD_LIGHT : "#888", border: "none", borderRadius: 6, padding: "6px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Why This Trade?
            </button>
          </div>

          {tab === "analysis" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {rows.map(([l1, v1, l2, v2], i) => (
                <div key={i} style={{ display: "flex", borderTop: i === 0 ? "none" : "1px solid #20232a", padding: "7px 0" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10.5, color: "#777" }}>{l1}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#e5e5e5" }}>{v1}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10.5, color: "#777" }}>{l2}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#e5e5e5" }}>{v2}</div>
                  </div>
                </div>
              ))}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                <MiniStat label="Entry Zone" value={fmt(r.entry)} color={GOLD_LIGHT} />
                <MiniStat label="Stop Loss" value={fmt(r.stopLoss)} color={RED} />
                <MiniStat label="Take Profit" value={lastTarget ? fmt(lastTarget.price) : "—"} color={GREEN} />
                <MiniStat label="RR Ratio" value={rr ? `1 : ${rr.toFixed(1)}` : "—"} color={BLUE} />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {r.reasonTags?.length > 0 && (
                <div style={{ fontSize: 12, color: "#ccc", lineHeight: 1.7 }}>
                  الإشارة مبنية على: <b style={{ color: GOLD_LIGHT }}>{r.reasonTags.join(" + ")}</b>
                </div>
              )}
              {(r.reasonsChecklist || []).map((c) => (
                <div key={c.key} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: c.ok ? "#ddd" : "#666" }}>
                  <span style={{ color: c.ok ? GREEN : "#555" }}>{c.ok ? "✓" : "○"}</span>
                  <span>{c.label}</span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: "#777", marginTop: 6, lineHeight: 1.7 }}>
                QAIS Score: {score}/100 — {r.tradeValid ? "كل شروط الدخول اكتملت (Trend → BOS → POI → OB → Targets)." : "لسا في شرط أو أكثر ما تحقق ضمن تسلسل الفحص."}
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
    <div style={{ background: "#14161a", borderRadius: 8, padding: "7px 9px" }}>
      <div style={{ fontSize: 10, color: "#777" }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: color || "#f0f0f0" }}>{value}</div>
    </div>
  );
}

/* ============================================================================
   كرت 1: Currency Heat Map — من /api/market-intelligence?type=snapshot
   ============================================================================ */
export function CurrencyHeatMapCard({ snapshot }) {
  const currencies = snapshot?.currencies || {};
  const entries = Object.entries(currencies).filter(([, v]) => v != null);

  function meta(v) {
    if (v >= 65) return { label: "Strong", color: GREEN };
    if (v <= 40) return { label: "Weak", color: RED };
    return { label: "Neutral", color: "#888" };
  }

  return (
    <CardShell title="Currency Heat Map" icon="🔥">
      {entries.length === 0 ? (
        <EmptyNote text="جاري تحميل قوة العملات..." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {entries.map(([ccy, v]) => {
            const m = meta(v);
            return (
              <div key={ccy} style={{ background: "#14161a", border: `1px solid ${m.color}33`, borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ fontSize: 11, color: "#888" }}>{ccy}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{v}</div>
                <div style={{ fontSize: 10, color: m.color }}>{m.label}</div>
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
export function SessionMapCard({ sessions }) {
  const { next } = useMemo(() => getSessionTimeline(sessions), [sessions]);
  const overlap = useMemo(() => getActiveOverlap(sessions), [sessions]);
  const activeSessions = sessions.filter((s) => s.active);

  const currentLabel = overlap ? `${overlap.label} Overlap` : activeSessions[0]?.label || "Off-Hours";
  const info = overlap
    ? { liquidity: overlap.liquidity, volatility: "Very High", behaviour: "Trend Expansion / Breakouts", recommendation: "The busiest window of the day — best conditions for breakout and trend-continuation trades." }
    : SESSION_INFO[activeSessions[0]?.key] || SESSION_INFO.off;

  return (
    <CardShell title="Session Map" icon="🕐">
      <div style={{ fontSize: 10.5, color: "#777", marginBottom: 10, lineHeight: 1.6 }}>
        A live 24-hour view of the four major FX sessions. The white line is right now — watch for the gold-striped zone, that's when two sessions overlap and liquidity is highest.
      </div>

      <SessionTimelineVisual sessions={sessions} overlap={overlap} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0 12px" }}>
        {sessions.map((s) => (
          <div
            key={s.key}
            title={`${s.label} · ${String(s.start).padStart(2, "0")}:00–${String(s.end).padStart(2, "0")}:00 UTC`}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "#14161a", border: `1px solid ${s.active ? s.color : "#2a2a2a"}88`, borderRadius: 20, padding: "3px 9px" }}
          >
            <span className={s.active ? "qmi-dot" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: s.active ? s.color : "#555" }} />
            <span style={{ fontSize: 10, color: s.active ? "#f0f0f0" : "#777", fontWeight: s.active ? 800 : 600 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* -------- كروت الشرح: الجلسة الحالية / مستوى السيولة / التقلب / السلوك / أسلوب التداول المقترح -------- */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <MiniStat label="Current Session" value={currentLabel} color={GOLD_LIGHT} />
        <MiniStat label="Liquidity Level" value={info.liquidity} color={GREEN} />
        <MiniStat label="Expected Volatility" value={info.volatility} color={AMBER} />
        <MiniStat label="Typical Behaviour" value={info.behaviour} color={BLUE} />
      </div>
      <div style={{ marginTop: 8, background: "#14161a", borderRadius: 10, padding: "9px 11px" }}>
        <div style={{ fontSize: 9.5, color: "#777", marginBottom: 3 }}>Recommended Trading Style</div>
        <div style={{ fontSize: 11.5, color: "#e5e5e5", fontWeight: 700, lineHeight: 1.6 }}>{info.recommendation}</div>
      </div>

      {next && (
        <div style={{ fontSize: 10.5, color: "#777", marginTop: 10, paddingTop: 8, borderTop: "1px solid #ffffff10" }}>
          Next session: <b style={{ color: "#ccc" }}>{next.label}</b> opens in <b style={{ color: GOLD_LIGHT }}>{hoursLabel(next.startsIn)}</b>
        </div>
      )}
    </CardShell>
  );
}

/* خط الجلسات المرئي: 24 ساعة، بدعم النطاقات الملفوفة (Sydney) + تظليل التداخل الفعلي + مؤشر الوقت الحالي */
function SessionTimelineVisual({ sessions, overlap }) {
  const now = new Date().getUTCHours() + new Date().getUTCMinutes() / 60;

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
      <div style={{ position: "relative", height: 34, background: "#101114", borderRadius: 8, overflow: "hidden", border: "1px solid #262626" }}>
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
                borderRadius: 5,
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
              background: `repeating-linear-gradient(45deg, ${GOLD}55, ${GOLD}55 3px, transparent 3px, transparent 6px)`,
              border: `1px solid ${GOLD}`,
              borderRadius: 5,
              boxShadow: `0 0 8px ${GOLD}88`,
            }}
          />
        ))}
        <div style={{ position: "absolute", left: `${(now / 24) * 100}%`, top: -2, bottom: -2, width: 2, background: "#fff", boxShadow: "0 0 6px #fff", transition: "left 1s linear" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "#555", marginTop: 3 }}>
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
      {overlap && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 10.5, color: GOLD_LIGHT, fontWeight: 700 }}>
          🔥 {overlap.label} overlap — {overlap.liquidity} liquidity right now
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   كرت 3: Live Opportunities — من /api/radar (نفس QAIS Engine، مخزّنة بالكرون)
   ============================================================================ */
function LiveOpportunitiesCard({ items, onOpen }) {
  const sorted = useMemo(() => {
    const order = { green: 0, orange: 1, yellow: 2, red: 3, gray: 4 };
    return [...items].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || (b.score || 0) - (a.score || 0)).slice(0, 6);
  }, [items]);

  return (
    <CardShell title="Live Opportunities" icon="⚡">
      {sorted.length === 0 ? (
        <EmptyNote text="لا توجد أصول مراقبة بعد" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {sorted.map((it) => {
            const sig = it.status === "green" ? (it.direction === "up" ? "BUY" : "SELL") : "WAIT";
            const color = sig === "BUY" ? GREEN : sig === "SELL" ? RED : "#888";
            return (
              <div key={it.symbol} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#14161a", borderRadius: 10, padding: "7px 10px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#e5e5e5" }}>{it.symbol}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 800, color, background: `${color}22`, borderRadius: 5, padding: "1px 6px" }}>{sig}</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: "#888" }}>{it.score != null ? `Score ${it.score}%` : "—"}</div>
                </div>
                <button
                  onClick={() => onOpen(it.symbol)}
                  style={{ background: "transparent", border: `1px solid ${GOLD}55`, color: GOLD_LIGHT, borderRadius: 6, padding: "4px 9px", fontSize: 10.5, cursor: "pointer", fontWeight: 700 }}
                >
                  Open
                </button>
              </div>
            );
          })}
        </div>
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
  const sorted = useMemo(
    () => [...items].filter((i) => i.decision).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, limit),
    [items, limit]
  );
  const active = items.find((i) => i.symbol === selectedSymbol) || sorted[0] || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="qmi-anim" style={{ ...glass, padding: "1.1rem" }}>
        <SectionHeader
          icon="💧"
          title="Liquidity Map"
          subtitle="Where price is hunting liquidity right now. Click any row to load its full breakdown in the Analysis Workspace below — nothing pops up, the page just updates."
        />

        {/* -------- كروت شرح المفاهيم (بدل الفقرة الطويلة) -------- */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, margin: "16px 0 18px" }}>
          <ConceptCard icon="⬆️" title="Above High" lines={["Price swept previous highs.", "Usually takes Buy Side Liquidity."]} color={RED} />
          <ConceptCard icon="⬇️" title="Below Low" lines={["Price swept previous lows.", "Usually takes Sell Side Liquidity."]} color={GREEN} />
          <ConceptCard icon="🧱" title="Order Block" lines={["Institutional supply or demand zone."]} color={GOLD_LIGHT} />
          <ConceptCard icon="⚡" title="Fair Value Gap" lines={["Price imbalance waiting to be rebalanced."]} color={BLUE} />
          <ConceptCard icon="🎯" title="Score" lines={["Overall confidence calculated by Qais SK Engine."]} color={GOLD} />
        </div>

        {sorted.length === 0 ? (
          <EmptyNote text="بانتظار أول دورة تحليل من المحرك" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", fontSize: 10, color: "#666", padding: "0 12px" }}>
              <span style={{ flex: 1.3 }}>Symbol</span>
              <span style={{ flex: 1.3 }}>Liquidity</span>
              <span style={{ flex: 1.3 }}>Order Block</span>
              <span style={{ flex: 1.1 }}>Fair Value Gap</span>
              <span style={{ flex: 0.8, textAlign: "left" }}>Score</span>
            </div>
            {sorted.map((it) => {
              const d = it.decision;
              const swept = !!d?.liquidityStatus?.startsWith?.("Swept");
              const liqLabel = swept ? (it.direction === "up" ? "Below Low" : "Above High") : d?.liquidityStatus || "Not Swept";
              const liqColor = swept ? (it.direction === "up" ? GREEN : RED) : "#666";
              const obLabel = d?.ob?.eligible ? `${it.direction === "up" ? "Bullish" : "Bearish"} OB` : "—";
              const fvgLabel = d?.fvgStatus || "—";
              const isSelected = active?.symbol === it.symbol;
              return (
                <button
                  key={it.symbol}
                  onClick={() => onSelect(it.symbol)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    textAlign: "right",
                    cursor: "pointer",
                    background: isSelected ? `${GOLD}18` : "#14161a",
                    border: `1px solid ${isSelected ? `${GOLD}80` : "transparent"}`,
                    borderRadius: 10,
                    padding: "9px 12px",
                    fontSize: 11.5,
                    transition: "all .2s ease",
                  }}
                >
                  <span style={{ flex: 1.3, fontWeight: 800, color: "#e5e5e5", display: "flex", alignItems: "center", gap: 6 }}>
                    {isSelected && <span style={{ width: 5, height: 5, borderRadius: "50%", background: GOLD }} />}
                    {it.symbol}
                  </span>
                  <span style={{ flex: 1.3, color: liqColor, fontWeight: 700 }}>{liqLabel}</span>
                  <span style={{ flex: 1.3, color: d?.ob?.eligible ? GOLD_LIGHT : "#666" }}>{obLabel}</span>
                  <span style={{ flex: 1.1, color: fvgLabel === "Present" ? BLUE : "#666" }}>{fvgLabel}</span>
                  <span style={{ flex: 0.8, textAlign: "left", fontWeight: 800, color: (it.score ?? 0) >= 85 ? GREEN : "#ccc" }}>{it.score ?? 0}%</span>
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

/* -------------------- Analysis Workspace: دائم، بيتحدث بس لما تتغير الأصل المختار -------------------- */
function AnalysisWorkspace({ item }) {
  if (!item) {
    return (
      <div className="qmi-anim" style={{ ...glass, padding: "1.1rem" }}>
        <SectionHeader icon="🧠" title="Analysis Workspace" subtitle="Click any asset in the Liquidity Map above to load its full breakdown here." />
        <EmptyNote text="لا يوجد أصل محدد بعد" />
      </div>
    );
  }

  const d = item.decision;
  const dirLabel = item.direction === "up" ? "Bullish" : item.direction === "down" ? "Bearish" : "Neutral";
  const dirColor = item.direction === "up" ? GREEN : item.direction === "down" ? RED : "#888";
  const htfLabel = d?.htfTrend === "up" ? "Bullish" : d?.htfTrend === "down" ? "Bearish" : "—";
  const htfColor = d?.htfTrend === "up" ? GREEN : d?.htfTrend === "down" ? RED : "#888";
  const swept = !!d?.liquidityStatus?.startsWith?.("Swept");
  const liqTypeLabel = swept
    ? item.direction === "up"
      ? "Below Low — Sell-Side Liquidity Taken"
      : "Above High — Buy-Side Liquidity Taken"
    : d?.liquidityStatus || "Not Swept Yet";
  const obLabel = d?.ob?.eligible ? `${dirLabel} OB · ${d.ob.status} · Quality ${d.ob.quality}%` : "No Valid Order Block Yet";
  const lastTarget = d?.targets?.[d.targets.length - 1];
  const expectedMove = d?.entry != null && lastTarget ? `${fmt(d.entry)} → ${fmt(lastTarget.price)}` : "—";
  const score = d?.score ?? 0;

  const summary = d
    ? `${item.symbol} is showing a ${dirLabel.toLowerCase()} bias${d.sessionLabel ? ` during the ${d.sessionLabel}` : ""}. ${
        d.why?.length ? `Key drivers: ${d.why.join(", ")}. ` : ""
      }QAIS Score is ${score}/100 — ${d.tradeValid ? "every step in the entry checklist has been confirmed." : "not every step in the entry checklist is confirmed yet, so this setup is still forming."}`
    : `Waiting for the QAIS SK Engine to complete the first analysis cycle for ${item.symbol}.`;

  return (
    <div key={item.symbol} className="qmi-anim" style={{ ...glass, padding: "1.1rem" }}>
      <SectionHeader icon="🧠" title="Analysis Workspace" subtitle={`Full breakdown for ${item.symbol} — always visible, refreshes automatically when you pick another asset above.`} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 10, marginTop: 14 }}>
        <WorkspaceStat label="Liquidity Status" value={d?.liquidityStatus || "—"} />
        <WorkspaceStat label="Market Structure" value={d?.marketStructure || (d?.bosStatus === "Detected" ? "Break of Structure" : "Ranging")} />
        <WorkspaceStat label="Trend" value={dirLabel} color={dirColor} />
        <WorkspaceStat label="HTF Trend" value={htfLabel} color={htfColor} />
        <WorkspaceStat label="Liquidity Type" value={liqTypeLabel} color={swept ? (item.direction === "up" ? GREEN : RED) : "#888"} />
        <WorkspaceStat label="Order Block" value={obLabel} color={d?.ob?.eligible ? GOLD_LIGHT : "#888"} />
        <WorkspaceStat label="Fair Value Gap" value={d?.fvgStatus || "—"} color={d?.fvgStatus === "Present" ? BLUE : "#888"} />
        <WorkspaceStat label="Expected Move" value={expectedMove} color={GOLD_LIGHT} />
        <WorkspaceStat label="Entry Zone" value={fmt(d?.entry)} color={GOLD_LIGHT} />
        <WorkspaceStat label="Stop Loss" value={fmt(d?.stopLoss)} color={RED} />
        <WorkspaceStat label="Take Profit" value={lastTarget ? fmt(lastTarget.price) : "—"} color={GREEN} />
        <WorkspaceStat label="Confidence" value={`${score}%`} color={score >= 85 ? GREEN : GOLD_LIGHT} />
      </div>

      <div style={{ marginTop: 12, background: "#14161a", border: `1px solid ${GOLD}22`, borderRadius: 10, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Sparkles size={12} color={GOLD} />
          <span style={{ fontSize: 11, fontWeight: 800, color: GOLD_LIGHT, letterSpacing: 0.3 }}>AI SUMMARY</span>
        </div>
        <div style={{ fontSize: 12, color: "#ccc", lineHeight: 1.8 }}>{summary}</div>
      </div>
    </div>
  );
}

function WorkspaceStat({ label, value, color }) {
  return (
    <div style={{ background: "#14161a", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: "#777", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: color || "#e5e5e5", lineHeight: 1.4 }}>{value}</div>
    </div>
  );
}

/* -------------------- كرت شرح مفهوم واحد (تعليمي، بدون بيانات حيّة) -------------------- */
function ConceptCard({ icon, title, lines, color }) {
  return (
    <div className="qmi-concept-card" style={{ background: "#14161a", border: `1px solid ${color}33`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: color || "#f0f0f0" }}>{title}</span>
      </div>
      {lines.map((l, i) => (
        <div key={i} style={{ fontSize: 11, color: "#999", lineHeight: 1.6 }}>
          {l}
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: "#f5f5f5" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: "#888", marginTop: 2, lineHeight: 1.6 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

/* ============================================================================
   Market Summary
   ============================================================================ */
function MarketSummaryCard({ snapshot, radarItems, newsToday }) {
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
  const biasColor = biasLabel === "Bullish" ? GREEN : biasLabel === "Bearish" ? RED : "#888";

  return (
    <CardShell title="Market Summary" icon="📊">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        <SummaryStat label="Overall Bias" value={biasLabel} sub={total ? `${biasPct}% confidence` : "لا بيانات كافية"} color={biasColor} />
        <SummaryStat label="Strongest Currency" value={strongest ? strongest[0] : "—"} sub={strongest ? `${strongest[1]}` : ""} color={GREEN} />
        <SummaryStat label="Weakest Currency" value={weakest ? weakest[0] : "—"} sub={weakest ? `${weakest[1]}` : ""} color={RED} />
        <SummaryStat label="Active Opportunities" value={active.length} sub="Live from QAIS Radar" color={GOLD_LIGHT} />
        <SummaryStat label="High Impact News" value={newsToday.high} sub="Today" color={AMBER} />
      </div>
    </CardShell>
  );
}

function SummaryStat({ label, value, sub, color }) {
  return (
    <div style={{ background: "#14161a", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, color: "#888" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || "#f0f0f0" }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, color: "#666", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

/* ============================================================================
   Live Notifications
   ============================================================================ */
function LiveNotificationsCard({ items, onOpen }) {
  const notifs = useMemo(
    () =>
      [...items]
        .filter((i) => i.status === "green" && i.updated_at)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 5),
    [items]
  );

  return (
    <CardShell title="Live Notifications" icon="🔔">
      {notifs.length === 0 ? (
        <EmptyNote text="لا توجد إشعارات جديدة حالياً" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifs.map((it) => (
            <button
              key={it.symbol}
              onClick={() => onOpen(it.symbol)}
              style={{ display: "flex", alignItems: "center", gap: 9, background: "#14161a", border: "none", borderRadius: 10, padding: "8px 10px", cursor: "pointer", textAlign: "right" }}
            >
              <Bell size={13} color={GOLD} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11.5, color: "#e5e5e5", fontWeight: 700 }}>
                  New Opportunity — {it.symbol} <span style={{ color: it.direction === "up" ? GREEN : RED }}>{it.direction === "up" ? "BUY" : "SELL"}</span>
                </div>
                <div style={{ fontSize: 10, color: "#888" }}>{it.score}% Confidence · {relTime(it.updated_at)}</div>
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
export function CardShell({ title, icon, children }) {
  return (
    <div style={{ ...glass, padding: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: "#f0f0f0" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function EmptyNote({ text }) {
  return <div style={{ fontSize: 11.5, color: "#777", padding: "1rem 0", textAlign: "center" }}>{text}</div>;
}
