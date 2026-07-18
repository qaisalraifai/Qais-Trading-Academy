"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  const [activeTools, setActiveTools] = useState(
    Object.fromEntries(Object.keys(TOOL_COLORS).map((k) => [k, true]))
  );
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

      ctx.fillStyle = color + "26";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.fillStyle = color;
      ctx.font = "11px sans-serif";
      ctx.fillText(label, x1 + 4, y1 + 12);
    };

    const drawPOIHighlight = (zone) => {
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

      ctx.save();
      ctx.setLineDash([6, 3]);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1 - 2, Math.min(y1, y2) - 2, x2 - x1 + 4, Math.abs(y2 - y1) + 4);
      ctx.setLineDash([]);
      ctx.restore();

      const tag = `★ POI (${zone.type})`;
      ctx.font = "bold 11px sans-serif";
      const tagW = ctx.measureText(tag).width + 10;
      const tagY = Math.min(y1, y2) - 16;
      ctx.fillStyle = GOLD;
      ctx.fillRect(x1 - 2, tagY, tagW, 15);
      ctx.fillStyle = "#0b0d10";
      ctx.fillText(tag, x1 + 3, tagY + 11);
    };

    for (const z of layers.fvgs) drawZone(z, TOOL_COLORS.FVG, "FVG", active.FVG);
    for (const z of layers.voids) drawZone(z, "#7c3aed", "Void", active.FVG);
    for (const z of layers.brkr) drawZone(z, TOOL_COLORS.BRKR, "BRKR", active.BRKR);
    for (const z of layers.mtg) drawZone(z, TOOL_COLORS.MTG, "MTG", active.MTG);
    if (layers.ob?.eligible) {
      const { level1, level2, level4 } = layers.ob.levels;
      const hi = level1 ?? level2;
      drawZone({ from: layers.ob.merged.low, to: hi, index: layers.ob.index }, TOOL_COLORS.OB, "OB", active.OB);
      // خط الـ MT (منتصف OB) — أقوى مستوى بالمنطقة
      const c1 = candles[layers.ob.index];
      if (c1 && active.OB) {
        const x1 = ts.timeToCoordinate(c1.time);
        const lastCandle = candles[candles.length - 1];
        const x2 = ts.timeToCoordinate(lastCandle.time) + 26;
        const ym = series.priceToCoordinate(layers.ob.levels.mt);
        if (x1 != null && x2 != null && ym != null) {
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = TOOL_COLORS.OB;
          ctx.beginPath();
          ctx.moveTo(x1, ym);
          ctx.lineTo(x2, ym);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // خطوط الهيكلية BOS/MSS (خط أفقي قصير من نقطة الكسر لآخر شمعة) + Sweep/RJB كنقاط
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
      ctx.fillStyle = color;
      ctx.font = "11px sans-serif";
      ctx.fillText(label, x1, y - 4);
    };

    for (const ev of layers.structureEvents) {
      drawLevelLine(ev, ev.type === "BOS" ? GREEN : "#e5e5e5", ev.type, active.Structure);
    }
    for (const sw of layers.sweeps) drawLevelLine({ ...sw, level: sw.level }, TOOL_COLORS.Sweep, "Sweep", active.Sweep);
    for (const r of layers.rjb) drawLevelLine(r, TOOL_COLORS.RJB, "RJB", active.RJB);

    // منطقة الاهتمام (POI) الفعلية يلي اعتمدها محرك القرار — دايماً تترسم لو موجودة
    // بغض النظر عن حالة أزرار QAIS TOOLS، لأنها أساس القرار مش أداة استكشاف اختيارية
    drawPOIHighlight(layers.poi);

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
          fvgs: liquidity.fvgs.slice(-4),
          voids: liquidity.voids.slice(-2),
          brkr: liquidity.brkr.slice(-2),
          mtg: liquidity.mtg.slice(-2),
          sweeps: liquidity.sweeps.slice(-4),
          rjb: liquidity.rjb.slice(-3),
          structureEvents: struct.events.slice(-6),
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
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* -------- الهيدر -------- */}
      <div style={{ ...cardStyle, padding: "1rem 1.2rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1.2rem" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#f0f0f0", display: "flex", alignItems: "center", gap: 8 }}>
            {asset?.label || symbol}
            <span style={{ fontSize: 11, background: `${GOLD}22`, color: GOLD_LIGHT, padding: "2px 8px", borderRadius: 6 }}>
              AI Mode
            </span>
          </div>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            style={{ background: "#181A20", color: "#ccc", border: "1px solid #333", borderRadius: 6, fontSize: 12, marginTop: 4, padding: "2px 6px" }}
          >
            {ASSETS.flatMap((g) => g.items.filter((i) => i.yahoo)).map((i) => (
              <option key={i.v} value={i.v}>
                {i.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {TF_OPTIONS.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setDisplayTF(tf.value)}
              style={{
                background: displayTF === tf.value ? `${GOLD}22` : "transparent",
                border: `1px solid ${displayTF === tf.value ? GOLD : "#333"}`,
                color: displayTF === tf.value ? GOLD_LIGHT : "#999",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <HeaderStat label="Daily Trend" value={decision?.direction === "up" ? "Bullish ↗" : decision?.direction === "down" ? "Bearish ↘" : "—"} color={decision?.direction === "up" ? GREEN : decision?.direction === "down" ? RED : "#999"} />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ScoreGauge score={decision?.score || 0} />
          <div>
            <div style={{ fontSize: 11, color: "#888" }}>QAIS Score</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0" }}>{decision?.score ?? 0}/100</div>
          </div>
        </div>

        <HeaderStat label="Session" value={sessionNow()} />
        <HeaderStat label="Time" value={new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " (UTC+3)"} />

        <button
          onClick={runAnalysis}
          disabled={loading}
          style={{
            marginRight: "auto",
            background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
            border: "none",
            color: "#181A20",
            fontWeight: 700,
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {loading ? "جاري التحليل..." : "⚡ AI Analyze"}
        </button>
      </div>

      {/* -------- شريط تسلسل الفحص -------- */}
      {decision?.reasonsChecklist && <ChecklistBar checklist={decision.reasonsChecklist} />}

      {error && <div style={{ ...cardStyle, padding: "0.8rem 1rem", color: RED, fontSize: 13 }}>{error}</div>}

      {/* -------- الشارت + الأدوات + لوحة القرار -------- */}
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* أدوات QAIS */}
        <div style={{ ...cardStyle, padding: "0.8rem", display: "flex", flexDirection: "column", gap: 6, width: 92 }}>
          <div style={{ fontSize: 10, color: "#888", textAlign: "center", marginBottom: 4 }}>QAIS TOOLS</div>
          {Object.keys(TOOL_COLORS).map((key) => (
            <button
              key={key}
              onClick={() => setActiveTools((p) => ({ ...p, [key]: !p[key] }))}
              style={{
                background: activeTools[key] ? `${TOOL_COLORS[key]}22` : "#181A20",
                border: `1px solid ${activeTools[key] ? TOOL_COLORS[key] : "#333"}`,
                color: activeTools[key] ? TOOL_COLORS[key] : "#777",
                borderRadius: 6,
                padding: "6px 4px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {key}
            </button>
          ))}
        </div>

        {/* الشارت */}
        <div style={{ ...cardStyle, padding: "0.6rem", flex: 1, minWidth: 320, position: "relative" }}>
          <div ref={containerRef} style={{ width: "100%", height: 520 }} />
          <canvas ref={canvasRef} width={800} height={520} style={{ position: "absolute", top: "0.6rem", left: "0.6rem", pointerEvents: "none" }} />
          {debugInfo && (
            <div
              style={{
                position: "absolute",
                bottom: 6,
                left: 6,
                fontSize: 10,
                color: debugInfo.startsWith("⚠️") ? RED : "#888",
                background: "rgba(0,0,0,0.55)",
                padding: "2px 6px",
                borderRadius: 4,
                pointerEvents: "none",
                fontFamily: "monospace",
              }}
            >
              {debugInfo}
            </div>
          )}
        </div>

        {/* لوحة القرار */}
        <DecisionPanel decision={decision} symbol={symbol} />
      </div>
    </div>
  );
}

function HeaderStat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#888" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: color || "#f0f0f0" }}>{value}</div>
    </div>
  );
}

function ScoreGauge({ score }) {
  const size = 40;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 85 ? GREEN : score >= 50 ? "#eab308" : RED;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#333" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

const CHECKLIST_LABELS = {
  trend: { ar: "الاتجاه", en: "Trend" },
  externalStructure: { ar: "مكان السعر", en: "Location" },
  liquidityHit: { ar: "مناطق الاهتمام", en: "POI" },
  smtPresent: { ar: "SMT", en: "Smart Money" },
  obCreated: { ar: "OB", en: "Order Block" },
  targetsCalculated: { ar: "الأهداف", en: "Targets" },
};

function ChecklistBar({ checklist }) {
  const items = checklist.filter((c) => CHECKLIST_LABELS[c.key]);
  return (
    <div
      dir="ltr"
      style={{ ...cardStyle, direction: "ltr", padding: "0.9rem 1.4rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}
    >
      {items.map((c, i) => (
        <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: c.ok ? GREEN : "#333",
                color: "#fff",
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i + 1}
            </span>
            <div dir="rtl">
              <div style={{ fontSize: 12, color: "#ddd" }}>{CHECKLIST_LABELS[c.key].ar}</div>
              <div style={{ fontSize: 10, color: "#777" }}>{CHECKLIST_LABELS[c.key].en}</div>
            </div>
            <span style={{ color: c.ok ? GREEN : "#555" }}>{c.ok ? "✓" : "○"}</span>
          </div>
          {i < items.length - 1 && <div style={{ width: 30, height: 1, background: "#333" }} />}
        </div>
      ))}
    </div>
  );
}

function DecisionPanel({ decision, symbol }) {
  const [balance, setBalance] = useState(1000);

  if (!decision) {
    return (
      <div style={{ ...cardStyle, padding: "1.4rem", width: 300, color: "#888", fontSize: 13, textAlign: "center" }}>
        جاري تحميل التحليل...
      </div>
    );
  }

  const ob = decision.ob;
  const seq = decision.sequence;
  const { entry, stopLoss, rr, meetsRR, riskPercent } = computeTradeMetrics(decision);

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
    <div style={{ ...cardStyle, padding: "1.2rem", width: 300, flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f0f0" }}>⬡ QAIS DECISION ENGINE</div>
        <div style={{ fontSize: 12, color: decision.score >= 85 ? GREEN : "#eab308" }}>⏱ {decision.score}/100</div>
      </div>

      <DecisionRow
        ok={decision.direction != null}
        title="الاتجاه"
        sub="Trend"
        value={decision.direction === "up" ? "Bullish (صاعد)" : decision.direction === "down" ? "Bearish (هابط)" : "—"}
        valueColor={decision.direction === "up" ? GREEN : decision.direction === "down" ? RED : "#999"}
        note="الإطار: Daily / 4H / 1H"
      />

      <DecisionRow
        ok={!!decision.priceLocation}
        title="مكان السعر"
        sub="Location"
        value={decision.priceLocation ? `${decision.priceLocation.zone === "discount" ? "Discount" : decision.priceLocation.zone === "premium" ? "Premium" : "Equilibrium"} (${decision.priceLocation.ratio})` : "—"}
        note="بين: 0.5 - 0.666"
      />

      <DecisionRow
        ok={!!decision.ob?.touchedZoneType}
        title="مناطق الاهتمام"
        sub="POI"
        value={decision.ob?.touchedZoneType ? `${decision.reasonTags?.[0] || decision.ob.touchedZoneType}` : "—"}
        note={ob?.eligible ? `قوة المنطقة: ${ob.quality >= 70 ? "عالية" : ob.quality >= 40 ? "متوسطة" : "منخفضة"}` : "السعر لسا ما وصل لمنطقة اهتمام مؤكدة"}
      />

      <DecisionRow
        ok={!!decision.smt?.valid}
        title="SMT"
        sub="Smart Money Technique"
        value={decision.smt?.valid ? "Confirmed" : "غير متوفر"}
        valueColor={decision.smt?.valid ? GREEN : "#999"}
        note={decision.smt?.symbolB ? `• ${symbol} / ${decision.smt.symbolB}` : "لسا ما ظهر انحراف SMT واضح بين الأصول المرتبطة"}
      />

      <DecisionRow
        ok={!!ob?.eligible && ob.status !== "Invalid"}
        title="OB"
        sub="Order Block"
        value={ob?.eligible ? `${ob.status} OB` : "لم يتشكّل بعد"}
        valueColor={ob?.status === "Fresh" || ob?.status === "Active" ? GREEN : ob?.status === "Weak" ? "#eab308" : RED}
        note={decision.timeframe ? `${decision.timeframe} • ${ob?.direction === "up" ? "صاعد" : "هابط"}` : ""}
      />

      {seq?.active && meetsRR && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #2a2a2a" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "#ddd" }}>الأهداف</span>
            <span style={{ fontSize: 10, color: "#777" }}>Targets</span>
          </div>
          {seq.targets.map((t) => (
            <div key={t.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}>
              <span style={{ color: t.color === "أخضر" ? GREEN : BLUE }}>
                {t.key} ({t.color})
              </span>
              <span style={{ color: "#f0f0f0" }}>{t.price.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {entry && stopLoss && meetsRR ? (
        <>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #2a2a2a", display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#888" }}>Entry</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{entry.toFixed(2)}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#888" }}>Stop Loss</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: RED }}>{stopLoss.toFixed(2)}</div>
            </div>
          </div>

          {rr != null && (
            <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "#888" }}>Risk / Reward</span>
              <span style={{ color: "#f0f0f0" }}>1 : {rr.toFixed(1)}</span>
            </div>
          )}
          {riskPercent != null && (
            <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
              <span style={{ color: "#888" }}>Risk %</span>
              <span style={{ color: "#f0f0f0" }}>{riskPercent.toFixed(2)}%</span>
            </div>
          )}
          <div style={{ marginTop: 4, fontSize: 10, color: "#555" }}>
            * Risk % بناءً على مسافة الدخول-الوقف من السعر فقط (مش حجم اللوت الفعلي)
          </div>
        </>
      ) : entry && stopLoss && rr != null ? (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid #2a2a2a",
            fontSize: 11.5,
            color: "#a1a1a1",
            background: "#181A20",
            borderRadius: 8,
            padding: "10px 12px",
            lineHeight: 1.7,
          }}
        >
          <div style={{ color: RED, fontWeight: 700, marginBottom: 4 }}>
            ✕ لا تستاهل — RR فقط 1 : {rr.toFixed(1)}
          </div>
          الصفقة ما بتحقق الحد الأدنى المطلوب (1 : {MIN_RR}) لعلاقة المخاطرة/العائد، فما بنعرضها كإشارة دخول جاهزة ولا برسم أهدافها على الشارت. لو تغيّرت هيكلية السعر ووسّعت المسافة للهدف، رح تظهر تلقائياً.
        </div>
      ) : (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid #2a2a2a",
            fontSize: 11.5,
            color: "#a1a1a1",
            background: "#181A20",
            borderRadius: 8,
            padding: "10px 12px",
            lineHeight: 1.7,
          }}
        >
          <div style={{ color: "#eab308", fontWeight: 700, marginBottom: 4 }}>⏳ الإعداد لسا ما اكتمل</div>
          لسا ما ظهر Order Block صالح لتحديد نقطة دخول ووقف خسارة واضحة على هالفريم. لما تتحقق باقي الشروط (SMT / OB) رح تظهر Entry و Stop Loss تلقائياً هون.
        </div>
      )}

      <button
        onClick={exportAnalysis}
        style={{
          marginTop: 14,
          width: "100%",
          background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
          border: "none",
          color: "#181A20",
          fontWeight: 700,
          borderRadius: 8,
          padding: "10px 0",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        ⬇ تصدير التحليل
      </button>
    </div>
  );
}

function DecisionRow({ ok, title, sub, value, valueColor, note }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 0", borderBottom: "1px solid #23262d" }}>
      <span style={{ color: ok ? GREEN : "#555", fontSize: 14, marginTop: 1 }}>{ok ? "✓" : "○"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12.5, color: "#ddd" }}>{title}</span>
        </div>
        <div style={{ fontSize: 10, color: "#777" }}>{sub}</div>
        {note && <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>{note}</div>}
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: valueColor || "#f0f0f0", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}
