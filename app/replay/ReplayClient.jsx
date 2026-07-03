"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { ASSETS, getAssetByValue, INTERVAL_MAP, INTERVAL_MS } from "@/lib/assets";

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
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (id) {
    case "cursor":
      return (<svg {...common}><path d="M5 3l14 6.5-6 1.7L11 18 5 3z" fill="currentColor" stroke="none" /></svg>);
    case "trendline":
      return (<svg {...common}><circle cx="5" cy="19" r="1.8" /><circle cx="19" cy="5" r="1.8" /><line x1="6.3" y1="17.7" x2="17.7" y2="6.3" /></svg>);
    case "hline":
      return (<svg {...common}><line x1="3" y1="12" x2="21" y2="12" /><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" /></svg>);
    case "rectangle":
      return (<svg {...common}><rect x="4" y="6" width="16" height="12" rx="1" /></svg>);
    case "fib":
      return (<svg {...common}><line x1="3" y1="5" x2="21" y2="5" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="3" y1="14" x2="21" y2="14" /><line x1="3" y1="19" x2="21" y2="19" /></svg>);
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

export default function ReplayClient() {

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
  const [magnetOn, setMagnetOn] = useState(true);
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  const activeToolRef = useRef("cursor");
  const magnetRef = useRef(true);
  const drawingsVisibleRef = useRef(true);
  const drawingsRef = useRef([]); // [{id, type, p1:{logical,price}, p2?, text?}]
  const drawStateRef = useRef(null); // الرسمة الجارية حالياً
  const isDrawingRef = useRef(false);
  const visibleCandlesRef = useRef([]);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { magnetRef.current = magnetOn; }, [magnetOn]);
  useEffect(() => { drawingsVisibleRef.current = drawingsVisible; drawOverlay(); }, [drawingsVisible]);
  useEffect(() => {
    visibleCandlesRef.current = mode === "training" ? allCandles.slice(0, revealCount) : allCandles;
  }, [allCandles, revealCount, mode]);

  const TOOLS = [
    { id: "cursor", title: "مؤشر (تنقل عادي)" },
    { id: "trendline", title: "خط اتجاه" },
    { id: "hline", title: "خط أفقي" },
    { id: "rectangle", title: "مستطيل" },
    { id: "fib", title: "فيبوناتشي" },
    { id: "text", title: "نص" },
    { id: "measure", title: "أداة قياس" },
  ];

  function snapPrice(logical, rawPrice) {
    if (!magnetRef.current) return rawPrice;
    const idx = Math.round(logical);
    const candle = visibleCandlesRef.current[idx];
    if (!candle) return rawPrice;
    const vals = [candle.open, candle.high, candle.low, candle.close];
    let best = vals[0], bestDist = Math.abs(rawPrice - vals[0]);
    for (const v of vals) {
      const d = Math.abs(rawPrice - v);
      if (d < bestDist) { bestDist = d; best = v; }
    }
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

    const all = [...drawingsRef.current];
    if (drawStateRef.current) all.push(drawStateRef.current);

    for (const d of all) {
      ctx.lineWidth = 1.5;
      ctx.font = "11px sans-serif";
      if (d.type === "hline") {
        const y = series.priceToCoordinate(d.p1.price);
        if (y == null) continue;
        ctx.strokeStyle = GOLD_LIGHT;
        ctx.fillStyle = GOLD_LIGHT;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillText(d.p1.price.toFixed(2), 6, y - 4);
      } else if (d.type === "trendline") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        ctx.strokeStyle = GOLD_LIGHT;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else if (d.type === "rectangle") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        const rw = Math.abs(b.x - a.x), rh = Math.abs(b.y - a.y);
        ctx.fillStyle = "rgba(201,162,75,0.15)";
        ctx.strokeStyle = GOLD_LIGHT;
        ctx.fillRect(x, y, rw, rh);
        ctx.strokeRect(x, y, rw, rh);
      } else if (d.type === "fib") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
        const priceHigh = Math.max(d.p1.price, d.p2.price);
        const priceLow = Math.min(d.p1.price, d.p2.price);
        ctx.strokeStyle = GOLD_LIGHT;
        ctx.fillStyle = GOLD_LIGHT;
        for (const lvl of levels) {
          const price = priceHigh - (priceHigh - priceLow) * lvl;
          const y = series.priceToCoordinate(price);
          if (y == null) continue;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillText(`${(lvl * 100).toFixed(1)}% - ${price.toFixed(2)}`, x1 + 4, y - 3);
        }
      } else if (d.type === "text") {
        const p = toXY(d.p1);
        if (p.x == null || p.y == null) continue;
        ctx.fillStyle = GOLD_LIGHT;
        ctx.font = "13px sans-serif";
        ctx.fillText(d.text, p.x + 5, p.y - 5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
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
        ctx.fillRect(x, y, rw, rh);
        ctx.strokeRect(x, y, rw, rh);
        ctx.fillStyle = col;
        ctx.font = "12px sans-serif";
        ctx.fillText(`${priceDiff >= 0 ? "+" : ""}${priceDiff.toFixed(2)} (${pct.toFixed(2)}%) | ${bars} شمعة`, x + 5, y - 6);
      }
    }
    ctx.restore();
  }

  function handleClearDrawings() {
    if (drawingsRef.current.length === 0) return;
    if (!window.confirm("مسح كل الرسومات من الشارت؟")) return;
    drawingsRef.current = [];
    drawOverlay();
  }
  function toggleDrawingsVisible() { setDrawingsVisible((v) => !v); }
  function handleResetView() {
    chartRef.current?.timeScale().fitContent();
    chartRef.current?.priceScale("right").applyOptions({ autoScale: true });
  }

  const assetInfo = getAssetByValue(assetValue);
  const supported = randomChart || !!assetInfo?.yahoo;

  /* ===================== إنشاء الشارت مرة وحدة ===================== */
  useEffect(() => {
    let cancelled = false;
    async function setup() {
      const { createChart } = await import("lightweight-charts");
      if (cancelled || !chartContainerRef.current) return;

      const chart = createChart(chartContainerRef.current, {
        layout: { background: { color: "transparent" }, textColor: "#999" },
        grid: { vertLines: { color: "#1a1a1a" }, horzLines: { color: "#1a1a1a" } },
        timeScale: { borderColor: "#222", timeVisible: true },
        rightPriceScale: { borderColor: "#222" },
        width: chartContainerRef.current.clientWidth,
        height: 480,
      });

      const series = chart.addCandlestickSeries({
        upColor: GREEN, downColor: RED, borderVisible: false,
        wickUpColor: GREEN, wickDownColor: RED,
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
        if (!canvas) return { logical: null, price: null };
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const ts = chart.timeScale();
        const logical = ts.coordinateToLogical(x);
        const price = series.coordinateToPrice(y);
        return { logical, price };
      }
      function onMouseDown(e) {
        const tool = activeToolRef.current;
        if (tool === "cursor") return;
        const { logical, price } = getLogicalPrice(e.clientX, e.clientY);
        if (logical == null || price == null) return;
        const snapped = snapPrice(logical, price);

        if (tool === "text") {
          const content = window.prompt("اكتبي النص:");
          if (content) {
            drawingsRef.current.push({ id: Date.now(), type: "text", p1: { logical, price: snapped }, text: content });
          }
          setActiveTool("cursor");
          drawOverlay();
          return;
        }
        if (tool === "hline") {
          drawingsRef.current.push({ id: Date.now(), type: "hline", p1: { logical, price: snapped } });
          setActiveTool("cursor");
          drawOverlay();
          return;
        }
        drawStateRef.current = { type: tool, p1: { logical, price: snapped }, p2: { logical, price: snapped } };
        isDrawingRef.current = true;
      }
      function onMouseMove(e) {
        if (!isDrawingRef.current || !drawStateRef.current) return;
        const { logical, price } = getLogicalPrice(e.clientX, e.clientY);
        if (logical == null || price == null) return;
        drawStateRef.current.p2 = { logical, price: snapPrice(logical, price) };
        drawOverlay();
      }
      function onMouseUp() {
        if (!isDrawingRef.current || !drawStateRef.current) return;
        isDrawingRef.current = false;
        const d = drawStateRef.current;
        drawStateRef.current = null;
        if (d.type !== "measure") {
          drawingsRef.current.push({ id: Date.now(), ...d });
        }
        setActiveTool("cursor");
        drawOverlay();
      }
      function onKeyDown(e) {
        if (e.key === "Escape") {
          isDrawingRef.current = false;
          drawStateRef.current = null;
          setActiveTool("cursor");
          drawOverlay();
        }
      }
      const overlayEl = overlayCanvasRef.current;
      overlayEl?.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("keydown", onKeyDown);
      chart.timeScale().subscribeVisibleLogicalRangeChange(drawOverlay);
      chart.subscribeCrosshairMove(drawOverlay);

      chart.__cleanup = () => {
        window.removeEventListener("resize", handleResize);
        document.removeEventListener("fullscreenchange", handleFsChange);
        overlayEl?.removeEventListener("mousedown", onMouseDown);
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
      const candles = data.candles || [];
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

    if (trainingStep || liveTick) {
      // نضيف/نحدّث الشمعة الأخيرة بس، من دون setData/fitContent
      // عشان ما يصير "رجوع" أو ريست مزعج للزوم والسكرول يلي عم تتفرجي عليه
      seriesRef.current.update(allCandles[revealCount - 1]);
    } else {
      // تحميل بيانات جديدة أو قفزة كبيرة (تبديل وضع/أصل/فريم/بداية عشوائية/قص نقطة/إعادة من البداية)
      seriesRef.current.setData(allCandles.slice(0, revealCount));
      chartRef.current?.timeScale().fitContent();
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
      const fresh = data.candles;
      const lastFresh = fresh[fresh.length - 1];

      setAllCandles((prev) => {
        if (prev.length === 0) return prev;
        const merged = [...prev];
        // لو نفس وقت آخر شمعة عندنا - تحديث فقط. لو وقت جديد - إضافة شمعة جديدة
        if (merged[merged.length - 1].time === lastFresh.time) {
          merged[merged.length - 1] = lastFresh;
        } else if (lastFresh.time > merged[merged.length - 1].time) {
          merged.push(lastFresh);
        }
        seriesRef.current?.update(merged[merged.length - 1]);
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
      </div>
    );
  }

  /* شريط أدوات الرسم العمودي (ستايل تريدنغ فيو) — ثابت عالشمال دايماً بغض النظر عن اتجاه الصفحة */
  function renderDrawToolbar() {
    return (
      <div style={{
        position: "absolute", top: 10, left: 10, zIndex: 10,
        display: "flex", flexDirection: "column", gap: 3,
        background: "#1a1a1a", border: "1px solid #2f2f2f", borderRadius: 10, padding: 5,
        boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
      }}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            title={t.title}
            onClick={() => setActiveTool((cur) => (cur === t.id ? "cursor" : t.id))}
            style={toolBtnStyle(activeTool === t.id)}
          >
            <ToolIcon id={t.id} />
          </button>
        ))}
        <div style={{ height: 1, background: "#333", margin: "3px 2px" }} />
        <button title="مغناطيس: الالتصاق بأقرب سعر شمعة" onClick={() => setMagnetOn((m) => !m)} style={toolBtnStyle(magnetOn)}>
          <ToolIcon id="magnet" />
        </button>
        <button title={drawingsVisible ? "إخفاء الرسومات" : "إظهار الرسومات"} onClick={toggleDrawingsVisible} style={toolBtnStyle(!drawingsVisible)}>
          <ToolIcon id={drawingsVisible ? "eye" : "eyeOff"} />
        </button>
        <button title="حذف كل الرسومات" onClick={handleClearDrawings} style={toolBtnStyle(false)}>
          <ToolIcon id="trash" />
        </button>
      </div>
    );
  }

  /* أدوات التحكم (الأصل/الفريم/السرعة + أزرار الريبلاي) */
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
      </div>

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
    width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 6, cursor: "pointer",
    border: "1px solid transparent",
    background: active ? `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})` : "transparent",
    color: active ? "#1a1200" : "#c8c8c8",
    transition: "background .12s, color .12s",
  };
}

function btnStyle(kind) {
  const base = { padding: "0.55rem 1rem", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none" };
  if (kind === "primary") return { ...base, background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`, color: "#1a1200" };
  return { ...base, background: "transparent", border: `1px solid ${GOLD}44`, color: GOLD };
}
