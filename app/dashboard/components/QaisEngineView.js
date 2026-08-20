"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Sparkles, RotateCcw } from "lucide-react";
import { ASSETS, getAssetByValue } from "@/lib/assets";
import { analyzeSymbol, getCorrelatedSymbol } from "@/lib/qais/engine";

/* ============================================================================
   QaisEngineView — تبويب "QAIS SK Engine" المستقل. شارت حي + Decision Engine كامل.

   نظام عرض الصفقة (Sequence Projection — تحديث بصري فقط، منطق الحساب بـ
   lib/qais/sequence.js و decision.js لم يتغيّر إطلاقاً):
     - ما في ولا خط سعري يمتد عبر كامل الشارت (لا Entry ولا SL ولا TP ولا حتى
       مستويات الـ Sequence الداخلية). كل شي يترسم بـ Canvas overlay فوق الشارت،
       بامتداد محدود فقط ضمن منطقة الحركة (A→B→C) أو منطقة "المسقط" الفارغة
       بعد آخر شمعة (Projection Zone).
     - نقاط A/B/C ومستويات الـ Sequence الداخلية بترتسم بس لما فريم العرض
       المختار = نفس الفريم اللي حُسب عليه الـ Sequence فعلياً (sequence.displayTF)
       — لأنها إحداثيات تاريخية حقيقية (وقت + سعر)، عكس المسقط اللي هو سعر بس.
     - ENTRY/SL/TP1-4 (Trade/Sequence Projection) بترتسم دايماً بغض النظر عن
       الفريم المعروض، لأنها مجرد مستويات سعرية مسقطة بمساحة فارغة يمين آخر شمعة.
   ============================================================================ */

const GOLD = "#DCD4F7";
const GOLD_LIGHT = "#F5F3FF";
const GREEN = "#10E5A0";
const RED = "#FF453A";
const BLUE = "#7C4DFF";
const NEUTRAL = "#F5F3FF";
const CHART_H = 560;
const ANIM_MS = 450;

const cardStyle = {
  background: "#141024",
  border: `1px solid #2A2145`,
  borderRadius: 0,
  boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
};

const TF_LABELS = { daily: "Daily", h4: "H4", h1: "H1", m15: "M15", m5: "M5" };
const TF_ORDER = ["daily", "h4", "h1", "m15", "m5"];

/* رموز مرجعية لأصول SMT مش موجودة أصلاً بقائمة أصول المنصة (نفس خارطة الكرون) */
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

