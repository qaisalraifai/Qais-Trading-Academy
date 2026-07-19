"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { ASSETS, getAssetByValue } from "@/lib/assets";
import { analyzeSymbol, getCorrelatedSymbol } from "@/lib/qais/engine";

/* ============================================================================
   QaisEngineView — تبويب "QAIS SK Engine" المستقل. شارت حي + Decision Engine كامل.

   تصميم مطابق للتوثيق الجديد (سابع عشر/ثامن عشر): الشارت هو العنصر الأساسي،
   وكل عناصر QAIS (OB/ENTRY/SL/Targets/POI) تترسم كخطوط سعرية أفقية نظيفة
   (نفس أسلوب TradingView الاحترافي) — بدون صناديق أو ألوان زائدة، ولأنها خطوط
   سعرية بحتة (price lines) بتضل صحيحة بغض النظر عن أي فريم معروض بالشارت،
   حتى لو كانت محسوبة أصلاً على فريم هيكلي أعلى (Daily/4H) أو فريم تنفيذ أصغر
   (15m/5m) — عكس الصناديق اللي كانت تحتاج تطابق فريم العرض بالضبط.

   المحرك (lib/qais/engine.js) بيختار تلقائياً:
     - الفريم الرئيسي (Daily > 4H > 1H — أول واحد عنده اتجاه مؤكَّد)
     - فريم تنفيذ الـ OB (15m أو 5m — الأقوى، وعند التعادل يُفضَّل 15m)
   والواجهة هون بس "تعرض" النتيجة — ما في أي منطق تحليل بالواجهة نفسها.
   ============================================================================ */

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2D57E";
const GREEN = "#02C076";
const RED = "#F6465D";
const BLUE = "#4f7cff";
const NEUTRAL = "#c9c9c9";

const cardStyle = {
  background: "linear-gradient(145deg, #22252B, #181A20)",
  border: `1px solid ${GOLD}26`,
  borderRadius: 14,
  boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
};

const TF_LABELS = { daily: "Daily", h4: "H4", h1: "H1", m15: "M15", m5: "M5" };
const TF_ORDER = ["daily", "h4", "h1", "m15", "m5"];

/* رموز مرجعية لأصول SMT مش موجودة أصلاً بقائمة أصول المنصة (نفس خارطة الكرون) */
const YAHOO_OVERRIDE = { XAUEUR: "XAUEUR=X" };

async function fetchCandles(yahoo, interval, count = 300) {
  try {
    const res = await fetch(`/api/replay-candles?symbol=${encodeURIComponent(yahoo)}&interval=${interval}&count=${count}`);
    const data = await res.json();
    return data.candles || [];
  } catch {
    return [];
  }
}

