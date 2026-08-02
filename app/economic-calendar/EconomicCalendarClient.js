"use client";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase-client";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/* ============================================================================
   EconomicCalendarClient — Workspace مستقلة لـ "التقويم الاقتصادي".
   منقول حرفياً (نفس الكود ونفس منطق الجلب) من app/dashboard/DashboardClient.js
   لتشغيله كصفحة مستقلة بكامل عرض الشاشة بدل تبويب داخل الداشبورد.
   ============================================================================ */

const GOLD = "#E8B86D";
const GOLD_LIGHT = "#F0C588";
const GOLD_DARK = "#D4A05A";

const cardStyle = {
  background: "linear-gradient(145deg, #141517, #0D0E10)",
  border: `1px solid ${GOLD}26`,
  borderRadius: 18,
  boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
};

const IMPACT_KEYS = {
  high: { labelKey: "calendar.impactHigh", color: "#E5484D", bg: "#E5484D22", dot: "🔴" },
  medium: { labelKey: "calendar.impactMedium", color: "#F5A623", bg: "#F5A62322", dot: "🟡" },
  low: { labelKey: "calendar.impactLow", color: "#3DBB6E", bg: "#3DBB6E22", dot: "🟢" },
  holiday: { labelKey: "calendar.impactHoliday", color: "#3D8BFD", bg: "#3D8BFD22", dot: "🔵" },
};

const CURRENCY_FLAGS = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", CHF: "🇨🇭",
  CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿", CNY: "🇨🇳",
};

const DIRECTION_STYLE = {
  up: { arrow: "⬆️", color: "#3DBB6E" },
  down: { arrow: "⬇️", color: "#E5484D" },
  neutral: { arrow: "➖", color: "#999" },
};

const STRENGTH_KEYS = { strong: "calendar.strengthStrong", medium: "calendar.strengthMedium", weak: "calendar.strengthWeak" };

// تحليل عام مبدئي يظهر فوراً لأي خبر إلى حين توفر التحليل التفصيلي بالذكاء الاصطناعي
function buildFallbackAnalysis(event, loc) {
  const info = loc.raw(`calendar.currencyAnalysisInfo.${event?.currency}`) || {
    name: event?.currency || loc.t("calendar.defaultCurrencyName"),
    assets: loc.t("calendar.defaultAssets"),
  };
  const impactLabel =
    event?.impact === "high" ? loc.t("calendar.impactLabelHigh") : event?.impact === "medium" ? loc.t("calendar.impactLabelMedium") : loc.t("calendar.impactLabelLimited");

  return loc.t("calendar.fallbackAnalysis", {
    eventTitle: event?.event_title || loc.t("calendar.defaultEventTitle"),
    currencyName: info.name,
    assets: info.assets,
    impactLabel,
  });
}

function formatCountdown(diffMs, dayLabel = "يوم") {
  if (diffMs <= 0) return null;
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days} ${dayLabel} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const PURPLE = "#7c5cff";
const PURPLE_LIGHT = "#E8B86D";

