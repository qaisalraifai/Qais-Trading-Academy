"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Activity,
  Box,
  Layers3,
  ShieldAlert,
  Target,
  Zap,
  Waves,
  Radar,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { ASSETS, getAssetByValue } from "@/lib/assets";
import { analyzeSymbol } from "@/lib/qais/engine";

/* ============================================================================
   QaisEngineView — تبويب "QAIS SK Engine" المستقل. شارت حي + محرك القرار كامل.

   ملاحظة تصميم مهمة: كل طبقات QAIS (FVG/OB/BRKR/Void/BOS/MSS/Sweep/RJB) بتترسم
   دايماً على *نفس فريم الشارت المعروض حالياً* (M15/H1/H4 — اختيار المستخدم)،
   مش على فريم تنفيذ ثابت، عشان تضمن دقة إحداثيات 100% بين التحليل والرسم.
   اتجاه التحيّز العام (Daily Trend) بيُحسب دايماً من فريم Daily الحقيقي بغض
   النظر عن فريم العرض، تماماً متل الموجود بالتصميم.
   ============================================================================ */

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2D57E";
const GREEN = "#02C076";
const RED = "#F6465D";
const BLUE = "#4f7cff";

const cardStyle = {
  background: "linear-gradient(145deg, #22252B, #181A20)",
  border: `1px solid ${GOLD}26`,
  borderRadius: 14,
  boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
};

const TF_OPTIONS = [
  { value: "15min", label: "M15" },
  { value: "1h", label: "H1" },
  { value: "4h", label: "H4" },
];

/* ألوان أدوات QAIS — نفس الألوان مستخدمة بزر التفعيل وبرسم الطبقة على الشارت */
const TOOL_COLORS = {
  Structure: "#c9c9c9",
  FVG: "#9b59b6",
  OB: BLUE,
  BRKR: RED,
  MTG: "#f97316",
  RJB: "#f59e0b",
  Sweep: "#22d3ee",
  SMT: "#22d3ee",
};

/* الحد الأدنى لعلاقة المخاطرة/العائد عشان نعتبر الصفقة صالحة للعرض/التنفيذ.
   أي إعداد أقل من 1:3 (حتى لو باقي الشروط محققة) ما بنعرضه كصفقة جاهزة —
   بس بنخلي شريط الفحص وتفاصيل POI/SMT/OB زي ما هي للتوعية. */
const MIN_RR = 3;

/* أيقونة صغيرة لكل أداة — بدل النص فقط، عشان الـ toolbar يصير أنيق ومضغوط */
const TOOL_ICONS = {
  Structure: Activity,
  FVG: Box,
  OB: Layers3,
  BRKR: ShieldAlert,
  MTG: Target,
  RJB: Zap,
  Sweep: Waves,
  SMT: Radar,
};


function computeTradeMetrics(decision) {
  const ob = decision?.ob;
  const seq = decision?.sequence;
  const entry = ob?.eligible ? ob.levels.mt : null;
  const stopLoss = ob?.eligible ? ob.levels.level4 : null;
  const tp1 = seq?.active ? seq.targets[0]?.price : null;
  const rr = entry != null && stopLoss != null && tp1 != null ? Math.abs(tp1 - entry) / Math.abs(entry - stopLoss) : null;
  const meetsRR = rr != null && rr >= MIN_RR;
  const riskPercent = entry != null && stopLoss != null ? (Math.abs(entry - stopLoss) / entry) * 100 : null;
  return { entry, stopLoss, tp1, rr, meetsRR, riskPercent };
}

function sessionNow() {
  const h = new Date().getUTCHours();
  if (h >= 8 && h < 16) return "London";
  if (h >= 13 && h < 21) return "New York";
  if (h >= 0 && h < 8) return "Asia";
  return "Overlap";
}

async function fetchCandles(yahoo, interval, count = 300) {
  const res = await fetch(`/api/replay-candles?symbol=${encodeURIComponent(yahoo)}&interval=${interval}&count=${count}`);
  const data = await res.json();
  return data.candles || [];
}