export default function QaisEngineView() {
  const [symbol, setSymbol] = useState("XAUUSD");
  const [displayTF, setDisplayTF] = useState("h1");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // نتيجة analyzeSymbol كاملة
  const [allCandles, setAllCandles] = useState({}); // { daily, h4, h1, m15, m5 }

  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLinesRef = useRef([]);
  const resultRef = useRef(null);

  const asset = getAssetByValue(symbol);

  /* ===================== جلب كل الفريمات + تشغيل QAIS Decision Engine مرة وحدة ===================== */
  const runAnalysis = useCallback(async () => {
    if (!asset?.yahoo) return;
    setLoading(true);
    setError("");
    try {
      const [daily, h4, h1, m15, m5] = await Promise.all([
        fetchCandles(asset.yahoo, "1day", 300),
        fetchCandles(asset.yahoo, "4h", 300),
        fetchCandles(asset.yahoo, "1h", 300),
        fetchCandles(asset.yahoo, "15min", 300),
        fetchCandles(asset.yahoo, "5min", 300),
      ]);
      const candlesByTF = { daily, h4, h1, m15, m5 };

      if (Object.values(candlesByTF).every((c) => !c || c.length < 30)) {
        throw new Error("بيانات غير كافية من مزوّد الأسعار لهذا الرمز حالياً");
      }

      // SMT (سابعاً): نجيب H1 للأصل المترابط لو موجود
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
      // فريم العرض الافتراضي: فريم تنفيذ الـ OB لو تشكّل، وإلا الفريم الرئيسي
      setDisplayTF(analysis.executionTimeframe || analysis.mainTimeframe || "h1");
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
        height: 560,
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

      const handleResize = () => {
        if (!containerRef.current) return;
        chart.applyOptions({ width: containerRef.current.clientWidth });
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

  /* ===================== خطوط QAIS السعرية (Entry/SL/Targets/OB/POI) =====================
     كل شي هون خط سعري أفقي نظيف (Minimal — ثامن عشر) — ما في صناديق ولا رسم حر،
     وكل الخطوط مبنية مباشرة على مخرجات analyzeSymbol() بدون أي حساب إضافي بالواجهة. */
  function applyPriceLines() {
    const series = seriesRef.current;
    const r = resultRef.current;
    if (!series) return;

    priceLinesRef.current.forEach((pl) => series.removePriceLine(pl));
    priceLinesRef.current = [];
    if (!r) return;

    const add = (price, color, title, lineWidth = 1, dashed = true) => {
      if (price == null || !Number.isFinite(price)) return;
      const pl = series.createPriceLine({
        price,
        color,
        lineWidth,
        lineStyle: dashed ? chartRef.current.__LineStyle.Dashed : chartRef.current.__LineStyle.Solid,
        axisLabelVisible: true,
        title,
      });
      priceLinesRef.current.push(pl);
    };

    // POI (خامساً): حدود منطقة الاهتمام اللي لمسها السعر ضمن نطاق MSS↔BOS
    const poi = r.poi?.touchedZone;
    if (poi) {
      const lo = poi.from ?? poi.level;
      const hi = poi.to ?? poi.level;
      if (lo != null) add(lo, `${GOLD}99`, `POI ${poi.type}`, 1, true);
      if (hi != null && hi !== lo) add(hi, `${GOLD}99`, `POI ${poi.type}`, 1, true);
    }

    const ob = r.ob;
    if (ob?.eligible && ob.status !== "Invalid") {
      if (r.tradeValid && r.entry != null) {
        // اكتملت شروط الدخول: ENTRY + SL + كل الأهداف (خامس عشر/سادس عشر)
        add(r.entry, GOLD_LIGHT, "ENTRY", 2, false);
        add(r.stopLoss, RED, r.slSource === "SMT" ? "SL (SMT)" : "SL", 2, false);
        for (const t of r.targets || []) {
          add(t.price, t.color === "green" ? GREEN : BLUE, t.key, 1, false);
        }
      } else {
        // OB تشكّل بس الشروط لسا ما اكتملت: نعرض بس المستوى الأقوى (MT) كمؤشر متابعة
        add(ob.levels.mt, NEUTRAL, `MT (${ob.status})`, 1, true);
      }
    }
  }

  /* ===================== تحديث شموع الفريم المعروض + الخطوط ===================== */
  useEffect(() => {
    if (!seriesRef.current) return;
    const candles = allCandles[displayTF];
    if (!candles || candles.length === 0) return;
    seriesRef.current.setData(candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
    chartRef.current?.timeScale().fitContent();
    applyPriceLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCandles, displayTF, result]);

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

        {/* فريمات العرض — كلها متوفرة دايماً (جُلبت مسبقاً)، مجرد تبديل عرض بدون إعادة تحليل */}
        <div style={{ display: "flex", gap: 4 }}>
          {TF_ORDER.filter((tf) => allCandles[tf]?.length).map((tf) => (
            <button
              key={tf}
              onClick={() => setDisplayTF(tf)}
              title={tf === result?.mainTimeframe ? "الفريم الرئيسي" : tf === result?.executionTimeframe ? "فريم التنفيذ" : ""}
              style={{
                background: displayTF === tf ? `${GOLD}1f` : "transparent",
                border: `1px solid ${displayTF === tf ? GOLD : "#2e2e2e"}`,
                color: displayTF === tf ? GOLD_LIGHT : "#888",
                borderRadius: 6,
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
          <ScoreBadge score={result?.score || 0} status={result?.status} />
        </div>
      </div>

      {error && <div style={{ ...cardStyle, padding: "0.7rem 1rem", color: RED, fontSize: 12.5 }}>{error}</div>}

      {/* ================= 2) الشارت — العنصر الأساسي والأكبر ================= */}
      <div style={{ ...cardStyle, padding: "0.6rem" }}>
        <div ref={containerRef} style={{ width: "100%", height: 560 }} />
      </div>

      {/* ================= 3) ANALYSIS PANEL + TRADE PLAN ================= */}
      <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
        <AnalysisPanel result={result} />
        <TradePlanCard result={result} symbol={symbol} />
      </div>
    </div>
  );
}

/* -------- Score Badge -------- */
function ScoreBadge({ score, status }) {
  const STATUS_COLOR = { green: GREEN, orange: "#f59e0b", yellow: "#eab308", red: RED, gray: "#888" };
  const color = STATUS_COLOR[status] || "#888";
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

/* ================= لوحة التحليل — نفس ترتيب البند الثامن عشر بالضبط:
   TREND → STRUCTURE → PRICE LOCATION → POI → SMT → OB → ENTRY MODEL → STATUS ================= */
function AnalysisPanel({ result: r }) {
  const [open, setOpen] = useState(true);
  const [openRow, setOpenRow] = useState(null);

  const ob = r?.ob;
  const poi = r?.poi?.touchedZone;

  const rows = r
    ? [
        {
          key: "trend",
          ok: r.direction != null,
          name: "TREND",
          result: r.direction === "up" ? "Bullish" : r.direction === "down" ? "Bearish" : "—",
          color: r.direction === "up" ? GREEN : r.direction === "down" ? RED : "#888",
          detail: "الاتجاه المعتمد من External Structure/الفريم الأعلى — ما بيتغيّر إلا بعد MSS كامل.",
        },
        {
          key: "structure",
          ok: !!r.structureLadder?.length,
          name: "STRUCTURE",
          result: r.mainTimeframe ? TF_LABELS[r.mainTimeframe] : "—",
          color: "#ddd",
          detail: (r.structureLadder || [])
            .map((s) => `${TF_LABELS[s.timeframe]}: ${s.trend === "up" ? "Bullish" : s.trend === "down" ? "Bearish" : "—"} (${s.role})`)
            .join("  •  ") || "لا توجد بيانات هيكلية كافية.",
        },
        {
          key: "location",
          ok: !!r.priceLocation,
          name: "PRICE LOCATION",
          result: r.priceLocation
            ? r.priceLocation.zone === "discount"
              ? "Discount"
              : r.priceLocation.zone === "premium"
              ? "Premium"
              : "Equilibrium"
            : "—",
          color: "#ddd",
          detail: r.priceLocation ? `نسبة الموقع: ${r.priceLocation.ratio} (0=قمة/Premium، 1=قاع/Discount).` : "لسا ما تحدد موقع السعر بدقة.",
        },
        {
          key: "poi",
          ok: !!poi,
          name: "POI",
          result: poi ? poi.type : "—",
          color: "#ddd",
          detail: poi
            ? `منطقة ضمن الحركة الرئيسية (${r.poi?.window?.anchor || ""}) — لامسها السعر.`
            : "السعر لسا ما وصل لمنطقة اهتمام ضمن آخر حركة هيكلية (MSS↔BOS).",
        },
        {
          key: "smt",
          ok: !!r.smt?.valid,
          name: "SMT",
          result: r.smt?.valid ? "Confirmed" : "Not Confirmed",
          color: r.smt?.valid ? GREEN : "#888",
          detail: r.smt?.symbolB ? `مقارنة مع: ${r.smt.symbolB} — ${r.smt.strength || ""}` : r.smt?.reason || "لا يوجد أصل مترابط معروف لهذا الرمز.",
        },
        {
          key: "ob",
          ok: !!ob?.eligible && ob.status !== "Invalid",
          name: "OB",
          result: ob?.eligible ? ob.status : "Not Formed",
          color: ob?.status === "Strong" || ob?.status === "Normal" ? GREEN : ob?.status === "Weak" ? "#eab308" : "#888",
          detail: r.executionTimeframe ? `${TF_LABELS[r.executionTimeframe]} • ${ob?.direction === "up" ? "صاعد" : "هابط"}` : ob?.reason || "",
        },
        {
          key: "entryModel",
          ok: !!r.tradeValid,
          name: "ENTRY MODEL",
          result: r.executionTimeframe ? `${TF_LABELS[r.executionTimeframe]} ${ob?.direction === "up" ? "Bullish" : "Bearish"} OB` : "—",
          color: r.tradeValid ? GREEN : "#888",
          detail: r.tradeValid ? "كل شروط الدخول اكتملت." : "لسا في شرط أو أكثر ما تحقق — راجع الصفوف فوق.",
        },
        {
          key: "status",
          ok: r.status === "green",
          name: "STATUS",
          result: r.tradeValid ? "Valid Setup" : r.status === "orange" ? "Developing" : r.status === "yellow" ? "Approaching" : "No Setup",
          color: r.status === "green" ? GREEN : r.status === "red" ? RED : r.status === "orange" ? "#f59e0b" : "#888",
          detail: `QAIS Score: ${r.score}/100`,
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
        <span style={{ fontSize: 13, fontWeight: 700, color: "#f0f0f0" }}>التحليل — QAIS Decision Engine</span>
        {open ? <ChevronDown size={16} color={GOLD} /> : <ChevronRight size={16} color="#666" />}
      </button>

      {open && (
        <div style={{ padding: "0 1.1rem 0.9rem" }}>
          {!r ? (
            <div style={{ color: "#777", fontSize: 12.5, padding: "0.5rem 0" }}>جاري تحميل التحليل...</div>
          ) : (
            rows.map((row) => (
              <div key={row.key} style={{ borderTop: "1px solid #23262d" }}>
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
                  <span style={{ color: row.ok ? GREEN : "#555", fontSize: 13 }}>{row.ok ? "✓" : "○"}</span>
                  <span style={{ fontSize: 12.5, color: "#ddd", flex: 1 }}>{row.name}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: row.color }}>{row.result}</span>
                  <ChevronRight
                    size={13}
                    color="#555"
                    style={{ transform: openRow === row.key ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
                  />
                </button>
                {openRow === row.key && row.detail && (
                  <div style={{ fontSize: 11.5, color: "#888", lineHeight: 1.6, padding: "0 22px 10px" }}>{row.detail}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ================= بطاقة خطة الصفقة — Entry/SL/Targets جاهزين مباشرة من المحرك ================= */
function TradePlanCard({ result: r, symbol }) {
  const [open, setOpen] = useState(true);
  if (!r) return null;

  const ready = r.tradeValid && r.entry != null && r.stopLoss != null;
  const rr = ready && r.targets?.[0] ? Math.abs(r.targets[0].price - r.entry) / Math.abs(r.entry - r.stopLoss) : null;
  const riskPercent = ready ? (Math.abs(r.entry - r.stopLoss) / r.entry) * 100 : null;

  function exportAnalysis() {
    const lines = [
      `QAIS SK ENGINE — ${symbol}`,
      `التاريخ: ${new Date().toLocaleString("ar-EG")}`,
      `Score: ${r.score}/100 | Status: ${r.status}`,
      `Direction: ${r.direction || "—"}`,
      `Main TF: ${r.mainTimeframe || "—"} | Execution TF: ${r.executionTimeframe || "—"}`,
      `Entry: ${r.entry ?? "—"} | Stop Loss: ${r.stopLoss ?? "—"} (${r.slSource || "—"})`,
      `Targets: ${(r.targets || []).map((t) => `${t.key}=${t.price.toFixed(2)}`).join(" | ") || "—"}`,
      `Reasons: ${(r.reasonTags || []).join(" + ")}`,
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
              <PlanRow label="Entry" value={r.entry.toFixed(2)} color={GOLD_LIGHT} />
              <PlanRow label={`Stop Loss (${r.slSource})`} value={r.stopLoss.toFixed(2)} color={RED} />
              {r.targets?.slice(0, 3).map((t) => (
                <PlanRow key={t.key} label={t.key} value={t.price.toFixed(2)} color={t.color === "green" ? GREEN : BLUE} />
              ))}
              {rr != null && <PlanRow label="Risk / Reward" value={`1 : ${rr.toFixed(1)}`} />}
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
              لسا ما اكتمل الإعداد — رح تظهر Entry وStop Loss والأهداف تلقائياً لما تتحقق كل شروط الدخول (تاسعاً).
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