/* Mini Sparkline */
function Sparkline({ data, color, width = 60, height = 24 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* عداد نصف دائري (Gauge) يُستخدم لقوة تأثير الخبر ومؤشر الخوف والطمع */
function SemiGauge({ value, size = 150, colors, gradId }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const w = size;
  const h = size * 0.58;
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = h;
  const circumference = Math.PI * r;
  const progress = v / 100;
  const dash = circumference * progress;
  const angleDeg = 180 - progress * 180;
  const angleRad = (angleDeg * Math.PI) / 180;
  const needleX = cx + r * 0.72 * Math.cos(angleRad);
  const needleY = cy - r * 0.72 * Math.sin(angleRad);
  const id = `grad-${gradId}`;
  return (
    <svg width={w} height={h + 14} viewBox={`0 0 ${w} ${h + 14}`}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          {colors.map((c, i) => (
            <stop key={i} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#1a1a12" strokeWidth="13" strokeLinecap="round" />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="13"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
      />
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4.5" fill="#fff" />
    </svg>
  );
}

const CCY_LIST = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD"];

/* صف تحميل/خطأ موحّد لبطاقات البيانات الحية */
function LiveCardStatus({ label }) {
  return <p style={{ margin: 0, fontSize: 11, color: "#666", textAlign: "center", padding: "0.6rem 0" }}>{label}</p>;
}

/* خريطة قوة العملات — بيانات حقيقية محسوبة من أزواج الفوركس الفعلية عبر Yahoo Finance */
function CurrencyStrengthMeter({ snapshot, loading, error }) {
  const { t } = useLocale();
  const values = useMemo(() => {
    if (!snapshot?.currencies) return [];
    return CCY_LIST.map((c) => ({ code: c, value: snapshot.currencies[c] }))
      .filter((v) => v.value != null)
      .sort((a, b) => b.value - a.value);
  }, [snapshot]);

  return (
    <div style={{ ...cardStyle, padding: "1.1rem 1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#fff" }}>{t("calendar.currencyStrengthTitle")}</p>
        <span style={{ fontSize: 8.5, color: "#555" }}>Yahoo Finance</span>
      </div>
      {loading && !snapshot ? (
        <LiveCardStatus label={t("calendar.loadingLiveData")} />
      ) : error && values.length === 0 ? (
        <LiveCardStatus label={t("calendar.liveDataError")} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          {values.map((v) => {
            const color = v.value >= 68 ? "#3DBB6E" : v.value >= 42 ? GOLD_LIGHT : "#E5484D";
            return (
              <div key={v.code}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11.5, color: "#ccc", fontWeight: 700 }}>
                    {CURRENCY_FLAGS[v.code] || "🌐"} {v.code}
                  </span>
                  <span style={{ fontSize: 11.5, color, fontWeight: 700 }}>{v.value}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 6, background: "#1a1a12", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${v.value}%`, background: color, borderRadius: 6 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const HEATMAP_SECTORS = ["Forex", "Stocks", "Commodities", "Bonds", "Crypto", "Indices"];
const HEATMAP_SYMBOL_LABEL = { Forex: "DXY", Stocks: "S&P 500", Commodities: "Gold", Bonds: "TLT", Crypto: "Bitcoin", Indices: "Nasdaq" };

/* خريطة الحرارة للأسواق — نسبة تغيّر يومية حقيقية لرمز ممثّل بكل قطاع (Yahoo Finance) */
function MarketHeatmap({ snapshot, loading, error }) {
  const { t } = useLocale();
  const values = snapshot?.heatmap || [];
  const hasData = values.some((v) => v.pct != null);
  return (
    <div style={{ ...cardStyle, padding: "1.1rem 1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#fff" }}>{t("calendar.marketHeatmapTitle")}</p>
        <span style={{ fontSize: 8.5, color: "#555" }}>Yahoo Finance</span>
      </div>
      {loading && !snapshot ? (
        <LiveCardStatus label={t("calendar.loadingLiveData")} />
      ) : error && !hasData ? (
        <LiveCardStatus label={t("calendar.liveDataError")} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.55rem" }}>
          {HEATMAP_SECTORS.map((sector) => {
            const v = values.find((x) => x.sector === sector);
            if (!v || v.pct == null) {
              return (
                <div key={sector} style={{ background: "#0D0E10", border: `1px solid ${GOLD}18`, borderRadius: 10, padding: "0.7rem 0.4rem", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 10.5, color: "#666", fontWeight: 600 }}>{sector}</p>
                  <p style={{ margin: "5px 0 0", fontSize: 12, color: "#444" }}>--</p>
                </div>
              );
            }
            const up = v.pct >= 0;
            const bg = up ? `rgba(61,220,132,${Math.min(0.45, 0.15 + Math.abs(v.pct) / 8)})` : `rgba(239,83,80,${Math.min(0.45, 0.15 + Math.abs(v.pct) / 8)})`;
            const border = up ? "#3DBB6E55" : "#E5484D55";
            return (
              <div key={sector} title={HEATMAP_SYMBOL_LABEL[sector]} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "0.7rem 0.4rem", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 10.5, color: "#ddd", fontWeight: 600 }}>{sector}</p>
                <p style={{ margin: "5px 0 0", fontSize: 14, fontWeight: 800, color: up ? "#3DBB6E" : "#E5484D", direction: "ltr" }}>
                  {up ? "+" : ""}
                  {v.pct}%
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* رسم بياني لتوقع حركة الدولار مع اختيار الفترة الزمنية */
/* رسم بياني حقيقي لحركة DXY (مؤشر الدولار) من Yahoo Finance + متوسط متحرك SMA(5) حقيقي مشتق من نفس البيانات */
function PriceChart() {
  const { t } = useLocale();
  const [tf, setTf] = useState("1D");
  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    setChartError(null);
    fetch(`/api/market-intelligence?type=chart&tf=${tf}`)
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data?.points?.length > 1) setChartData(data);
        else setChartError(data?.error || t("calendar.notEnoughData"));
      })
      .catch(() => {
        if (!cancelled) setChartError(t("calendar.liveDataError"));
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tf]);

  const points = chartData?.points?.map((p) => p.close) || [];
  const sma5 = useMemo(() => {
    if (points.length < 5) return [];
    return points.map((_, i) => {
      if (i < 4) return null;
      const slice = points.slice(i - 4, i + 1);
      return slice.reduce((a, b) => a + b, 0) / 5;
    });
  }, [points]);

  const w = 640;
  const h = 190;
  const pad = 10;
  const validSma = sma5.filter((v) => v != null);
  const all = [...points, ...validSma];
  const max = all.length ? Math.max(...all) : 1;
  const min = all.length ? Math.min(...all) : 0;
  const range = max - min || 1;
  const toXY = (i, v) => {
    const x = pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  };

  return (
    <div style={{ ...cardStyle, padding: "1.1rem 1.3rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem", flexWrap: "wrap", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#fff" }}>
          {t("calendar.dxyChartTitle")} {chartData?.points?.length ? <span style={{ color: GOLD_LIGHT }}>{points[points.length - 1]?.toFixed(2)}</span> : null}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 8.5, color: "#555" }}>Yahoo Finance</span>
          <div style={{ display: "flex", gap: 4 }}>
            {["1D", "1W", "1M"].map((t) => (
              <button
                key={t}
                onClick={() => setTf(t)}
                style={{
                  background: tf === t ? `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})` : "#0D0E10",
                  color: tf === t ? "#000" : "#999",
                  border: tf === t ? "none" : `1px solid ${GOLD}22`,
                  borderRadius: 6,
                  padding: "3px 10px",
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartLoading && !chartData ? (
        <LiveCardStatus label={t("calendar.loadingDxy")} />
      ) : chartError && points.length < 2 ? (
        <LiveCardStatus label={`⚠️ ${chartError}`} />
      ) : (
        <>
          <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
            <polyline points={points.map((v, i) => toXY(i, v).join(",")).join(" ")} fill="none" stroke={GOLD_LIGHT} strokeWidth="2" />
            <polyline
              points={sma5.map((v, i) => (v == null ? null : toXY(i, v).join(","))).filter(Boolean).join(" ")}
              fill="none"
              stroke={PURPLE_LIGHT}
              strokeWidth="1.6"
              strokeDasharray="4 3"
            />
          </svg>
          <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
            <span style={{ fontSize: 10.5, color: "#888" }}>
              <span style={{ color: GOLD_LIGHT }}>●</span> {t("calendar.actualPriceLegend")}
            </span>
            <span style={{ fontSize: 10.5, color: "#888" }}>
              <span style={{ color: PURPLE_LIGHT }}>●</span> {t("calendar.smaLegend")}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/* مؤشر الخوف والطمع — مشتق من مؤشر VIX الحقيقي (Yahoo Finance): كل ما ارتفع VIX زاد الخوف، وكل ما انخفض زاد الطمع */
function FearGreedGauge({ snapshot, loading, error }) {
  const { t } = useLocale();
  const value = snapshot?.fearGreed;
  const label = value == null ? null : value >= 75 ? t("calendar.fgExtremeGreed") : value >= 55 ? t("calendar.fgGreed") : value >= 45 ? t("calendar.fgNeutral") : value >= 25 ? t("calendar.fgFear") : t("calendar.fgExtremeFear");
  const color = value == null ? "#888" : value >= 75 ? "#22c55e" : value >= 55 ? "#84cc16" : value >= 45 ? "#eab308" : value >= 25 ? "#F5A623" : "#E5484D";
  return (
    <div style={{ ...cardStyle, padding: "1.1rem 1.2rem", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#fff" }}>{t("calendar.fearGreedTitle")}</p>
        <span style={{ fontSize: 8.5, color: "#555" }}>VIX</span>
      </div>
      {loading && !snapshot ? (
        <LiveCardStatus label={t("calendar.loadingGeneric")} />
      ) : value == null ? (
        <LiveCardStatus label={t("calendar.vixError")} />
      ) : (
        <>
          <SemiGauge value={value} colors={["#E5484D", "#F5A623", "#eab308", "#84cc16", "#22c55e"]} gradId="fg" />
          <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800, color }}>{value}</p>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color, fontWeight: 700 }}>{label}</p>
          <p style={{ margin: "8px 0 0", fontSize: 10.5, color: "#777", lineHeight: 1.6 }}>
            {t("calendar.fearGreedNote", { vix: snapshot.vix?.price ?? "--" })}
          </p>
        </>
      )}
    </div>
  );
}

/* مؤشر مفاجأة البيانات الاقتصادية — القيمة والاتجاه التاريخي محسوبان من أخبار حقيقية
   (actual مقابل forecast) المخزّنة فعلياً بقاعدة البيانات، وليست بيانات وهمية */
function EconomicSurpriseIndex({ events }) {
  const { t } = useLocale();
  const withActual = useMemo(
    () => events.filter((e) => e.actual && e.forecast && !isNaN(parseFloat(e.actual)) && !isNaN(parseFloat(e.forecast))),
    [events]
  );
  const value = useMemo(() => {
    if (withActual.length === 0) return null;
    const avg = withActual.reduce((acc, e) => acc + (parseFloat(e.actual) - parseFloat(e.forecast)), 0) / withActual.length;
    return Math.round(avg * 100) / 100;
  }, [withActual]);

  // اتجاه تاريخي حقيقي: متوسط المفاجأة لكل يوم فيه أخبار actual، مرتب زمنياً
  const series = useMemo(() => {
    const byDate = new Map();
    withActual.forEach((e) => {
      const diff = parseFloat(e.actual) - parseFloat(e.forecast);
      if (!byDate.has(e.event_date)) byDate.set(e.event_date, []);
      byDate.get(e.event_date).push(diff);
    });
    return Array.from(byDate.entries())
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([, diffs]) => diffs.reduce((a, b) => a + b, 0) / diffs.length);
  }, [withActual]);

  const positive = value != null && value >= 0;
  return (
    <div style={{ ...cardStyle, padding: "1.1rem 1.2rem" }}>
      <p style={{ margin: "0 0 0.4rem", fontSize: 12.5, fontWeight: 700, color: "#fff" }}>{t("calendar.surpriseIndexTitle")}</p>
      {value == null ? (
        <LiveCardStatus label={t("calendar.surpriseNoData")} />
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: positive ? "#3DBB6E" : "#E5484D", direction: "ltr" }}>
            {positive ? "+" : ""}
            {value}
          </p>
          {series.length >= 2 && (
            <div style={{ margin: "8px 0" }}>
              <Sparkline data={series} color={positive ? "#3DBB6E" : "#E5484D"} width={140} height={34} />
            </div>
          )}
          <p style={{ margin: 0, fontSize: 10.5, color: "#888", lineHeight: 1.6 }}>
            {positive ? t("calendar.surprisePositive") : t("calendar.surpriseNegative")}
          </p>
        </>
      )}
    </div>
  );
}

/* لوحة التحليل الفني — مؤشرات RSI/MACD/EMA/دعم/مقاومة محسوبة فعلياً من شموع يومية
   حقيقية (Yahoo Finance) للرمز المرتبط بعملة الخبر المختار */
function TechnicalAnalysisPanel({ currency }) {
  const { t } = useLocale();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/market-intelligence?type=technical&currency=${encodeURIComponent(currency || "USD")}`)
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
      .then(({ ok, data: d }) => {
        if (cancelled) return;
        if (ok) setData(d);
        else setError(d?.error || t("calendar.liveDataError"));
      })
      .catch(() => {
        if (!cancelled) setError(t("calendar.liveDataError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currency]);

  const rows = data && [
    { label: "RSI (14)", value: data.rsi ?? "--", color: data.rsi > 70 ? "#E5484D" : data.rsi < 30 ? "#3DBB6E" : "#eee" },
    { label: "MACD", value: data.macd || "--", color: data.macd === "Bullish" ? "#3DBB6E" : "#E5484D" },
    { label: "EMA 20", value: data.emaUp == null ? "--" : data.emaUp ? t("calendar.aboveEma50") : t("calendar.belowEma50"), color: data.emaUp ? "#3DBB6E" : "#E5484D" },
    { label: t("calendar.generalTrendLabel"), value: data.trend || "--", color: GOLD_LIGHT },
    { label: t("calendar.supportLabel"), value: data.support ?? "--", color: "#3D8BFD" },
    { label: t("calendar.resistanceLabel"), value: data.resistance ?? "--", color: "#E5484D" },
  ];

  return (
    <div style={{ ...cardStyle, padding: "1.1rem 1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.7rem" }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#fff" }}>{t("calendar.technicalTitle", { symbol: data?.symbol || currency })}</p>
        <span style={{ fontSize: 8.5, color: "#555" }}>{t("calendar.dailyYahoo")}</span>
      </div>
      {loading && !data ? (
        <LiveCardStatus label={t("calendar.calculatingIndicators")} />
      ) : error && !data ? (
        <LiveCardStatus label={`⚠️ ${error}`} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {rows.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11.5,
                borderBottom: i < rows.length - 1 ? "1px solid #1a1a0f" : "none",
                paddingBottom: 5,
              }}
            >
              <span style={{ color: "#999" }}>{r.label}</span>
              <span style={{ color: r.color, fontWeight: 700 }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* خطة التداول - Checklist تفاعلية */
function TradingPlanChecklist() {
  const { t, raw } = useLocale();
  const items = raw("calendar.tradingPlanItems") || [];
  const [checked, setChecked] = useState({});
  return (
    <div style={{ ...cardStyle, padding: "1.1rem 1.2rem" }}>
      <p style={{ margin: "0 0 0.7rem", fontSize: 12.5, fontWeight: 700, color: "#fff" }}>{t("calendar.tradingPlanTitle")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
        {items.map((item, i) => (
          <label
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 11.5,
              color: checked[i] ? "#666" : "#ccc",
              cursor: "pointer",
              textDecoration: checked[i] ? "line-through" : "none",
            }}
          >
            <input
              type="checkbox"
              checked={!!checked[i]}
              onChange={() => setChecked((p) => ({ ...p, [i]: !p[i] }))}
              style={{ marginTop: 2, accentColor: GOLD }}
            />
            {item}
          </label>
        ))}
      </div>
    </div>
  );
}

const CCY_ASSET_LABEL = { USD: "DXY", EUR: "EURUSD", GBP: "GBPUSD", JPY: "USDJPY", AUD: "AUDUSD", CAD: "USDCAD", CHF: "USDCHF", NZD: "NZDUSD" };

/* أفضل فرص التداول — الإشارة (شراء/بيع) والثقة مشتقّتان من قوة العملة الفعلية
   (نفس بيانات خريطة قوة العملات الحية) للأخبار عالية/متوسطة التأثير اليوم،
   وليست عشوائية. إشارة اتجاهية تقريبية وليست توصية استثمارية. */
function BestOpportunitiesPanel({ events, snapshot }) {
  const { t } = useLocale();
  const opportunities = useMemo(() => {
    if (!snapshot?.currencies) return [];
    const relevant = [...events].filter((e) => (e.impact === "high" || e.impact === "medium") && snapshot.currencies[e.currency] != null);
    const seen = new Set();
    const out = [];
    for (const e of relevant) {
      if (seen.has(e.currency)) continue;
      seen.add(e.currency);
      const strength = snapshot.currencies[e.currency];
      out.push({
        asset: CCY_ASSET_LABEL[e.currency] || e.currency,
        buy: strength >= 50,
        confidence: Math.round(50 + Math.abs(strength - 50)),
      });
      if (out.length >= 4) break;
    }
    return out;
  }, [events, snapshot]);

  if (!snapshot) {
    return (
      <div style={{ ...cardStyle, padding: "1.1rem 1.2rem", textAlign: "center", color: "#666", fontSize: 12 }}>
        {t("calendar.bestOpportunitiesLoading")}
      </div>
    );
  }
  if (opportunities.length === 0) {
    return (
      <div style={{ ...cardStyle, padding: "1.1rem 1.2rem", textAlign: "center", color: "#666", fontSize: 12 }}>
        {t("calendar.bestOpportunitiesEmpty")}
      </div>
    );
  }
  return (
    <div style={{ ...cardStyle, padding: "1.1rem 1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#fff" }}>{t("calendar.bestOpportunitiesTitle")}</p>
        <span style={{ fontSize: 8.5, color: "#555" }}>{t("calendar.basedOnLiveStrength")}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {opportunities.map((o, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#0D0E10",
              border: `1px solid ${GOLD}1a`,
              borderRadius: 10,
              padding: "0.6rem 0.8rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: `${GOLD}22`,
                  color: GOLD_LIGHT,
                  fontSize: 10,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#eee" }}>{o.asset}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: o.buy ? "#3DBB6E" : "#E5484D" }}>{o.buy ? t("calendar.buyLabel") : t("calendar.sellLabel")}</span>
              <span style={{ fontSize: 11, color: GOLD_LIGHT, fontWeight: 700 }}>{o.confidence}%</span>
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 9.5, color: "#555" }}>{t("calendar.opportunitiesDisclaimer")}</p>
    </div>
  );
}

/* شريط الهيدر العلوي الجديد */
function MICHeaderBar({ search, setSearch, tzOffset, setTzOffset, now, onRefresh, highImpactUpcomingCount }) {
  const { t } = useLocale();
  const marketOpen = useMemo(() => {
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    if (day === 6) return false;
    if (day === 0 && hour < 21) return false;
    if (day === 5 && hour >= 21) return false;
    return true;
  }, [now]);
  const displayTime = new Date(now.getTime() + tzOffset * 3600 * 1000);
  const timeStr = displayTime.toISOString().slice(11, 19);

  return (
    <div
      style={{
        ...cardStyle,
        padding: "0.9rem 1.3rem",
        marginBottom: "1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "#000",
            background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${PURPLE_LIGHT})`,
            padding: "4px 10px",
            borderRadius: 8,
          }}
        >
          MIC
        </span>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#fff" }}>Market Intelligence Center</p>
          <p style={{ margin: 0, fontSize: 10, color: "#888" }}>{t("calendar.micSubtitle")}</p>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 180, maxWidth: 320 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("calendar.searchPlaceholder")}
          style={{
            width: "100%",
            background: "#0D0E10",
            border: `1px solid ${GOLD}2a`,
            borderRadius: 9,
            padding: "0.5rem 0.8rem",
            color: "#ccc",
            fontSize: 11.5,
            outline: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 16, cursor: "pointer" }} title={t("calendar.favoritesTitle")}>⭐</span>
        <span style={{ fontSize: 16, cursor: "pointer", position: "relative" }} title={t("calendar.alertsTitle")}>
          🔔
          {highImpactUpcomingCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -6,
                right: -8,
                background: "#E5484D",
                color: "#fff",
                fontSize: 8,
                fontWeight: 800,
                borderRadius: 8,
                padding: "1px 4px",
              }}
            >
              {highImpactUpcomingCount}
            </span>
          )}
        </span>
        <select
          value={tzOffset}
          onChange={(e) => setTzOffset(Number(e.target.value))}
          style={{ background: "#0D0E10", border: `1px solid ${GOLD}2a`, borderRadius: 8, padding: "0.35rem 0.5rem", color: "#ccc", fontSize: 11 }}
        >
          {[-5, 0, 1, 2, 3, 4].map((o) => (
            <option key={o} value={o}>
              UTC{o >= 0 ? `+${o}` : o}
            </option>
          ))}
        </select>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: marketOpen ? "#3DBB6E" : "#E5484D" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: marketOpen ? "#3DBB6E" : "#E5484D" }} />
          {marketOpen ? t("calendar.marketOpen") : t("calendar.marketClosed")}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#888" }}>
          <span>
            {t("calendar.lastUpdateLabel", { time: "" })}<span style={{ direction: "ltr", display: "inline-block" }}>{timeStr}</span>
          </span>
          <button
            onClick={onRefresh}
            title={t("calendar.refreshTitle")}
            style={{
              background: "transparent",
              border: `1px solid ${GOLD}33`,
              borderRadius: 7,
              width: 24,
              height: 24,
              color: GOLD_LIGHT,
              cursor: "pointer",
            }}
          >
            ⟳
          </button>
        </div>
      </div>
    </div>
  );
}

/* بطاقات KPI العلوية مع Sparkline */
/* بطاقات KPI — كل الأرقام هون حقيقية 100%: محسوبة من أخبار قاعدة البيانات
   الفعلية لليوم الحالي، وعدد فرص التداول مشتق من نفس منطق BestOpportunitiesPanel
   (عملات لها أخبار عالية/متوسطة التأثير اليوم وبيانات قوة حية متوفرة لها).
   ما في Sparkline وهمي هون لأنه ما في مصدر بيانات حقيقي لتاريخ عدد الأخبار. */
function KPICardsRow({ todayStats, activeCurrenciesCount, opportunitiesCount, opportunitiesReady }) {
  const { t } = useLocale();
  const cards = [
    { label: t("calendar.kpiActiveCurrencies"), value: activeCurrenciesCount, sub: t("calendar.kpiActiveCurrenciesSub"), color: PURPLE_LIGHT, icon: "🎯" },
    { label: t("calendar.kpiLowImpact"), value: todayStats.low, sub: t("calendar.today"), color: "#3DBB6E", icon: "🟢" },
    { label: t("calendar.kpiMediumImpact"), value: todayStats.medium, sub: t("calendar.today"), color: "#F5A623", icon: "🟡" },
    { label: t("calendar.kpiHighImpact"), value: todayStats.high, sub: t("calendar.today"), color: "#E5484D", icon: "🔴" },
    { label: t("calendar.kpiOpportunities"), value: opportunitiesReady ? opportunitiesCount : "--", sub: t("calendar.kpiOpportunitiesSub"), color: GOLD_LIGHT, icon: "💡" },
    { label: t("calendar.kpiTodayNews"), value: todayStats.total, sub: t("calendar.kpiRemaining", { count: todayStats.upcoming }), color: "#3D8BFD", icon: "🗓️" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "0.7rem", marginBottom: "1.1rem" }}>
      {cards.map((c, i) => (
        <div key={i} style={{ ...cardStyle, padding: "0.85rem 0.9rem" }}>
          <p style={{ margin: 0, fontSize: 10, color: "#888" }}>
            {c.icon} {c.label}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 21, fontWeight: 800, color: c.color }}>{c.value}</p>
          <p style={{ margin: "2px 0 0", fontSize: 9.5, color: "#666" }}>{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* تذييل الصفحة */
function MICFooter({ tzOffset, lastUpdated }) {
  const { t, locale } = useLocale();
  return (
    <div
      style={{
        ...cardStyle,
        padding: "0.7rem 1.3rem",
        marginTop: "1rem",
        display: "flex",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
        fontSize: 10.5,
        color: "#777",
      }}
    >
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>
          🟢 API Status: <span style={{ color: "#3DBB6E" }}>Live</span>
        </span>
        <span>
          🟢 Data Feed: <span style={{ color: "#3DBB6E" }}>{t("calendar.footerConnected")}</span>
        </span>
        <span>{t("calendar.footerLastSync", { time: lastUpdated ? new Date(lastUpdated).toLocaleTimeString(locale === "ar" ? "ar-EG" : "en-US") : "--" })}</span>
        <span>
          {t("calendar.footerTimezone", { offset: tzOffset >= 0 ? `+${tzOffset}` : tzOffset })}
        </span>
      </div>
      <span>{t("calendar.footerVersion")}</span>
    </div>
  );
}

function CalendarView({ events, loading, isAdmin }) {
  const { t, raw, locale } = useLocale();
  const [dayFilter, setDayFilter] = useState("all");
  const [impactFilter, setImpactFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [analysisTab, setAnalysisTab] = useState("overview");
  const [now, setNow] = useState(() => new Date());
  const [search, setSearch] = useState("");
  const [tzOffset, setTzOffset] = useState(3);

  // تحليل الذكاء الاصطناعي التلقائي: أول مشترك يفتح خبر عالي/متوسط التأثير من غير تحليل
  // بيشغّل الطلب تلقائياً، والنتيجة تنخزن بقاعدة البيانات وتظهر لباقي المشتركين مباشرة.
  const [localAiData, setLocalAiData] = useState({});
  const [analyzingId, setAnalyzingId] = useState(null);
  const [analysisFailedIds, setAnalysisFailedIds] = useState({});

  // لقطة بيانات السوق الحية (قوة العملات + الخريطة الحرارية + VIX/الخوف والطمع)
  // مصدرها Yahoo Finance عبر /api/market-intelligence — تتحدث تلقائياً كل دقيقتين
  // وكمان عند الضغط على زر التحديث بالهيدر.
  const [marketSnapshot, setMarketSnapshot] = useState(null);
  const [marketSnapshotLoading, setMarketSnapshotLoading] = useState(true);
  const [marketSnapshotError, setMarketSnapshotError] = useState(null);
  const [snapshotRefreshTick, setSnapshotRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setMarketSnapshotLoading(true);
    fetch("/api/market-intelligence?type=snapshot")
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok) {
          setMarketSnapshot(data);
          setMarketSnapshotError(null);
        } else {
          setMarketSnapshotError(data?.error || t("calendar.liveDataError"));
        }
      })
      .catch(() => {
        if (!cancelled) setMarketSnapshotError(t("calendar.liveDataError"));
      })
      .finally(() => {
        if (!cancelled) setMarketSnapshotLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [snapshotRefreshTick]);

  useEffect(() => {
    const t = setInterval(() => setSnapshotRefreshTick((n) => n + 1), 120000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setAnalysisTab("overview");
  }, [selectedId]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => impactFilter === "all" || ev.impact === impactFilter);
  }, [events, impactFilter]);

  const days = useMemo(
    () => events.map((e) => e.event_date).filter((v, i, a) => a.indexOf(v) === i).sort(),
    [events]
  );

  const dayScopedEvents = dayFilter === "all" ? filteredEvents : filteredEvents.filter((e) => e.event_date === dayFilter);

  const visibleEvents = useMemo(() => {
    if (!search.trim()) return dayScopedEvents;
    const q = search.trim().toLowerCase();
    return dayScopedEvents.filter(
      (e) => (e.event_title || "").toLowerCase().includes(q) || (e.currency || "").toLowerCase().includes(q)
    );
  }, [dayScopedEvents, search]);

  const grouped = useMemo(() => {
    const map = new Map();
    visibleEvents.forEach((ev) => {
      if (!map.has(ev.event_date)) map.set(ev.event_date, []);
      map.get(ev.event_date).push(ev);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] > b[0] ? 1 : -1));
  }, [visibleEvents]);

  // اختيار افتراضي: أهم خبر قادم، وإلا أول خبر بالقائمة
  const selectedEvent = useMemo(() => {
    let found = null;
    if (selectedId) {
      found = events.find((e) => e.id === selectedId) || null;
    }
    if (!found) {
      const upcoming = events
        .filter((e) => e.event_datetime && new Date(e.event_datetime) > now && (e.impact === "high" || e.impact === "medium"))
        .sort((a, b) => new Date(a.event_datetime) - new Date(b.event_datetime));
      found = upcoming[0] || events[0] || null;
    }
    if (found && localAiData[found.id]) {
      return { ...found, ai_data: localAiData[found.id] };
    }
    return found;
  }, [selectedId, events, now, localAiData]);

  // لما تنفتح شاشة خبر ما إله تحليل بعد، شغّل التحليل تلقائياً بمجرد الضغط عليه.
  useEffect(() => {
    if (!selectedEvent) return;
    if (selectedEvent.ai_data) return;
    if (selectedEvent.impact !== "high" && selectedEvent.impact !== "medium") return;
    if (analyzingId === selectedEvent.id) return;
    if (analysisFailedIds[selectedEvent.id]) return;

    let cancelled = false;
    setAnalyzingId(selectedEvent.id);

    fetch(`/api/economic-events/${selectedEvent.id}/analyze`, { method: "POST" })
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data?.event?.ai_data) {
          setLocalAiData((prev) => ({ ...prev, [data.event.id]: data.event.ai_data }));
        } else {
          setAnalysisFailedIds((prev) => ({ ...prev, [selectedEvent.id]: true }));
        }
      })
      .catch(() => {
        if (!cancelled) setAnalysisFailedIds((prev) => ({ ...prev, [selectedEvent.id]: true }));
      })
      .finally(() => {
        if (!cancelled) setAnalyzingId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEvent, analyzingId, analysisFailedIds]);

  // Polling: لو الخبر لسا ما إله ai_data (سواء إحنا يلي طلبنا التحليل أو مشترك
  // تاني بجلسة ثانية، أو الـ cron)، نتأكد كل كم ثانية إذا خلص التحليل بقاعدة
  // البيانات ونحدّث الواجهة تلقائياً — بدون ما يحتاج المستخدم يعمل Refresh يدوي.
  useEffect(() => {
    if (!selectedEvent) return;
    if (selectedEvent.ai_data) return;
    if (selectedEvent.impact !== "high" && selectedEvent.impact !== "medium") return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20; // حد أقصى تقريبي دقيقتين قبل ما نوقف المحاولة

    const interval = setInterval(async () => {
      attempts += 1;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        return;
      }
      try {
        const res = await fetch(`/api/economic-events/${selectedEvent.id}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data?.event?.ai_data) {
          setLocalAiData((prev) => ({ ...prev, [data.event.id]: data.event.ai_data }));
          clearInterval(interval);
        }
      } catch {
        // تجاهل الخطأ وحاول بالمرة الجاية
      }
    }, 6000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedEvent?.id, selectedEvent?.ai_data]);

  const lastUpdated = useMemo(() => {
    const sorted = [...events].filter((e) => e.updated_at).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    return sorted[0]?.updated_at || null;
  }, [events]);

  const todayStr = useMemo(() => now.toISOString().slice(0, 10), [now]);

  const todayEvents = useMemo(
    () => events.filter((e) => e.event_date === todayStr),
    [events, todayStr]
  );

  const todayStats = useMemo(() => ({
    total: todayEvents.length,
    high: todayEvents.filter((e) => e.impact === "high").length,
    medium: todayEvents.filter((e) => e.impact === "medium").length,
    low: todayEvents.filter((e) => e.impact === "low").length,
    completed: todayEvents.filter((e) => e.actual).length,
    upcoming: todayEvents.filter((e) => !e.actual).length,
  }), [todayEvents]);

  const nextHighImpactEvent = useMemo(() => {
    return events
      .filter((e) => e.event_datetime && new Date(e.event_datetime) > now && e.impact === "high")
      .sort((a, b) => new Date(a.event_datetime) - new Date(b.event_datetime))[0] || null;
  }, [events, now]);

  const nextHighImpactCountdown = nextHighImpactEvent
    ? formatCountdown(new Date(nextHighImpactEvent.event_datetime) - now, t("calendar.dayUnit"))
    : null;

  const highImpactUpcomingCount = useMemo(
    () => events.filter((e) => e.event_datetime && new Date(e.event_datetime) > now && e.impact === "high").length,
    [events, now]
  );

  // عدد العملات النشطة فعلياً اليوم (لها خبر واحد على الأقل بقاعدة البيانات)
  const activeCurrenciesCount = useMemo(
    () => new Set(todayEvents.map((e) => e.currency).filter(Boolean)).size,
    [todayEvents]
  );

  // عدد فرص التداول = نفس منطق BestOpportunitiesPanel بالضبط (عملات لأخبار
  // عالية/متوسطة التأثير اليوم وموجود لها قوة عملة حقيقية بلقطة السوق الحية)
  const opportunitiesCount = useMemo(() => {
    if (!marketSnapshot?.currencies) return 0;
    const relevant = todayEvents.filter((e) => (e.impact === "high" || e.impact === "medium") && marketSnapshot.currencies[e.currency] != null);
    return new Set(relevant.map((e) => e.currency)).size;
  }, [todayEvents, marketSnapshot]);
  const opportunitiesReady = !!marketSnapshot?.currencies;

  function formatArabicDate(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", { weekday: "long", day: "numeric", month: "long" });
  }

  if (loading) {
    return (
      <div style={{ color: "#666", fontSize: 14, padding: "3rem 0", textAlign: "center" }}>
        {t("calendar.loadingCalendar")}
      </div>
    );
  }

  const impact = selectedEvent ? (IMPACT_KEYS[selectedEvent.impact] || IMPACT_KEYS.low) : null;
  const flag = selectedEvent ? (CURRENCY_FLAGS[selectedEvent.currency] || "🌐") : null;
  const countdownMs = selectedEvent?.event_datetime ? new Date(selectedEvent.event_datetime) - now : null;
  const countdown = countdownMs !== null ? formatCountdown(countdownMs, t("calendar.dayUnit")) : null;
  const aiData = selectedEvent?.ai_data || null;

  const impactPct = !selectedEvent ? 0 : selectedEvent.impact === "high" ? 85 : selectedEvent.impact === "medium" ? 55 : 25;
  const impactStrengthLabel = impactPct >= 75 ? t("calendar.impactVeryStrong") : impactPct >= 45 ? t("calendar.impactMediumStrength") : t("calendar.impactLimited");

  // ملاحظة: حساب عادي (وليس useMemo) عن قصد، لأنه واقع بعد شرط "if (loading) return"
  // أعلاه؛ استخدام hook هنا كان سيكسر ترتيب الـ Hooks بين الرندرات (قاعدة Hooks في React).
  const assetDistribution = (() => {
    if (aiData?.assets?.length) {
      return aiData.assets.slice(0, 4).map((a) => ({
        name: a.symbol || a.name,
        pct: a.strength === "strong" ? 85 : a.strength === "medium" ? 55 : 30,
      }));
    }
    if (!selectedEvent) return [];
    const base = selectedEvent.impact === "high" ? 80 : selectedEvent.impact === "medium" ? 55 : 30;
    return [
      { name: selectedEvent.currency || "USD", pct: base },
      { name: "Gold", pct: Math.max(15, base - 20) },
      { name: "Stocks", pct: Math.max(15, base - 15) },
      { name: "Oil", pct: Math.max(10, base - 40) },
    ];
  })();

  return (
    <div>
      <MICHeaderBar
        search={search}
        setSearch={setSearch}
        tzOffset={tzOffset}
        setTzOffset={setTzOffset}
        now={now}
        onRefresh={() => {
          setNow(new Date());
          setSnapshotRefreshTick((n) => n + 1);
        }}
        highImpactUpcomingCount={highImpactUpcomingCount}
      />

      <KPICardsRow
        todayStats={todayStats}
        activeCurrenciesCount={activeCurrenciesCount}
        opportunitiesCount={opportunitiesCount}
        opportunitiesReady={opportunitiesReady}
      />

      {/* الصف الرئيسي: العمود الرئيسي (الخبر + AI + Tabs + الأدوات) والشريط الجانبي */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.1rem", alignItems: "start" }}>
        {/* العمود الرئيسي */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0 }}>
          {!selectedEvent ? (
            <div style={{ ...cardStyle, padding: "3rem", textAlign: "center", color: "#666", fontSize: 13 }}>
              {t("calendar.selectEventPrompt")}
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "1rem", alignItems: "start" }}>
                {/* بطاقة الخبر المختار */}
                <div style={{ ...cardStyle, padding: "1.2rem 1.4rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{
                        background: impact.bg, color: impact.color, fontSize: 11, fontWeight: 700,
                        padding: "4px 12px", borderRadius: 20, whiteSpace: "nowrap",
                      }}>
                        {impact.dot} {t(impact.labelKey)}
                      </span>
                      <div>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>
                          {flag} {selectedEvent.event_title}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>
                          {selectedEvent.currency} · {formatArabicDate(selectedEvent.event_date)} · {selectedEvent.event_time}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* السابق / التوقع / الفعلي / العد التنازلي */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem" }}>
                    {[
                      { label: t("calendar.previousLabel"), value: selectedEvent.previous },
                      { label: t("calendar.forecastLabel"), value: selectedEvent.forecast },
                      { label: t("calendar.actualLabel"), value: selectedEvent.actual, gold: true },
                      { label: t("calendar.countdownLabel"), value: countdown, live: true },
                    ].map((s, i) => (
                      <div key={i} style={{ background: "#0D0E10", border: `1px solid ${GOLD}22`, borderRadius: 10, padding: "0.6rem", textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: 10, color: "#888" }}>{s.label}</p>
                        <p style={{
                          margin: "5px 0 0", fontSize: 14, fontWeight: 800, direction: s.live ? "ltr" : undefined,
                          color: s.value ? (s.gold ? GOLD_LIGHT : s.live ? impact.color : "#fff") : "#444",
                        }}>
                          {s.value || "--"}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* قوة التأثير + توزيع التأثير على الأصول */}
                  <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ textAlign: "center" }}>
                      <SemiGauge value={impactPct} size={116} colors={["#3DBB6E", "#F5A623", "#E5484D"]} gradId="impact" />
                      <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 800, color: impact.color }}>{impactPct}%</p>
                      <p style={{ margin: 0, fontSize: 10, color: "#888" }}>{impactStrengthLabel}</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 6 }}>
                      <p style={{ margin: "0 0 2px", fontSize: 10.5, color: "#888" }}>{t("calendar.impactDistributionTitle")}</p>
                      {assetDistribution.map((a, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 10, color: "#aaa", minWidth: 46 }}>{a.name}</span>
                          <div style={{ flex: 1, height: 5, borderRadius: 5, background: "#1a1a12", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${a.pct}%`, borderRadius: 5, background: GOLD_LIGHT }} />
                          </div>
                          <span style={{ fontSize: 9.5, color: "#888", minWidth: 26, textAlign: "left" }}>{a.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* بطاقة تحليل الذكاء الاصطناعي */}
                <div style={{
                  ...cardStyle, padding: "1.2rem 1.4rem",
                  background: "linear-gradient(135deg, #1a1030, #0D0E10)", border: "1px solid #7c5cff33",
                }}>
                  <p style={{ color: PURPLE_LIGHT, fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>{t("calendar.aiAnalysisTitle")}</p>
                  {!aiData ? (
                    <>
                      <p style={{ margin: 0, fontSize: 12.5, color: "#ccc", lineHeight: 1.85 }}>{buildFallbackAnalysis(selectedEvent, { t, raw })}</p>
                      {(selectedEvent.impact === "high" || selectedEvent.impact === "medium") && (
                        <p style={{ margin: "12px 0 0", fontSize: 11, color: analyzingId === selectedEvent.id ? PURPLE_LIGHT : "#666" }}>
                          {analyzingId === selectedEvent.id
                            ? t("calendar.aiPreparing")
                            : analysisFailedIds[selectedEvent.id]
                            ? t("calendar.aiFailedRetry")
                            : t("calendar.aiComingSoon")}
                        </p>
                      )}
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{
                        width: 76, height: 76, borderRadius: "50%", flexShrink: 0,
                        background: `conic-gradient(${PURPLE} ${aiData.confidence * 3.6}deg, #1a1a2a 0deg)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <div style={{ width: 58, height: 58, borderRadius: "50%", background: "#0d0d14", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{aiData.confidence}%</span>
                          <span style={{ fontSize: 8, color: "#999" }}>{t("calendar.confidenceLabel")}</span>
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <p style={{ margin: "0 0 4px", fontSize: 11.5, color: "#eee" }}>
                          {t("calendar.directionLabel")} <span style={{ color: PURPLE_LIGHT, fontWeight: 700 }}>
                            {aiData.direction === "down" ? t("calendar.directionDown") : aiData.direction === "up" ? t("calendar.directionUp") : t("calendar.directionNeutral")}
                          </span>
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: "#ccc", lineHeight: 1.75 }}>{aiData.summary}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs التحليل */}
              <div style={{ ...cardStyle, padding: "1.2rem 1.3rem" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: "1.1rem", flexWrap: "wrap" }}>
                  {[
                    { key: "overview", label: "Overview", icon: "🧭" },
                    { key: "technical", label: "Technical View", icon: "🎯" },
                    { key: "historical", label: "Historical Data", icon: "📜" },
                    { key: "plan", label: "Trading Plan", icon: "⚠️" },
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setAnalysisTab(t.key)}
                      style={{
                        background: analysisTab === t.key ? `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})` : "#0D0E10",
                        color: analysisTab === t.key ? "#000" : "#999",
                        border: analysisTab === t.key ? "none" : `1px solid ${GOLD}22`,
                        borderRadius: 8, padding: "0.5rem 0.9rem", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                {analysisTab === "overview" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {aiData?.scenarios?.length > 0 ? (
                      <div>
                        <p style={{ color: GOLD, fontSize: 13, fontWeight: 700, margin: "0 0 0.9rem" }}>{t("calendar.scenariosTitle")}</p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.8rem" }}>
                          {aiData.scenarios.map((sc, i) => (
                            <div key={i} style={{ background: "#0D0E10", border: `1px solid ${GOLD}22`, borderRadius: 10, padding: "0.9rem" }}>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#eee" }}>{sc.title}</p>
                              <p style={{ margin: "8px 0 4px", fontSize: 20, fontWeight: 800, color: GOLD_LIGHT }}>{sc.probability}%</p>
                              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#f5c542" }}>{"⭐".repeat(Math.max(1, Math.min(5, sc.stars || 1)))}</p>
                              <p style={{ margin: 0, fontSize: 11, color: "#888", lineHeight: 1.6 }}>{sc.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: "1.5rem", textAlign: "center", color: "#666", fontSize: 12.5 }}>
                        {t("calendar.scenariosEmpty")}
                      </div>
                    )}
                  </div>
                )}

                {analysisTab === "technical" && (
                  aiData?.assets?.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      {aiData.assets.map((a, i) => {
                        const dir = DIRECTION_STYLE[a.direction] || DIRECTION_STYLE.neutral;
                        const strengthPct = a.strength === "strong" ? 90 : a.strength === "medium" ? 55 : 25;
                        return (
                          <div key={i} style={{ padding: "0.6rem 0", borderBottom: i < aiData.assets.length - 1 ? "1px solid #1a1a0f" : "none" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span>{dir.arrow}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#eee" }}>{a.name}</span>
                                <span style={{ fontSize: 11, color: "#666" }}>{a.symbol}</span>
                              </div>
                              <span style={{ fontSize: 11.5, color: dir.color, fontWeight: 700 }}>
                                {a.direction === "up" ? t("calendar.directionUp") : a.direction === "down" ? t("calendar.directionDown") : t("calendar.directionNeutral")} {STRENGTH_KEYS[a.strength] ? t(STRENGTH_KEYS[a.strength]) : ""}
                              </span>
                            </div>
                            <div style={{ height: 6, borderRadius: 6, background: "#1a1a12", overflow: "hidden" }}>
                              <div style={{ height: "100%", borderRadius: 6, background: dir.color, width: `${strengthPct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "#666", fontSize: 12.5 }}>
                      {t("calendar.noTechnicalYet")}
                    </div>
                  )
                )}

                {analysisTab === "historical" && (
                  <div>
                    {(aiData?.historical_examples || []).length === 0 ? (
                      <div style={{ padding: "1.5rem", textAlign: "center", color: "#666", fontSize: 12.5 }}>
                        {t("calendar.historicalEmpty")}
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                          {[...aiData.historical_examples]
                            .sort((a, b) => (b.year || "").localeCompare(a.year || ""))
                            .map((h, i) => {
                              const dir = DIRECTION_STYLE[h.direction] || DIRECTION_STYLE.neutral;
                              return (
                                <div key={i} style={{
                                  display: "flex", alignItems: "center", gap: 12, background: "#0D0E10",
                                  border: `1px solid ${GOLD}22`, borderRadius: 10, padding: "0.7rem 0.9rem",
                                }}>
                                  <span style={{
                                    fontSize: 12, fontWeight: 800, color: GOLD_LIGHT, minWidth: 44, textAlign: "center",
                                    border: `1px solid ${GOLD}33`, borderRadius: 8, padding: "3px 6px",
                                  }}>
                                    {h.year}
                                  </span>
                                  <span style={{ fontSize: 15 }}>{dir.arrow}</span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#eee" }}>
                                      {h.asset} {h.symbol && <span style={{ color: "#666", fontWeight: 400 }}>({h.symbol})</span>}
                                    </p>
                                    {h.note && <p style={{ margin: "3px 0 0", fontSize: 11, color: "#888" }}>{h.note}</p>}
                                  </div>
                                  {h.change_pct && (
                                    <span style={{ fontSize: 13, fontWeight: 800, color: dir.color, direction: "ltr" }}>
                                      {h.direction === "down" ? "-" : "+"}{h.change_pct}%
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                        <p style={{ margin: "0.9rem 0 0", fontSize: 10.5, color: "#555" }}>
                          {t("calendar.historicalDisclaimer")}
                        </p>
                      </>
                    )}
                  </div>
                )}

                {analysisTab === "plan" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.2rem" }}>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 11.5, color: "#888", fontWeight: 700 }}>{t("calendar.beforeNewsTitle")}</p>
                      {(aiData?.tips_before?.length > 0 ? aiData.tips_before : raw("calendar.genericTipsBefore") || []).map((tip, i) => (
                        <p key={i} style={{ margin: "0 0 5px", fontSize: 12, color: "#ccc" }}>❌ {tip}</p>
                      ))}
                    </div>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 11.5, color: "#888", fontWeight: 700 }}>{t("calendar.afterNewsTitle")}</p>
                      {(aiData?.tips_after?.length > 0 ? aiData.tips_after : raw("calendar.genericTipsAfter") || []).map((tip, i) => (
                        <p key={i} style={{ margin: "0 0 5px", fontSize: 12, color: "#ccc" }}>✅ {tip}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* قوة العملات + الخريطة الحرارية */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <CurrencyStrengthMeter snapshot={marketSnapshot} loading={marketSnapshotLoading} error={marketSnapshotError} />
                <MarketHeatmap snapshot={marketSnapshot} loading={marketSnapshotLoading} error={marketSnapshotError} />
              </div>

              {/* الرسم البياني */}
              <PriceChart />

              {/* Trading Plan / التحليل الفني / الخوف والطمع / مفاجأة البيانات */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
                <TradingPlanChecklist />
                <TechnicalAnalysisPanel currency={selectedEvent.currency} />
                <FearGreedGauge snapshot={marketSnapshot} loading={marketSnapshotLoading} error={marketSnapshotError} />
                <EconomicSurpriseIndex events={events} />
              </div>
            </>
          )}
        </div>

        {/* الشريط الجانبي: التقويم الاقتصادي + أفضل فرص التداول */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ ...cardStyle, padding: "1rem 1.1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#fff" }}>{t("calendar.economicCalendarTitle")}</p>
              {nextHighImpactEvent && (
                <span style={{ fontSize: 9.5, color: "#E5484D", fontWeight: 700, direction: "ltr" }}>
                  ⏱ {nextHighImpactCountdown || "--"}
                </span>
              )}
            </div>

            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              style={{
                width: "100%", background: "#0D0E10", border: `1px solid ${GOLD}33`, borderRadius: 8,
                padding: "0.5rem 0.6rem", color: "#ccc", fontSize: 11.5, marginBottom: 8,
              }}
            >
              <option value="all">{t("calendar.allDays")}</option>
              {days.map((d) => (
                <option key={d} value={d}>{formatArabicDate(d)}</option>
              ))}
            </select>

            <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
              {[
                { key: "all", labelKey: "calendar.filterAll", color: GOLD_LIGHT },
                { key: "high", labelKey: "calendar.filterHigh", color: "#E5484D" },
                { key: "medium", labelKey: "calendar.filterMedium", color: "#F5A623" },
                { key: "low", labelKey: "calendar.filterLow", color: "#3DBB6E" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setImpactFilter(f.key)}
                  style={{
                    flex: 1,
                    background: impactFilter === f.key ? `${f.color}22` : "#0D0E10",
                    color: impactFilter === f.key ? f.color : "#999",
                    border: impactFilter === f.key ? `1px solid ${f.color}66` : `1px solid ${GOLD}22`,
                    borderRadius: 8, padding: "0.4rem 0.2rem", fontSize: 9.5, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", maxHeight: 560, overflowY: "auto", paddingLeft: 2 }}>
              {grouped.length === 0 && (
                <div style={{ padding: "2rem 0.5rem", textAlign: "center", color: "#666", fontSize: 12 }}>
                  {t("calendar.noMatchingEvents")}
                </div>
              )}
              {grouped.map(([date, dayEvents]) => (
                <div key={date}>
                  <p style={{ color: "#666", fontSize: 11, fontWeight: 700, margin: "0 0 0.5rem" }}>{formatArabicDate(date)}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {dayEvents.map((ev) => {
                      const impactStyle = IMPACT_KEYS[ev.impact] || IMPACT_KEYS.low;
                      const isSelected = selectedEvent?.id === ev.id;
                      const evCountdown = ev.event_datetime && new Date(ev.event_datetime) > now
                        ? formatCountdown(new Date(ev.event_datetime) - now, t("calendar.dayUnit"))
                        : null;
                      return (
                        <div
                          key={ev.id}
                          onClick={() => setSelectedId(ev.id)}
                          style={{
                            background: isSelected ? `${GOLD}14` : "#0D0E10",
                            border: isSelected ? `1px solid ${GOLD}66` : `1px solid ${GOLD}1a`,
                            borderRadius: 10, padding: "0.65rem 0.8rem", cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              <span style={{ fontSize: 11, color: "#888" }}>{ev.event_time}</span>
                              <span style={{ fontSize: 15 }}>{CURRENCY_FLAGS[ev.currency] || "🌐"}</span>
                            </div>
                            <span style={{ fontSize: 12 }}>{impactStyle.dot}</span>
                          </div>
                          <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 700, color: "#eee", lineHeight: 1.4 }}>{ev.event_title}</p>
                          <div style={{ display: "flex", gap: "0.7rem", marginTop: 6, fontSize: 10, color: "#777", flexWrap: "wrap" }}>
                            {ev.previous && <span>{t("calendar.previousShort")} {ev.previous}</span>}
                            {ev.forecast && <span>{t("calendar.forecastShort")} {ev.forecast}</span>}
                            {ev.actual && <span style={{ color: GOLD_LIGHT }}>{t("calendar.actualShort")} {ev.actual}</span>}
                            {!ev.actual && evCountdown && <span style={{ color: impactStyle.color, direction: "ltr" }}>⏱ {evCountdown}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <BestOpportunitiesPanel events={todayEvents} snapshot={marketSnapshot} />
        </div>
      </div>

      <MICFooter tzOffset={tzOffset} lastUpdated={lastUpdated} />
    </div>
  );
}






/* -------------------- غلاف الصفحة: يجيب البيانات ويعرض CalendarView -------------------- */
export default function EconomicCalendarClient({ isAdmin = false }) {
  const [economicEvents, setEconomicEvents] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadCalendar(isFirstLoad) {
      if (isFirstLoad) setCalendarLoading(true);
      const supabase = createClient();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 1);
      const fromDateStr = fromDate.toISOString().split("T")[0];

      const { data } = await supabase
        .from("economic_events")
        .select("*")
        .gte("event_date", fromDateStr)
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true });
      if (!active) return;
      setEconomicEvents(data || []);
      if (isFirstLoad) setCalendarLoading(false);
    }
    loadCalendar(true);
    const interval = setInterval(() => loadCalendar(false), 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return <CalendarView events={economicEvents} loading={calendarLoading} isAdmin={isAdmin} />;
}