export default function QaisEngineView() {
  const [symbol, setSymbol] = useState("XAUUSD");
  const [displayTF, setDisplayTF] = useState("1h");
  /* Structure (فيبوناتشي + نقاط A/B/C) وOB (المنطقة + خط MT) مفعّلين افتراضياً —
     هدول أساس أي تحليل يدوي على TradingView، فما لازم يضل المستخدم يفعّلهم يدوياً
     كل مرة. باقي الأدوات (FVG/BRKR/MTG/RJB/Sweep/SMT) اختيارية عشان نتجنب
     ازدحام الشارت بمربعات كتير فوق بعض ("عجقة"). */
  const [activeTools, setActiveTools] = useState({ Structure: true, OB: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // نتيجة analyzeSymbol كاملة
  const [candles, setCandles] = useState([]); // شموع فريم العرض (نفس فريم التحليل)

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const resultRef = useRef(null);
  const activeToolsRef = useRef(activeTools);
  useEffect(() => {
    activeToolsRef.current = activeTools;
  }, [activeTools]);
  const drawOverlayRef = useRef(() => {});
  useEffect(() => {
    drawOverlayRef.current = drawOverlay;
  });

  const asset = getAssetByValue(symbol);

  /* ===================== جلب البيانات + تشغيل محرك QAIS ===================== */
  const runAnalysis = useCallback(async () => {
    if (!asset?.yahoo) return;
    setLoading(true);
    setError("");
    try {
      const [dailyCandles, h1Candles, displayCandles] = await Promise.all([
        fetchCandles(asset.yahoo, "1day", 300),
        fetchCandles(asset.yahoo, "1h", 300),
        displayTF === "1h" ? Promise.resolve(null) : fetchCandles(asset.yahoo, displayTF, 300),
      ]);
      const execCandles = displayTF === "1h" ? h1Candles : displayCandles;

      if (!execCandles || execCandles.length < 30) {
        throw new Error("بيانات غير كافية من مزوّد الأسعار لهذا الفريم حالياً");
      }

      const analysis = analyzeSymbol({
        symbol,
        candlesByTF: { h4: dailyCandles, h1: h1Candles, m15: execCandles },
      });

      if (analysis.error) throw new Error(analysis.error);

      setCandles(execCandles);
      setResult(analysis);
      resultRef.current = analysis;
    } catch (e) {
      setError(e.message || "فشل تشغيل محرك التحليل");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, displayTF]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  /* ===================== إنشاء الشارت مرة وحدة ===================== */
  useEffect(() => {
    let cancelled = false;
    async function setup() {
      const { createChart, CrosshairMode, LineStyle } = await import("lightweight-charts");
      if (cancelled || !containerRef.current) return;

      const chart = createChart(containerRef.current, {
        layout: { background: { color: "#181A20" }, textColor: "#d1d4dc" },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.04)" },
          horzLines: { color: "rgba(255,255,255,0.04)" },
        },
        timeScale: { borderColor: "#3a3a3a", timeVisible: true, secondsVisible: false, rightOffset: 8 },
        rightPriceScale: { borderColor: "#3a3a3a" },
        width: containerRef.current.clientWidth,
        height: 520,
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

      const redraw = () => drawOverlayRef.current();
      chart.timeScale().subscribeVisibleTimeRangeChange(redraw);

      const handleResize = () => {
        if (!containerRef.current) return;
        chart.applyOptions({ width: containerRef.current.clientWidth });
        if (canvasRef.current) {
          canvasRef.current.width = containerRef.current.clientWidth;
          canvasRef.current.height = 520;
        }
        redraw();
      };
      window.addEventListener("resize", handleResize);
      handleResize();

      return () => {
        window.removeEventListener("resize", handleResize);
        chart.remove();
      };
    }
    const cleanupPromise = setup();
    return () => {
      cancelled = true;
      cleanupPromise?.then((fn) => fn && fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===================== تحديث الشموع + الطبقات كل ما تجدد التحليل ===================== */
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    seriesRef.current.setData(candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
    chartRef.current?.timeScale().fitContent();
    applyPriceLinesAndMarkers();
    drawOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, result]);

  useEffect(() => {
    drawOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTools]);

  /* -------- TP1-4: خطوط سعر أفقية جاهزة بمحرك lightweight-charts نفسه --------
     (BOS/MSS/Sweep/RJB بترتسم عبر canvas overlay بدالة drawOverlay بالأسفل، عشان
     نضمن نفس دقة الإحداثيات المستخدمة لصناديق FVG/OB/BRKR) */
  const priceLinesRef = useRef([]);
  function applyPriceLinesAndMarkers() {
    const series = seriesRef.current;
    if (!series) return;
    // TP1-4 ما عادوا يترسموا كـ price lines تمتد بعرض الشارت كامل (كانت بتتراكب
    // فوق الشموع القديمة) — صاروا يترسموا عبر drawOverlay() بالمساحة الفاضية
    // يمين آخر شمعة بس، ونفس منطق drawOverlay هو اللي يقرر إذا الصفقة تستاهل
    // تُعرض أصلاً (لازم تحقق 1:3 RR على الأقل — شوف MIN_RR/computeTradeMetrics).
    priceLinesRef.current.forEach((pl) => series.removePriceLine(pl));
    priceLinesRef.current = [];
  }


  /* ===================== رسم صناديق FVG/OB/BRKR/Void (Canvas overlay) ===================== */
  function drawOverlay() {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;
    const container = containerRef.current;
    if (!canvas || !chart || !series || !container || !rawLayersRef.current) return;

    // تأكيد إنه حجم الـ canvas مطابق فعلياً لحجم الحاوية الحالي — هاد بيصلح حالة
    // كان فيها العرض 0 لحظة أول resize لأنه اللايوت لسا ما استقر يومتها
    // (بعدها ما كان في شي يصحح الحجم إلا تغيير حجم نافذة المتصفح يدوياً)
    const targetW = container.clientWidth;
    const targetH = 520;
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const ts = chart.timeScale();
    const active = activeToolsRef.current;
    const layers = rawLayersRef.current;

    /* تسمية "مسطّحة" — نص ملون بس مع ظل غامق خفيف للوضوح فوق الشموع، بدون
       شريحة/چيب بخلفية مصمتة. هاد أقرب لأسلوب الرسم اليدوي على TradingView
       (نص + خط، مش صندوق UI فوق صندوق) وبيقلل "العجقة" لما أكتر من أداة تكون
       مفعّلة بنفس الوقت وتتقاطع مربعاتها. */
    const flatLabel = (x, y, text, color, align = "left") => {
      ctx.font = "600 11px sans-serif";
      ctx.textAlign = align;
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      ctx.shadowBlur = 0;
      ctx.textAlign = "left";
    };

    const drawZone = (zone, color, label, on) => {
      if (!on) return;
      const lo = zone.from ?? zone.level;
      const hi = zone.to ?? zone.level;
      if (lo == null) return;
      const c1 = candles[zone.index];
      if (!c1) return;
      const x1 = ts.timeToCoordinate(c1.time);
      const lastCandle = candles[candles.length - 1];
      const x2 = ts.timeToCoordinate(lastCandle.time) + 26;
      const y1 = series.priceToCoordinate(hi);
      const y2 = series.priceToCoordinate(lo);
      if (x1 == null || x2 == null || y1 == null || y2 == null) return;

      ctx.fillStyle = color + "16";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      flatLabel(x1 + 2, Math.min(y1, y2) - 5, label, color);
    };


    const drawPOIHighlight = (zone, obZone) => {
      if (!zone) return;
      const lo = zone.from ?? zone.level;
      const hi = zone.to ?? zone.level;
      if (lo == null) return;
      const c1 = candles[zone.index];
      if (!c1) return;
      const x1 = ts.timeToCoordinate(c1.time);
      const lastCandle = candles[candles.length - 1];
      const x2 = ts.timeToCoordinate(lastCandle.time) + 26;
      const y1 = series.priceToCoordinate(hi);
      const y2 = series.priceToCoordinate(lo === hi ? lo - 1 : lo); // خط سعر واحد (Sweep/RJB) بياخد سماكة بسيطة عشان يبين
      if (x1 == null || x2 == null || y1 == null || y2 == null) return;

      // لو منطقة الـ OB (المرسومة أصلاً فوق) بتغطي نفس مدى السعر تقريباً، ما
      // منرسم صندوق تاني فوقها — هاد كان السبب الرئيسي للعجقة (صندوقين + تسميتين
      // فوق نفس المنطقة). منكتفي بنجمة صغيرة بجانب تسمية OB تأكيد إنها منطقة القرار.
      if (obZone) {
        const [oLo, oHi] = [Math.min(obZone.from, obZone.to), Math.max(obZone.from, obZone.to)];
        const [zLo, zHi] = [Math.min(lo, hi), Math.max(lo, hi)];
        const overlaps = zLo <= oHi && zHi >= oLo;
        if (overlaps) return;
      }

      ctx.save();
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x1 - 2, Math.min(y1, y2) - 2, x2 - x1 + 4, Math.abs(y2 - y1) + 4);
      ctx.setLineDash([]);
      ctx.restore();

      flatLabel(x1, Math.min(y1, y2) - 6, `★ POI (${zone.type})`, GOLD);
    };

    for (const z of layers.fvgs) drawZone(z, TOOL_COLORS.FVG, "FVG", active.FVG);
    for (const z of layers.voids) drawZone(z, "#7c3aed", "Void", active.FVG);
    for (const z of layers.brkr) drawZone(z, TOOL_COLORS.BRKR, "BRKR", active.BRKR);
    for (const z of layers.mtg) drawZone(z, TOOL_COLORS.MTG, "MTG", active.MTG);

    let obZoneBounds = null; // بنستخدمها تحت لمنع تكرار صندوق POI فوق نفس منطقة الـ OB
    if (layers.ob?.eligible) {
      const { level1, level2 } = layers.ob.levels;
      const hi = level1 ?? level2;
      const lo = layers.ob.merged.low;
      obZoneBounds = { from: lo, to: hi };
      const obLabel = `OB${layers.ob.direction === "down" ? "-" : "+"}`;
      drawZone({ from: lo, to: hi, index: layers.ob.index }, TOOL_COLORS.OB, obLabel, active.OB);
      // خط الـ MT (منتصف OB) — أقوى مستوى بالمنطقة، بنفس تسمية التحليل اليدوي "MT"
      const c1 = candles[layers.ob.index];
      if (c1 && active.OB) {
        const x1 = ts.timeToCoordinate(c1.time);
        const lastCandle = candles[candles.length - 1];
        const x2 = ts.timeToCoordinate(lastCandle.time) + 26;
        const ym = series.priceToCoordinate(layers.ob.levels.mt);
        if (x1 != null && x2 != null && ym != null) {
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = "#e5e5e5";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x1, ym);
          ctx.lineTo(x2, ym);
          ctx.stroke();
          ctx.setLineDash([]);
          flatLabel(x2 + 4, ym + 4, "MT", "#e5e5e5");
        }
      }
    }

    // خطوط الهيكلية BOS/MSS (خط أفقي قصير من نقطة الكسر لآخر شمعة) + Sweep/RJB كنقاط
    // مانع تصادم للتسميات: كل تسمية جديدة بتفحص هل بتتقاطع (نفس منطقة x وy) مع
    // تسمية سبق رسمها بهاد الفريم، ولو في تقاطع بتزحها لفوق بمقدار ثابت لحد ما
    // تلاقي مكان فاضي — هاد يمنع تكدّس BOS/MSS/Sweep/RJB فوق بعض لما يكونوا قريبين
    // من نفس المنطقة الزمنية والسعرية (شائع لأنهم مأخوذين من آخر شموع الشارت).
    const placedLevelLabels = [];
    const LABEL_H = 14;
    function placeLevelLabel(x, y, text, color) {
      ctx.font = "600 11px sans-serif";
      const w = ctx.measureText(text).width + 6;
      let ly = y - 6;
      for (let attempt = 0; attempt < 14; attempt++) {
        const top = ly - 15;
        const bottom = ly + 3;
        const collides = placedLevelLabels.some(
          (b) => x < b.x2 && x + w > b.x1 && top < b.bottom && bottom > b.top
        );
        if (!collides) break;
        ly -= LABEL_H; // كل محاولة بتزح التسمية درجة لفوق
      }
      placedLevelLabels.push({ x1: x, x2: x + w, top: ly - 15, bottom: ly + 3 });
      flatLabel(x, ly - 1, text, color);
    }

    const drawLevelLine = (ev, color, label, on) => {
      if (!on) return;
      const c1 = candles[ev.index];
      if (!c1) return;
      const x1 = ts.timeToCoordinate(c1.time);
      const lastCandle = candles[candles.length - 1];
      const x2 = ts.timeToCoordinate(lastCandle.time) + 26;
      const y = series.priceToCoordinate(ev.level ?? ev.price);
      if (x1 == null || x2 == null || y == null) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
      placeLevelLabel(x1, y, label, color);
    };

    for (const ev of layers.structureEvents) {
      drawLevelLine(ev, ev.type === "BOS" ? GREEN : "#e5e5e5", ev.type, active.Structure);
    }
    for (const sw of layers.sweeps) drawLevelLine({ ...sw, level: sw.level }, TOOL_COLORS.Sweep, "Sweep", active.Sweep);
    for (const r of layers.rjb) drawLevelLine(r, TOOL_COLORS.RJB, "RJB", active.RJB);

    // منطقة الاهتمام (POI) الفعلية يلي اعتمدها محرك القرار — دايماً تترسم لو موجودة
    // بغض النظر عن حالة أزرار QAIS TOOLS، لأنها أساس القرار مش أداة استكشاف اختيارية.
    // بنمرر حدود صندوق الـ OB عشان drawPOIHighlight يتجنب رسم صندوق مكرر فوقه.
    drawPOIHighlight(layers.poi, obZoneBounds);

    // -------- نقاط A/B/C + خطوط فيبوناتشي الارتداد (زي أسلوب التحليل اليدوي) --------
    // دي أهم إشارة بصرية ناقصة قبل هيك: بتوضح للمستخدم *ليش* اتحدد الهدف من نقطة C،
    // وشو نسبة التصحيح اللي حصلت من الساق A-B، بالضبط متل الخطوط السودة بالمرجع.
    const seqPoints = resultRef.current?.sequence?.points;
    if (seqPoints && active.Structure) {
      const { A, B, C } = seqPoints;
      const FIB_LEVELS = [0.333, 0.5, 0.666];
      const legLength = Math.abs(B.price - A.price);
      const lastCandle = candles[candles.length - 1];
      const xEnd = ts.timeToCoordinate(lastCandle.time) + 26;

      const markSwing = (point, tag) => {
        const x = ts.timeToCoordinate(point.time);
        const y = series.priceToCoordinate(point.price);
        if (x == null || y == null) return;
        ctx.fillStyle = "#e5e5e5";
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = "#e5e5e5";
        ctx.fillText(`(${tag})`, x - 6, point.type === "high" || tag === "B" ? y - 8 : y + 16);
      };
      markSwing(A, "A");
      markSwing(B, "B");
      markSwing(C, "C");

      const xA = ts.timeToCoordinate(A.time);
      if (xA != null) {
        for (const ratio of FIB_LEVELS) {
          const price = B.price - Math.sign(B.price - A.price) * legLength * ratio;
          const y = series.priceToCoordinate(price);
          if (y == null) continue;
          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = "#5a5a5a";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(xA, y);
          ctx.lineTo(xEnd, y);
          ctx.stroke();
          ctx.restore();
          const label = `${ratio} (${price.toFixed(2)})`;
          ctx.font = "10px sans-serif";
          ctx.fillStyle = "#9a9a9a";
          ctx.fillText(label, xEnd - ctx.measureText(label).width - 4, y - 3);
        }
      }
    }

    // -------- TP1-4: بس إذا الصفقة محققة 1:3 RR على الأقل، وبمكان فاضي يمين آخر شمعة --------
    const metrics = computeTradeMetrics(resultRef.current);
    const seq = resultRef.current?.sequence;
    if (seq?.active && metrics.meetsRR && candles.length) {
      const lastCandle = candles[candles.length - 1];
      const xStart = ts.timeToCoordinate(lastCandle.time);
      if (xStart != null) {
        const lineEnd = Math.min(xStart + 90, canvas.width - 60); // يوقف قبل صندوق التسمية
        const boxRight = canvas.width - 6;

        // رتّب الأهداف حسب السعر وامنع تراكب الصناديق عمودياً
        const withY = seq.targets
          .map((t) => ({ t, y: series.priceToCoordinate(t.price) }))
          .filter((o) => o.y != null)
          .sort((a, b) => a.y - b.y);
        const minGap = 16;
        for (let i = 1; i < withY.length; i++) {
          if (withY[i].y - withY[i - 1].y < minGap) withY[i].y = withY[i - 1].y + minGap;
        }

        for (const { t, y } of withY) {
          const color = t.color === "أخضر" ? GREEN : BLUE;
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(xStart, y);
          ctx.lineTo(lineEnd, y);
          ctx.stroke();
          ctx.setLineDash([]);

          const label = `${t.key} ${t.price.toFixed(2)}`;
          ctx.font = "11px sans-serif";
          const textW = ctx.measureText(label).width;
          const boxW = textW + 12;
          ctx.fillStyle = color;
          ctx.fillRect(boxRight - boxW, y - 9, boxW, 18);
          ctx.fillStyle = "#0b0d10";
          ctx.textAlign = "left";
          ctx.fillText(label, boxRight - boxW + 6, y + 4);
        }
      }
    }
  }

  /* الطبقات الخام (fvgs/voids/brkr/mtg/ob/structureEvents/sweeps/rjb) بترجع من محرك lib/qais
     مباشرة عبر إعادة استدعاء الدوال الفرعية على نفس شموع العرض — منخزنها بـ ref لتفادي إعادة حساب مكلفة بكل رندر */
  const rawLayersRef = useRef(null);
  const [debugInfo, setDebugInfo] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (candles.length < 30) return;
      try {
        const { analyzeStructure } = await import("@/lib/qais/structure");
        const { analyzeLiquidity } = await import("@/lib/qais/liquidity");
        const { analyzeOrderBlock } = await import("@/lib/qais/orderblock");
        if (cancelled) return;
        const struct = analyzeStructure(candles);
        const liquidity = analyzeLiquidity(candles, struct);
        const ob = analyzeOrderBlock(candles, struct, liquidity);
        rawLayersRef.current = {
          // بس آخر نسخة فعّالة من كل أداة — مش كل التاريخ القريب. هاد يطابق أسلوب
          // التحليل اليدوي (صورة المرجع): منطقة وحدة واضحة لكل أداة، مش تراكم نسخ قديمة.
          fvgs: liquidity.fvgs.slice(-1),
          voids: liquidity.voids.slice(-1),
          brkr: liquidity.brkr.slice(-1),
          mtg: liquidity.mtg.slice(-1),
          sweeps: liquidity.sweeps.slice(-1),
          rjb: liquidity.rjb.slice(-1),
          structureEvents: struct.events.slice(-2),
          ob,
          poi: liquidity.touchedZone, // منطقة الاهتمام الفعلية يلي اعتمدها محرك القرار
        };
        if (cancelled) return;
        setDebugInfo(
          `FVG:${rawLayersRef.current.fvgs.length} OB:${ob?.eligible ? 1 : 0} MTG:${rawLayersRef.current.mtg.length} BRKR:${rawLayersRef.current.brkr.length} POI:${liquidity.touchedZone ? liquidity.touchedZone.type : "—"} candles:${candles.length}`
        );
        applyPriceLinesAndMarkers();
        drawOverlay();
      } catch (e) {
        // ما كنا نمسك هالخطأ قبل هيك — لو صار استثناء هون كانت الطبقات تختفي
        // بصمت بدون أي أثر بالكونسول، وهاد بالضبط اللي كان يخلي الشارت يطلع فاضي
        console.error("QAIS layers computation failed:", e);
        setDebugInfo(`⚠️ خطأ بحساب الطبقات: ${e?.message || e}`);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

  const decision = result;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {/* ================= 1) TOP HEADER — شريط رفيع، معلومات أساسية فقط ================= */}
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
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f0f0f0", letterSpacing: 0.3 }}>QAIS SK ENGINE</span>
        </div>

        <div style={{ width: 1, height: 20, background: "#2a2a2a" }} />

        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          style={{
            background: "#181A20",
            color: "#e5e5e5",
            border: "1px solid #333",
            borderRadius: 6,
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

        <div style={{ display: "flex", gap: 4 }}>
          {TF_OPTIONS.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setDisplayTF(tf.value)}
              style={{
                background: displayTF === tf.value ? `${GOLD}1f` : "transparent",
                border: `1px solid ${displayTF === tf.value ? GOLD : "#2e2e2e"}`,
                color: displayTF === tf.value ? GOLD_LIGHT : "#888",
                borderRadius: 6,
                padding: "5px 11px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <button
          onClick={runAnalysis}
          disabled={loading}
          style={{
            background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
            border: "none",
            color: "#181A20",
            fontWeight: 700,
            borderRadius: 7,
            padding: "7px 15px",
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          {loading ? "..." : "⚡ AI Analyze"}
        </button>

        <div style={{ marginRight: "auto" }}>
          <ScoreBadge score={decision?.score || 0} />
        </div>
      </div>

      {error && <div style={{ ...cardStyle, padding: "0.7rem 1rem", color: RED, fontSize: 12.5 }}>{error}</div>}

      {/* ================= 2) MAIN AREA — الشارت 75% + Toolbar عمودي رفيع ================= */}
      <div style={{ display: "flex", gap: "0.7rem", alignItems: "stretch" }}>
        <div style={{ ...cardStyle, padding: "0.6rem", flex: 1, minWidth: 0, position: "relative" }}>
          <div ref={containerRef} style={{ width: "100%", height: 560 }} />
          <canvas ref={canvasRef} width={800} height={560} style={{ position: "absolute", top: "0.6rem", left: "0.6rem", pointerEvents: "none", zIndex: 50 }} />
          {debugInfo && (
            <div
              style={{
                position: "absolute",
                bottom: 6,
                left: 6,
                fontSize: 9,
                color: debugInfo.startsWith("⚠️") ? RED : "#5a5a5a",
                background: "rgba(0,0,0,0.4)",
                padding: "2px 5px",
                borderRadius: 4,
                pointerEvents: "none",
                fontFamily: "monospace",
              }}
            >
              {debugInfo}
            </div>
          )}
        </div>

        {/* -------- 3) RIGHT TOOLBAR — أيقونات فقط، تفعيل/إخفاء عند الحاجة -------- */}
        <div style={{ ...cardStyle, padding: "0.6rem", display: "flex", flexDirection: "column", gap: 6, width: 58, flexShrink: 0 }}>
          {Object.keys(TOOL_ICONS).map((key) => {
            const Icon = TOOL_ICONS[key];
            const on = !!activeTools[key];
            return (
              <button
                key={key}
                title={key}
                onClick={() => setActiveTools((p) => ({ ...p, [key]: !p[key] }))}
                style={{
                  background: on ? `${TOOL_COLORS[key]}1f` : "transparent",
                  border: `1px solid ${on ? TOOL_COLORS[key] : "#2a2a2a"}`,
                  color: on ? TOOL_COLORS[key] : "#666",
                  borderRadius: 7,
                  padding: "9px 0",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Icon size={15} strokeWidth={2} />
                <span style={{ fontSize: 8.5, fontWeight: 600 }}>{key}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= 4) ANALYSIS PANEL + 5) TRADE PLAN — قابلين للطي، جنب بعض ================= */}
      <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
        <AnalysisPanel decision={decision} />
        <TradePlanCard decision={decision} symbol={symbol} />
      </div>
    </div>
  );
}

/* -------- Score Badge: شريحة صغيرة أنيقة، مش دائرة ضخمة -------- */
function ScoreBadge({ score }) {
  const color = score >= 85 ? GREEN : score >= 50 ? "#eab308" : RED;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        background: "#14161a",
        border: `1px solid ${color}40`,
        borderRadius: 8,
        padding: "5px 10px",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      <span style={{ fontSize: 10.5, color: "#888" }}>QAIS Score</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#f0f0f0" }}>{score}/100</span>
    </div>
  );
}

/* ================= لوحة التحليل: مطوية افتراضياً، صفوف مختصرة، كل صف يفتح تفاصيله لحاله ================= */
function AnalysisPanel({ decision }) {
  const [open, setOpen] = useState(false);
  const [openRow, setOpenRow] = useState(null);

  const ob = decision?.ob;
  const seq = decision?.sequence;

  const rows = decision
    ? [
        {
          key: "trend",
          ok: decision.direction != null,
          name: "Trend",
          result: decision.direction === "up" ? "Bullish" : decision.direction === "down" ? "Bearish" : "—",
          color: decision.direction === "up" ? GREEN : decision.direction === "down" ? RED : "#888",
          detail: "الإطار المعتمد: Daily / 4H / 1H — التغيير بالاتجاه ما بيصير إلا بعد تأكيد MSS كامل.",
        },
        {
          key: "location",
          ok: !!decision.priceLocation,
          name: "Location",
          result: decision.priceLocation
            ? decision.priceLocation.zone === "discount"
              ? "Discount"
              : decision.priceLocation.zone === "premium"
              ? "Premium"
              : "Equilibrium"
            : "—",
          color: "#ddd",
          detail: decision.priceLocation ? `نسبة الموقع الحالية: ${decision.priceLocation.ratio} — المنطقة المفضّلة بين 0.5 و0.666.` : "لسا ما تحدد موقع السعر بدقة.",
        },
        {
          key: "poi",
          ok: !!decision.ob?.touchedZoneType,
          name: "POI",
          result: decision.ob?.touchedZoneType ? decision.reasonTags?.[0] || decision.ob.touchedZoneType : "—",
          color: "#ddd",
          detail: ob?.eligible
            ? `قوة المنطقة: ${ob.quality >= 70 ? "عالية" : ob.quality >= 40 ? "متوسطة" : "منخفضة"}`
            : "السعر لسا ما وصل لمنطقة اهتمام مؤكدة.",
        },
        {
          key: "smt",
          ok: !!decision.smt?.valid,
          name: "SMT",
          result: decision.smt?.valid ? "Confirmed" : "Not Confirmed",
          color: decision.smt?.valid ? GREEN : "#888",
          detail: decision.smt?.symbolB ? `مقارنة مع: ${decision.smt.symbolB}` : "لسا ما ظهر انحراف SMT واضح بين الأصول المرتبطة.",
        },
        {
          key: "ob",
          ok: !!ob?.eligible && ob.status !== "Invalid",
          name: "OB",
          result: ob?.eligible ? `${ob.status}` : "Not Formed",
          color: ob?.status === "Fresh" || ob?.status === "Active" ? GREEN : ob?.status === "Weak" ? "#eab308" : "#888",
          detail: decision.timeframe ? `${decision.timeframe} • ${ob?.direction === "up" ? "صاعد" : "هابط"}` : "",
        },
        {
          key: "targets",
          ok: !!seq?.active,
          name: "Targets",
          result: seq?.active ? `${seq.targets.length} TPs` : "—",
          color: seq?.active ? GREEN : "#888",
          detail: seq?.active ? seq.targets.map((t) => `${t.key}: ${t.price.toFixed(2)}`).join("  •  ") : seq?.reason || "لا يوجد سيكونز فعّالة بعد.",
        },
      ]
    : [];

  return (
    <div style={{ ...cardStyle, flex: 1, minWidth: 280, overflow: "hidden" }}>
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
        <span style={{ fontSize: 13, fontWeight: 700, color: "#f0f0f0" }}>التحليل — QAIS Decision Engine</span>
        {open ? <ChevronDown size={16} color={GOLD} /> : <ChevronRight size={16} color="#666" />}
      </button>

      {open && (
        <div style={{ padding: "0 1.1rem 0.9rem" }}>
          {!decision ? (
            <div style={{ color: "#777", fontSize: 12.5, padding: "0.5rem 0" }}>جاري تحميل التحليل...</div>
          ) : (
            rows.map((r) => (
              <div key={r.key} style={{ borderTop: "1px solid #23262d" }}>
                <button
                  onClick={() => setOpenRow((k) => (k === r.key ? null : r.key))}
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
                  <span style={{ color: r.ok ? GREEN : "#555", fontSize: 13 }}>{r.ok ? "✓" : "○"}</span>
                  <span style={{ fontSize: 12.5, color: "#ddd", flex: 1 }}>{r.name}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: r.color }}>{r.result}</span>
                  <ChevronRight
                    size={13}
                    color="#555"
                    style={{ transform: openRow === r.key ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
                  />
                </button>
                {openRow === r.key && r.detail && (
                  <div style={{ fontSize: 11.5, color: "#888", lineHeight: 1.6, padding: "0 22px 10px" }}>{r.detail}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ================= بطاقة خطة الصفقة: مطوية افتراضياً، أرقام فقط عند الفتح ================= */
function TradePlanCard({ decision, symbol }) {
  const [open, setOpen] = useState(false);
  if (!decision) return null;

  const seq = decision.sequence;
  const { entry, stopLoss, rr, meetsRR, riskPercent } = computeTradeMetrics(decision);
  const ready = entry && stopLoss && meetsRR;

  function exportAnalysis() {
    const lines = [
      `QAIS SK ENGINE — ${symbol}`,
      `التاريخ: ${new Date().toLocaleString("ar-EG")}`,
      `Score: ${decision.score}/100`,
      `Direction: ${decision.direction || "—"}`,
      `Entry: ${entry ?? "—"} | Stop Loss: ${stopLoss ?? "—"}`,
      `Reasons: ${(decision.reasonTags || []).join(" + ")}`,
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
    <div style={{ ...cardStyle, width: 280, flexShrink: 0, overflow: "hidden" }}>
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
        <span style={{ fontSize: 13, fontWeight: 700, color: "#f0f0f0", display: "flex", alignItems: "center", gap: 8 }}>
          Trade Plan
          {ready && <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN }} />}
        </span>
        {open ? <ChevronDown size={16} color={GOLD} /> : <ChevronRight size={16} color="#666" />}
      </button>

      {open && (
        <div style={{ padding: "0 1.1rem 1rem" }}>
          {ready ? (
            <>
              <PlanRow label="Entry" value={entry.toFixed(2)} color={GREEN} />
              <PlanRow label="Stop Loss" value={stopLoss.toFixed(2)} color={RED} />
              {seq?.targets?.slice(0, 2).map((t) => (
                <PlanRow key={t.key} label={t.key} value={t.price.toFixed(2)} color={t.color === "أخضر" ? GREEN : BLUE} />
              ))}
              <PlanRow label="Risk / Reward" value={`1 : ${rr.toFixed(1)}`} />
              {riskPercent != null && <PlanRow label="Risk %" value={`${riskPercent.toFixed(2)}%`} />}
              <button
                onClick={exportAnalysis}
                style={{
                  marginTop: 10,
                  width: "100%",
                  background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
                  border: "none",
                  color: "#181A20",
                  fontWeight: 700,
                  borderRadius: 7,
                  padding: "8px 0",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                ⬇ تصدير
              </button>
            </>
          ) : (
            <div style={{ fontSize: 11.5, color: "#888", lineHeight: 1.7, padding: "4px 0" }}>
              {entry && stopLoss && rr != null
                ? `RR الحالي 1:${rr.toFixed(1)} — أقل من الحد الأدنى (1:${MIN_RR})، فما بنعرضها كصفقة جاهزة.`
                : "لسا ما اكتمل الإعداد — رح تظهر Entry وStop Loss تلقائياً لما تتحقق الشروط."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlanRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #20232a" }}>
      <span style={{ fontSize: 11.5, color: "#888" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: color || "#f0f0f0" }}>{value}</span>
    </div>
  );
}
