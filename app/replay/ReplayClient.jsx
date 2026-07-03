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
  const [liveLastPrice, setLiveLastPrice] = useState(null);

  const playTimerRef = useRef(null);
  const livePollRef = useRef(null);
  const countdownTickRef = useRef(null);
  const forminCandleStartRef = useRef(null);

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
        if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      };
      window.addEventListener("resize", handleResize);
      chart.__cleanup = () => window.removeEventListener("resize", handleResize);
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

  /* ===================== جلب البيانات ===================== */
  const loadData = useCallback(async () => {
    stopLivePoll();
    setLoading(true);
    setError("");
    setIsPlaying(false);

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
  useEffect(() => {
    if (!seriesRef.current || allCandles.length === 0) return;
    seriesRef.current.setData(allCandles.slice(0, revealCount));
    chartRef.current?.timeScale().fitContent();
  }, [revealCount, allCandles]);

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
    countdownTickRef.current = setInterval(() => {
      const stepMs = INTERVAL_MS[interval] || 60000;
      const start = forminCandleStartRef.current;
      if (!start) return;
      const closeAt = start * 1000 + stepMs;
      const remain = Math.max(0, closeAt - Date.now());
      const mins = Math.floor(remain / 60000);
      const secs = Math.floor((remain % 60000) / 1000);
      setCountdown(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    }, 1000);
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
        setLiveLastPrice(last.close);
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
      setLiveLastPrice(lastFresh.close);
    } catch (e) {
      /* تجاهل خطأ تحديث واحد، رح يعيد المحاولة بالدورة الجاية */
    }
  }

  function startLivePoll(initialCandles) {
    stopLivePoll();
    if (initialCandles?.length) {
      forminCandleStartRef.current = initialCandles[initialCandles.length - 1].time;
      setLiveLastPrice(initialCandles[initialCandles.length - 1].close);
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

  return (
    <div>
      {/* شريط الوضع */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.8rem" }}>
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
        <button onClick={handleExportImage} style={tabStyle(false)}>✂️ قص/تصدير الشارت</button>
      </div>

      {/* أدوات التحكم */}
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

      {!supported && !error && (
        <div style={{ color: "#f59e0b", fontSize: 13, marginBottom: "1rem" }}>
          ⚠️ هذا الأصل غير مدعوم حالياً بعرض الشموع، اختاري أصل آخر من القائمة.
        </div>
      )}
      {error && <div style={{ color: RED, fontSize: 13, marginBottom: "1rem" }}>{error}</div>}

      {mode === "live" && supported && (
        <div style={{
          display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "0.8rem",
          background: "#0f1f17", border: `1px solid ${GREEN}44`, borderRadius: 12, padding: "0.7rem 1.2rem",
        }}>
          <span style={{ color: GREEN, fontWeight: 700, fontSize: 13 }}>🔴 مباشر</span>
          <span style={{ color: "#ccc", fontSize: 13 }}>آخر سعر: <b style={{ color: GOLD_LIGHT }}>{liveLastPrice ? liveLastPrice.toFixed(4) : "..."}</b></span>
          <span style={{ color: "#ccc", fontSize: 13 }}>إغلاق الشمعة خلال: <b style={{ color: "#fff" }}>{countdown || "--:--"}</b></span>
        </div>
      )}

      <div style={{
        background: "linear-gradient(145deg, #14120a, #0d0d0a)", border: `1px solid ${GOLD}26`,
        borderRadius: 14, padding: "1rem", position: "relative",
      }}>
        {loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            color: "#777", fontSize: 14, zIndex: 2, background: "#0d0d0acc", borderRadius: 14,
          }}>
            ...جاري تحميل البيانات
          </div>
        )}
        <div ref={chartContainerRef} style={{ width: "100%" }} />
      </div>

      {mode === "training" && (
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

function btnStyle(kind) {
  const base = { padding: "0.55rem 1rem", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none" };
  if (kind === "primary") return { ...base, background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`, color: "#1a1200" };
  return { ...base, background: "transparent", border: `1px solid ${GOLD}44`, color: GOLD };
}
