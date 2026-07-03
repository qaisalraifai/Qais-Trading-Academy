"use client";
import { useEffect, useRef, useState, useCallback } from "react";

const GOLD = "#C9A24B";
const GOLD_LIGHT = "#E8C468";
const GREEN = "#10b981";
const RED = "#ef4444";

const SYMBOLS = [
  { value: "BTCUSDT", label: "BTC/USDT" },
  { value: "ETHUSDT", label: "ETH/USDT" },
  { value: "BNBUSDT", label: "BNB/USDT" },
  { value: "SOLUSDT", label: "SOL/USDT" },
  { value: "PAXGUSDT", label: "XAU/USDT (ذهب)" },
];

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

const CONTEXT_BARS = 60; // عدد الشموع الظاهرة بالبداية قبل ما يبلش التدريب

function toChartCandle(k) {
  return {
    time: Math.floor(k[0] / 1000),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
  };
}

export default function ReplayClient() {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setIntervalValue] = useState("15m");
  const [speed, setSpeed] = useState(700);

  const [allCandles, setAllCandles] = useState([]);
  const [revealCount, setRevealCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);

  const playTimerRef = useRef(null);

  // إنشاء الرسم البياني مرة وحدة بس
  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const { createChart, CandlestickSeries } = await import("lightweight-charts");
      if (cancelled || !chartContainerRef.current) return;

      const chart = createChart(chartContainerRef.current, {
        layout: { background: { color: "transparent" }, textColor: "#999" },
        grid: {
          vertLines: { color: "#1a1a1a" },
          horzLines: { color: "#1a1a1a" },
        },
        timeScale: { borderColor: "#222", timeVisible: true },
        rightPriceScale: { borderColor: "#222" },
        width: chartContainerRef.current.clientWidth,
        height: 480,
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: GREEN,
        downColor: RED,
        borderVisible: false,
        wickUpColor: GREEN,
        wickDownColor: RED,
      });

      chartRef.current = chart;
      seriesRef.current = series;

      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
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

  // جلب بيانات جديدة كل ما تتغير العملة أو الفريم
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setIsPlaying(false);
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=500`
      );
      if (!res.ok) throw new Error("تعذر جلب البيانات من المصدر");
      const raw = await res.json();
      const candles = raw.map(toChartCandle);
      setAllCandles(candles);

      // نقطة بداية عشوائية تسيب على الأقل CONTEXT_BARS شمعة ظاهرة و100 شمعة بعدها للتدريب
      const maxStart = Math.max(CONTEXT_BARS, candles.length - 100);
      const start = Math.floor(Math.random() * (maxStart - CONTEXT_BARS + 1)) + CONTEXT_BARS;
      setRevealCount(Math.min(start, candles.length));
    } catch (e) {
      setError(e.message || "صار خطأ، حاولي مرة تانية");
    } finally {
      setLoading(false);
    }
  }, [symbol, interval]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // تحديث الشارت كل ما يتغير عدد الشموع الظاهرة
  useEffect(() => {
    if (!seriesRef.current || allCandles.length === 0) return;
    seriesRef.current.setData(allCandles.slice(0, revealCount));
    chartRef.current?.timeScale().fitContent();
  }, [revealCount, allCandles]);

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
    if (!isPlaying) {
      clearInterval(playTimerRef.current);
      return;
    }
    playTimerRef.current = setInterval(() => {
      setRevealCount((c) => {
        if (c >= allCandles.length) {
          setIsPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, speed);
    return () => clearInterval(playTimerRef.current);
  }, [isPlaying, speed, allCandles.length]);

  const finished = allCandles.length > 0 && revealCount >= allCandles.length;

  return (
    <div>
      {/* أدوات التحكم */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          marginBottom: "1rem",
          background: "linear-gradient(145deg, #14120a, #0d0d0a)",
          border: `1px solid ${GOLD}26`,
          borderRadius: 14,
          padding: "1rem 1.25rem",
        }}
      >
        <Select label="العملة" value={symbol} onChange={setSymbol} options={SYMBOLS} />
        <Select label="الفريم" value={interval} onChange={setIntervalValue} options={INTERVALS} />
        <Select label="السرعة" value={speed} onChange={(v) => setSpeed(Number(v))} options={SPEEDS} />

        <div style={{ flex: 1 }} />

        <button onClick={handleRandomStart} style={btnStyle("secondary")}>
          🎲 بداية عشوائية جديدة
        </button>
        <button onClick={handleReset} style={btnStyle("secondary")}>
          ⏮ إعادة من البداية
        </button>
        <button onClick={togglePlay} disabled={finished || loading} style={btnStyle("primary")}>
          {isPlaying ? "⏸ إيقاف" : "▶ تشغيل تلقائي"}
        </button>
        <button onClick={handleNext} disabled={finished || loading} style={btnStyle("primary")}>
          ▶ الشمعة التالية
        </button>
      </div>

      {error && (
        <div style={{ color: RED, fontSize: 13, marginBottom: "1rem" }}>{error}</div>
      )}

      <div
        style={{
          background: "linear-gradient(145deg, #14120a, #0d0d0a)",
          border: `1px solid ${GOLD}26`,
          borderRadius: 14,
          padding: "1rem",
          position: "relative",
        }}
      >
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#777",
              fontSize: 14,
              zIndex: 2,
              background: "#0d0d0acc",
              borderRadius: 14,
            }}
          >
            ...جاري تحميل البيانات
          </div>
        )}
        <div ref={chartContainerRef} style={{ width: "100%" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.75rem", fontSize: 12.5, color: "#777" }}>
        <span>
          الشموع الظاهرة: {revealCount} / {allCandles.length}
        </span>
        {finished && <span style={{ color: GOLD_LIGHT }}>خلصت الشموع — دوسي "بداية عشوائية جديدة" لجولة تانية 🎯</span>}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#999" }}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "#141414",
          border: "1px solid #2a2a2a",
          color: "#eee",
          borderRadius: 8,
          padding: "0.45rem 0.6rem",
          fontSize: 13,
          minWidth: 110,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function btnStyle(kind) {
  const base = {
    padding: "0.55rem 1rem",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
  };
  if (kind === "primary") {
    return {
      ...base,
      background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
      color: "#1a1200",
    };
  }
  return {
    ...base,
    background: "transparent",
    border: `1px solid ${GOLD}44`,
    color: GOLD,
  };
}