export default function QaisEngineView() {
  const [symbol, setSymbol] = useState("XAUUSD");
  const [displayTF, setDisplayTF] = useState("h1");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // نتيجة analyzeSymbol كاملة
  const [allCandles, setAllCandles] = useState({}); // { daily, h4, h1, m15, m5 }

  const wrapRef = useRef(null); // الحاوية (position:relative) — الشارت + الـ canvas فوق بعض
  const containerRef = useRef(null); // حاوية lightweight-charts نفسها
  const canvasRef = useRef(null); // كانفاس الرسم (Entry/SL/TP/Sequence)
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLinesRef = useRef([]); // خطوط سعرية أصيلة من lightweight-charts (POI + MT قبل الدخول فقط)
  const resultRef = useRef(null);
  const displayTFRef = useRef(displayTF);
  const candlesRef = useRef({});
  const rafRef = useRef(null);
  const animStartRef = useRef(0);

  const asset = getAssetByValue(symbol);

  useEffect(() => {
    displayTFRef.current = displayTF;
  }, [displayTF]);
  useEffect(() => {
    candlesRef.current = allCandles;
  }, [allCandles]);

  /* ===================== جلب كل الفريمات + تشغيل QAIS Decision Engine مرة وحدة ===================== */
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

      // SMT (توثيق RADAR الجديد، الفصل ٥/٦: "SMT مؤكد على 1H أو 15M") — نجيب
      // الفريمين للأصل المترابط عشان المحرك يقدر يفحصهم بالترتيب (H1 أولاً)
      let correlated = null;
      const corrSymbol = getCorrelatedSymbol(symbol);
      if (corrSymbol) {
        const corrYahoo = getAssetByValue(corrSymbol)?.yahoo || YAHOO_OVERRIDE[corrSymbol];
        if (corrYahoo) {
          const [corrH1, corrM15] = await Promise.all([
            fetchCandles(corrYahoo, "1h", 300),
            fetchCandles(corrYahoo, "15min", 300),
          ]);
          if (corrH1?.length >= 30 || corrM15?.length >= 30) {
            correlated = { symbol: corrSymbol, candlesByTF: { h1: corrH1 || [], m15: corrM15 || [] } };
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
      animStartRef.current = performance.now(); // إعادة تشغيل أنيميشن الدخول (٨)
      // فريم العرض الافتراضي: فريم الـ Sequence نفسه (لعرض A/B/C بدقة)، وإلا فريم
      // تنفيذ الـ OB، وإلا الفريم الرئيسي
      setDisplayTF(analysis.sequence?.displayTF || analysis.executionTimeframe || analysis.mainTimeframe || "h1");
    } catch (e) {
      setError(e.message || "فشل تشغيل محرك التحليل");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  /* ===================== إنشاء الشارت + الكانفاس فوقه مرة وحدة ===================== */
  useEffect(() => {
    let cancelled = false;
    async function setup() {
      const { createChart, CrosshairMode, LineStyle } = await import("lightweight-charts");
      if (cancelled || !containerRef.current) return;

      const chart = createChart(containerRef.current, {
        layout: { background: { color: "#0E0A1A" }, textColor: "#A79FC4" },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.04)" },
          horzLines: { color: "rgba(255,255,255,0.04)" },
        },
        // rightOffset أكبر من الافتراضي عشان يفضّل فراغ كافي بعد آخر شمعة —
        // هوّن بالضبط بترتسم منطقة الـ Sequence/Trade Projection (٤/٩)
        timeScale: { borderColor: "#2A2145", timeVisible: true, secondsVisible: false, rightOffset: 16 },
        rightPriceScale: { borderColor: "#2A2145" },
        width: containerRef.current.clientWidth,
        height: CHART_H,
        crosshair: { mode: CrosshairMode.Normal },
      });

      const series = chart.addCandlestickSeries({
        upColor: GREEN,
        downColor: RED,
        borderVisible: false,
        wickUpColor: GREEN,
        wickDownColor: RED,
      });

      chartRef.current = chart;
      seriesRef.current = series;
      chartRef.current.__LineStyle = LineStyle;

      const requestDraw = () => scheduleDraw();
      chart.timeScale().subscribeVisibleTimeRangeChange(requestDraw);

      const handleResize = () => {
        if (!containerRef.current) return;
        chart.applyOptions({ width: containerRef.current.clientWidth });
        requestDraw();
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

  /* ===================== حلقة الرسم (أنيميشن fade/slide-in عند صفقة جديدة — ٦/٨) ===================== */
  function scheduleDraw() {
    if (rafRef.current) return;
    const loop = () => {
      draw();
      const elapsed = performance.now() - animStartRef.current;
      if (elapsed < ANIM_MS) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }

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

    /* -------- 1) Sequence التاريخي (A→B→C + المستويات الداخلية) --------
       بس لما الفريم المعروض = نفس فريم حساب الـ Sequence (إحداثيات دقيقة ١٠٠٪) */
    const seq = r.sequence;
    if (seq?.active && seq.displayTF && seq.displayTF === displayTFRef.current) {
      drawSequenceHistory(ctx, seq, timeToX, priceToY, lastX, ease);
    }

    /* -------- 2) منطقة المسقط (Projection Zone) بعد آخر شمعة: Entry/SL/TP1-4 --------
       دايماً ظاهرة (بغض النظر عن الفريم المعروض) — لأنها مستويات سعرية بس */
    drawProjection(ctx, r, priceToY, lastX, w, h, ease);
  }

  /* ===================== تحديث شموع الفريم المعروض + الخطوط السياقية (POI/MT) ===================== */
  useEffect(() => {
    if (!seriesRef.current) return;
    const candles = allCandles[displayTF];
    if (!candles || candles.length === 0) return;
    seriesRef.current.setData(candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
    chartRef.current?.timeScale().fitContent();
    applyContextPriceLines();
    scheduleDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCandles, displayTF, result]);

  /* -------- خطوط سعرية أصيلة محدودة جداً: POI الملموسة + مستوى MT قبل اكتمال الدخول --------
     (هاي مش جزء من شكوى Entry/SL/TP — بس سطرين خفيفين للسياق، فمنخليهم native price line) */
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
        price,
        color,
        lineWidth: 1,
        lineStyle: chartRef.current.__LineStyle.Dotted,
        axisLabelVisible: true,
        title,
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
    /* ⚠️ كان `r.ob` من `orderblock.js` المشال. صار مستوى MT للكتلة المُمثِّلة
       بالسلسلة الجديدة — نفس المستوى اللي بتقيسه `levelsFromGroup`. */
    if (!r.tradeValid) {
      const repMt = r.skV2?.setups?.find((s) => s.blockId === r.readiness?.blockId)?.levels?.mt;
      if (repMt != null) add(repMt, `${NEUTRAL}88`, `MT (${r.readiness?.waitingFor || "—"})`);
    }
  }

  /* -------- إعادة تعيين الشارت: رجوع للتقريب والتمرير الافتراضي (زوم/سكرول) -------- */
  function resetChart() {
    const chart = chartRef.current;
    if (!chart) return;
    chart.timeScale().fitContent();
    chart.timeScale().scrollToRealTime();
    scheduleDraw();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {/* ================= 1) TOP HEADER ================= */}
      <div
        style={{
          ...cardStyle,
          padding: "0.7rem 1.1rem",
          display: "flex",
          alignItems: "center",
          gap: "1.4rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={15} color={GOLD} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#F5F3FF", letterSpacing: 0.3 }}>QAIS SK ENGINE</span>
        </div>

        <div style={{ width: 1, height: 20, background: "#2A2145" }} />

        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          style={{
            background: "#0E0A1A",
            color: "#F5F3FF",
            border: "1px solid #2A2145",
            borderRadius: 3,
            fontSize: 12.5,
            padding: "5px 8px",
            fontWeight: 600,
          }}
        >
          {ASSETS.flatMap((g) => g.items.filter((i) => i.yahoo)).map((i) => (
            <option key={i.v} value={i.v}>
              {i.label}
            </option>
          ))}
        </select>

        {/* فريمات العرض — كلها متوفرة دايماً (جُلبت مسبقاً)، مجرد تبديل عرض بدون إعادة تحليل */}
        <div style={{ display: "flex", gap: 4 }}>
          {TF_ORDER.filter((tf) => allCandles[tf]?.length).map((tf) => (
            <button
              key={tf}
              onClick={() => setDisplayTF(tf)}
              title={
                tf === result?.sequence?.displayTF
                  ? "فريم الـ Sequence"
                  : tf === result?.mainTimeframe
                  ? "الفريم الرئيسي"
                  : tf === result?.executionTimeframe
                  ? "فريم التنفيذ"
                  : ""
              }
              style={{
                background: displayTF === tf ? `#2A2145` : "transparent",
                border: `1px solid ${displayTF === tf ? GOLD : "#241C3E"}`,
                color: displayTF === tf ? GOLD_LIGHT : "#6E6690",
                borderRadius: 3,
                padding: "5px 10px",
                fontSize: 11.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {TF_LABELS[tf]}
              {tf === result?.mainTimeframe ? " •" : ""}
            </button>
          ))}
        </div>

        <button
          onClick={resetChart}
          title="إعادة تعيين الشارت (تصفير الزوم/السكرول)"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: "transparent",
            border: "1px solid #241C3E",
            color: "#aaa",
            borderRadius: 3,
            padding: "5px 9px",
            fontSize: 11.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <RotateCcw size={12} />
          إعادة تعيين
        </button>

        <button
          onClick={runAnalysis}
          disabled={loading}
          style={{
            background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
            border: "none",
            color: "#0E0A1A",
            fontWeight: 700,
            borderRadius: 3,
            padding: "7px 15px",
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          {loading ? "..." : "AI Analyze"}
        </button>

        <div style={{ marginRight: "auto" }}>
          <ScoreBadge score={result?.score || 0} status={result?.status} />
        </div>
      </div>

      {error && <div style={{ ...cardStyle, padding: "0.7rem 1rem", color: RED, fontSize: 12.5 }}>{error}</div>}

      {/* ================= 2) الشارت — العنصر الأساسي والأكبر، + Canvas المسقط فوقه ================= */}
      <div style={{ ...cardStyle, padding: "0.6rem" }}>
        <div ref={wrapRef} style={{ position: "relative", width: "100%", height: CHART_H }}>
          <div ref={containerRef} style={{ width: "100%", height: CHART_H }} />
          <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
        </div>
      </div>

      {/* ================= 3) ANALYSIS PANEL + SEQUENCE PROJECTION ================= */}
      <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
        <AnalysisPanel result={result} />
        <TradePlanCard result={result} symbol={symbol} />
      </div>
    </div>
  );
}

/* ============================================================================
   رسم Canvas 1: تاريخ الـ Sequence (A→B→C + المستويات الداخلية) — بامتداد محدود
   فقط ضمن نطاق الساق AB، وبدون تغيير أي منطق حساب (القيم جاهزة من sequence.js)
   ============================================================================ */
function drawSequenceHistory(ctx, seq, timeToX, priceToY, lastX, ease) {
  const { points, internalLevels } = seq;
  const ax = timeToX(points.A.time);
  const bx = timeToX(points.B.time);
  const cx = timeToX(points.C.time);
  const ay = priceToY(points.A.price);
  const by = priceToY(points.B.price);
  const cy = priceToY(points.C.price);
  if ([ax, bx, cx, ay, by, cy].some((v) => v == null)) return;

  ctx.save();
  ctx.globalAlpha = ease;

  // خط الحركة A→B→C (رفيع، ذهبي خافت)
  ctx.strokeStyle = `#3D2F63`;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.stroke();

  // النقاط + Labels
  [
    ["A", ax, ay],
    ["B", bx, by],
    ["C", cx, cy],
  ].forEach(([label, x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = GOLD_LIGHT;
    ctx.fill();
    ctx.font = "600 10px sans-serif";
    ctx.fillStyle = "#F5F3FF";
    ctx.fillText(label, x - 3, y - 8);
  });

  // المستويات الداخلية (0.333..0.786) — خط قصير بعرض الساق AB فقط، مش كامل الشارت
  const x0 = Math.min(ax, bx);
  const x1 = Math.max(bx, cx, lastX); // تمتد لحد آخر شمعة كحد أقصى (مش أبعد)
  ctx.font = "500 9.5px sans-serif";
  for (const lvl of internalLevels || []) {
    const y = priceToY(lvl.price);
    if (y == null) continue;
    ctx.strokeStyle = `${NEUTRAL}40`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `${NEUTRAL}cc`;
    ctx.fillText(lvl.ratio.toFixed(3), x0 + 3, y - 3);
  }

  ctx.restore();
}

/* ============================================================================
   رسم Canvas 2: منطقة المسقط (Trade/Sequence Projection Zone) — يمين آخر شمعة
   ENTRY + SL + TP1-4 كنقاط/تكات قصيرة موصولة بخط عمودي رفيع (٤/٩)، بدون أي
   خط يمتد عبر الشارت. بيشتغل بغض النظر عن الفريم المعروض (مستوى سعري بس).
   ============================================================================ */
function drawProjection(ctx, r, priceToY, lastX, chartW, chartH, ease) {
  const ready = r.tradeValid && r.entry != null && r.stopLoss != null;

  // لسا الشروط ما اكتملت: نكتفي بأي حالة انتظار — ما في داعي نرسم مسقط فاضي
  if (!ready) return;

  const targets = r.targets || [];
  const dir = r.direction; // 'up' | 'down'
  const entryY = priceToY(r.entry);
  const slY = priceToY(r.stopLoss);
  if (entryY == null || slY == null) return;

  const margin = 14;
  const maxX = chartW - 8;
  const availableW = Math.max(60, maxX - (lastX + margin));
  const rank = ["ENTRY", "SL", ...targets.map((t) => t.key)];
  const step = Math.min(46, availableW / Math.max(1, rank.length));

  let cursorX = lastX + margin;
  const entryX = cursorX;
  cursorX += step;
  const slX = cursorX;

  ctx.save();
  ctx.globalAlpha = ease;

  // العمود الرأسي الرفيع اللي يوصل بين آخر شمعة ومنطقة المسقط
  ctx.strokeStyle = `#3D2F63`;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(lastX, entryY);
  ctx.lineTo(entryX, entryY);
  ctx.stroke();
  ctx.setLineDash([]);

  // -------- ENTRY --------
  drawLevelTick(ctx, entryX, entryY, GOLD_LIGHT, "ENTRY", fmt(r.entry), null, false);

  // -------- STOP LOSS (خط قصير من نقطة الدخول، مش خط طويل) --------
  ctx.strokeStyle = `${RED}aa`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(entryX, entryY);
  ctx.lineTo(entryX, slY);
  ctx.stroke();
  const riskPct = (Math.abs(r.entry - r.stopLoss) / r.entry) * 100;
  const slHit = dir === "up" ? false : false; // يُحدَّث فعلياً بمعرفة السعر الحي — راجع ملاحظة أسفل الكرت
  drawLevelTick(ctx, slX, slY, RED, "SL (SMT)", fmt(r.stopLoss), `Risk ${riskPct.toFixed(2)}%`, slHit, true);

  // -------- TP1..TP4 (سلّم صاعد بالمسافة X — كل هدف أبعد شوي عن السابق) --------
  let tpX = slX;
  for (const t of targets) {
    tpX += step;
    const y = priceToY(t.price);
    if (y == null) continue;
    const color = t.color === "green" ? GREEN : BLUE;
    const rr = Math.abs(t.price - r.entry) / Math.abs(r.entry - r.stopLoss);
    drawLevelTick(ctx, tpX, y, color, t.key, `${t.ratio} Fib  •  ${fmt(t.price)}`, `RR 1:${rr.toFixed(2)}`, t.hit, true, t.hit);
  }

  ctx.restore();
}

/* تِك قصير + Label بستايل Glass/Premium (٥/٧) — دايرة صغيرة + خط قصير + صندوق شفاف مدوّر */
function drawLevelTick(ctx, x, y, color, title, line1, line2, glow) {
  // خط أفقي قصير جداً (14px) بدل خط عبر الشارت
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - 7, y);
  ctx.lineTo(x + 7, y);
  ctx.stroke();

  if (glow) {
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.strokeStyle = `${color}55`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // صندوق Label زجاجي مدوّر
  const boxX = x + 12;
  const lines = line2 ? [title, line1, line2] : [title, line1];
  ctx.font = "700 10.5px sans-serif";
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const boxW = textW + 16;
  const boxH = lines.length * 13 + 8;
  const boxY = y - boxH / 2;

  ctx.fillStyle = "rgba(20,22,26,0.88)";
  ctx.strokeStyle = `${color}77`;
  ctx.lineWidth = 1;
  roundRect(ctx, boxX, boxY, boxW, boxH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.font = "700 10.5px sans-serif";
  ctx.fillStyle = color;
  ctx.fillText(title, boxX + 8, boxY + 12);
  ctx.font = "500 9.5px sans-serif";
  ctx.fillStyle = "#F5F3FF";
  if (line1) ctx.fillText(line1, boxX + 8, boxY + 25);
  if (line2) {
    ctx.fillStyle = "#A79FC4";
    ctx.fillText(line2, boxX + 8, boxY + 37);
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

function fmt(n) {
  if (n == null) return "—";
  return n >= 100 ? n.toFixed(2) : n.toFixed(4);
}

/* -------- Score Badge -------- */
function ScoreBadge({ score, status }) {
  const STATUS_COLOR = { green: GREEN, orange: "#F0A13C", yellow: "#F0A13C", red: RED, gray: "#6E6690" };
  const color = STATUS_COLOR[status] || "#6E6690";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        background: "#141024",
        border: `1px solid ${color}40`,
        borderRadius: 3,
        padding: "5px 10px",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      <span style={{ fontSize: 10.5, color: "#6E6690" }}>QAIS Score</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#F5F3FF" }}>{score}/100</span>
    </div>
  );
}

/* ================= لوحة التحليل — نفس ترتيب البند الثامن عشر بالضبط:
   TREND → STRUCTURE → PRICE LOCATION → POI → SMT → OB → ENTRY MODEL → STATUS ================= */
function AnalysisPanel({ result: r }) {
  const [open, setOpen] = useState(true);
  const [openRow, setOpenRow] = useState(null);

  const poi = r?.poi?.touchedZone;
  const rd = r?.readiness ?? null;

  /* ============================================================================
     ⚠️ الصفوف انبنت من جديد على **خريطة الشروط** (٢٠٢٦-٠٨-٢٠).

     كانت ثمانية صفوف مكتوبة بالإيد على حقول `decision.js`: `priceLocation`
     (Premium/Discount) و`ob.status` و`smt.valid` و`status` و`score`. المحرك
     ذاك انشال، وآخر صف كان بيقول «QAIS Score: ‎/100» — رقم من مجموع موزون.

     هلق الصفوف بتيجي من `readiness.rows` نفسها: كل سطر شرط بالمنهجية إله
     معرّف (R3 · R4 · …) وحالة، والصفان الأولان (الاتجاه والسلّم) بيضلوا
     لأنهم سياق مقيس مش شرط دخول.
     ============================================================================ */
  const CONTEXT_ROWS = r
    ? [
        {
          key: "trend",
          ok: r.direction != null,
          name: "TREND",
          result: r.direction === "up" ? "Bullish" : r.direction === "down" ? "Bearish" : "—",
          color: r.direction === "up" ? GREEN : r.direction === "down" ? RED : "#6E6690",
          detail: "الاتجاه المعتمد من الفريم الرئيسي — ما بيتغيّر إلا بحدث MSS.",
        },
        {
          key: "structure",
          ok: !!r.structureLadder?.length,
          name: "STRUCTURE",
          result: r.mainTimeframe ? TF_LABELS[r.mainTimeframe] : "—",
          color: "#ddd",
          detail:
            (r.structureLadder || [])
              .map((s) => `${TF_LABELS[s.timeframe]}: ${s.trend === "up" ? "Bullish" : s.trend === "down" ? "Bearish" : "—"} (${s.role})`)
              .join("  •  ") || "لا توجد بيانات هيكلية كافية.",
        },
        {
          key: "poi",
          ok: !!poi,
          name: "POI",
          result: poi ? poi.type : "—",
          color: "#ddd",
          detail: poi
            ? `آخر بركة سيولة كنسها السعر عند ${poi.level} — والباقي ${r.poi?.rankedZones?.length ?? 0} بركة.`
            : "ما في كنسة سيولة مسجّلة بعد على الفريم الرئيسي.",
        },
      ]
    : [];

  /* كل شرط بالخريطة = صف. `pending` مش فشل — هو «لسا». */
  const CONDITION_ROWS = (rd?.rows ?? []).map((x) => ({
    key: x.id,
    ok: x.state === "met",
    name: `${x.id} · ${x.label}`,
    result: x.state === "met" ? "تحقق" : x.state === "pending" ? "لسا" : "ما انقاس",
    color: x.state === "met" ? GREEN : x.state === "pending" ? "#F0A13C" : "#6E6690",
    detail: x.note || x.detail,
  }));

  const rows = r
    ? [
        ...CONTEXT_ROWS,
        ...CONDITION_ROWS,
        {
          key: "status",
          ok: !!r.tradeValid,
          name: "STATUS",
          result: r.tradeValid ? "Valid Setup" : rd?.waitingFor ? `بانتظار ${rd.waitingFor}` : "No Setup",
          color: r.tradeValid ? GREEN : "#6E6690",
          /* ⚠️ كان «QAIS Score: ‎/100». صار عدّ صريح. */
          detail: rd?.metCount != null ? `${rd.metCount} من ${rd.totalCount} شرط تحقق` : "الخريطة غير قابلة للتقييم بالبيانات الحالية.",
        },
      ]
    : [];

  return (
    <div style={{ ...cardStyle, flex: 1, minWidth: 300, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: "0.85rem 1.1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "#F5F3FF" }}>التحليل — QAIS Decision Engine</span>
        {open ? <ChevronDown size={16} color={GOLD} /> : <ChevronRight size={16} color="#6E6690" />}
      </button>

      {open && (
        <div style={{ padding: "0 1.1rem 0.9rem" }}>
          {!r ? (
            <div style={{ color: "#6E6690", fontSize: 12.5, padding: "0.5rem 0" }}>جاري تحميل التحليل...</div>
          ) : (
            rows.map((row) => (
              <div key={row.key} style={{ borderTop: "1px solid #141024" }}>
                <button
                  onClick={() => setOpenRow((k) => (k === row.key ? null : row.key))}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    padding: "9px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    cursor: "pointer",
                    textAlign: "right",
                  }}
                >
                  <span style={{ color: row.ok ? GREEN : "#4A4368", fontSize: 13 }}>{row.ok ? "✓" : "○"}</span>
                  <span style={{ fontSize: 12.5, color: "#ddd", flex: 1 }}>{row.name}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: row.color }}>{row.result}</span>
                  <ChevronRight
                    size={13}
                    color="#4A4368"
                    style={{ transform: openRow === row.key ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
                  />
                </button>
                {openRow === row.key && row.detail && (
                  <div style={{ fontSize: 11.5, color: "#6E6690", lineHeight: 1.6, padding: "0 22px 10px" }}>{row.detail}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ================= SEQUENCE PROJECTION CARD — نفس بيانات الرسم على الشارت،
   Direction/Entry/SL/TP1-4 كل وحدة بـ Fib ratio + السعر + RR (٩) ================= */
function TradePlanCard({ result: r, symbol }) {
  const [open, setOpen] = useState(true);
  if (!r) return null;

  const ready = r.tradeValid && r.entry != null && r.stopLoss != null;
  const riskPercent = ready ? (Math.abs(r.entry - r.stopLoss) / r.entry) * 100 : null;

  function exportAnalysis() {
    const lines = [
      `QAIS SK ENGINE — ${symbol}`,
      `التاريخ: ${new Date().toLocaleString("ar-EG")}`,
      `الشروط: ${r.readiness?.metCount ?? "—"}/${r.readiness?.totalCount ?? "—"} | Entry Status: ${r.entryStatus}`,
      `Direction: ${r.direction || "—"}`,
      `Main TF: ${r.mainTimeframe || "—"} | Execution TF: ${r.executionTimeframe || "—"}`,
      `Entry: ${r.entry ?? "—"} | Stop Loss: ${r.stopLoss ?? "—"} (SMT)`,
      `Targets: ${(r.targets || []).map((t) => `${t.key} (${t.ratio} Fib)=${t.price.toFixed(2)}`).join(" | ") || "—"}`,
      `الشروط المتحققة: ${(r.readiness?.rows || []).filter((x) => x.state === "met").map((x) => x.id).join(" + ") || "—"}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qais-analysis-${symbol}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ ...cardStyle, width: 290, flexShrink: 0, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: "0.85rem 1.1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "#F5F3FF", display: "flex", alignItems: "center", gap: 8 }}>
          SEQUENCE PROJECTION
          {ready && <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN }} />}
        </span>
        {open ? <ChevronDown size={16} color={GOLD} /> : <ChevronRight size={16} color="#6E6690" />}
      </button>

      {open && (
        <div style={{ padding: "0 1.1rem 1rem" }}>
          {ready ? (
            <>
              <PlanRow label="Direction" value={r.direction === "up" ? "BUY" : "SELL"} color={r.direction === "up" ? GREEN : RED} />
              <PlanRow label="Entry" value={fmt(r.entry)} color={GOLD_LIGHT} />
              <PlanRow label="Stop Loss (SMT)" value={fmt(r.stopLoss)} color={RED} />
              <PlanRow label="Risk %" value={`${riskPercent.toFixed(2)}%`} />
              <div style={{ height: 6 }} />
              {r.targets?.map((t) => (
                <PlanRow
                  key={t.key}
                  label={`${t.key} — ${t.ratio} Fib`}
                  value={fmt(t.price)}
                  color={t.color === "green" ? GREEN : BLUE}
                  strong={t.hit}
                />
              ))}
              <button
                onClick={exportAnalysis}
                style={{
                  marginTop: 10,
                  width: "100%",
                  background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
                  border: "none",
                  color: "#0E0A1A",
                  fontWeight: 700,
                  borderRadius: 3,
                  padding: "8px 0",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >تصدير
              </button>
            </>
          ) : (
            <div style={{ fontSize: 11.5, color: "#6E6690", lineHeight: 1.7, padding: "4px 0" }}>
              لسا ما اكتمل الإعداد — رح تظهر Entry وStop Loss والأهداف تلقائياً (على الشارت وهون) لما تتحقق كل شروط الدخول (تاسعاً).
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlanRow({ label, value, color, strong }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "5px 0",
        borderBottom: "1px solid #1C1630",
        background: strong ? `${GREEN}14` : "transparent",
      }}
    >
      <span style={{ fontSize: 11.5, color: "#6E6690" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: color || "#F5F3FF" }}>{value}</span>
    </div>
  );
}
