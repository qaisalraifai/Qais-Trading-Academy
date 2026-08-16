/* ============================================================================
   lib/qais/structure/verify/match.js
   مطابقة أحداث المحرك بسياق الصفقات التاريخية.

   ⚠️ قاعدة الملف كله: qais_ai_trades **مش ground truth**.
   ---------------------------------------------------------------------------
   الصفقة بتقول: «المحرك القديم شاف إعداد باتجاه معيّن، على فريم معيّن،
   بلحظة معيّنة». هي **مرجع سياقي** — مصدره محرك سابق أثبتنا فيه أخطاء
   (فهرسة الكسر، تضخّم الأحداث ٧٤٥/٢٩٨٢، CHOCH اسم مكرر للـMSS).

   فاللي منقيسه هون هو **التوافق** والفارق الزمني/السعري، مش الصح والغلط.
   «غير متطابق» ممكن يكون: المحرك الجديد صح والقديم غلط، أو العكس، أو
   الاتنين صح بتعريفين مختلفين. التصنيف النهائي قرار بشري بعد التقرير.

   ولهيك كمان: **False Positives ما بتنقاس من الصفقات**. المتداول ما بياخد
   كل حدث هيكلي، فحدث بلا صفقة مش إشارة كاذبة. بينتسجّل Insufficient Data.
   ============================================================================ */

import { priceDeltaInTicks } from "./precision.js";

export const MATCH_STATUS = {
  MATCHED: "matched",
  DIRECTION_MISMATCH: "direction_mismatch",
  UNMATCHED: "unmatched",
  INSUFFICIENT_DATA: "insufficient_data",
};

/** ثواني الشمعة لكل فريم — لتحويل الفارق الزمني لعدد شموع ودقائق. */
export const TF_SECONDS = {
  daily: 86400,
  d1: 86400,
  h4: 14400,
  h1: 3600,
  m15: 900,
  m5: 300,
  m1: 60,
};

export function tfSeconds(tf) {
  if (!tf) return null;
  return TF_SECONDS[String(tf).toLowerCase()] ?? null;
}

/** اتجاه الصفقة بصيغة المحرك. */
function normalizeDirection(d) {
  const s = String(d || "").toLowerCase();
  if (["up", "buy", "long", "bullish"].includes(s)) return "up";
  if (["down", "sell", "short", "bearish"].includes(s)) return "down";
  return null;
}

/**
 * مطابقة صفقة واحدة.
 *
 * @param trade      صف من qais_ai_trades
 * @param events     أحداث المحرك على نفس الفريم (مع index/time/price)
 * @param candles    شموع نفس الفريم
 * @param precision  ناتج inferPrecision
 * @param options    { windowCandles, eventTypes }
 */
export function matchTrade(trade, events, candles, precision, options = {}) {
  const { windowCandles = 20, eventTypes = ["MSS", "BOS"] } = options;

  const timeframe = trade.timeframe || null;
  const secs = tfSeconds(timeframe);
  const direction = normalizeDirection(trade.direction);
  const refTimeMs = Date.parse(trade.created_at ?? trade.entry_time ?? "");
  const refTime = Number.isFinite(refTimeMs) ? Math.floor(refTimeMs / 1000) : null;
  const refPrice = Number.isFinite(trade.entry) ? trade.entry : null;

  const base = {
    tradeId: trade.id ?? null,
    symbol: trade.symbol ?? null,
    timeframe,
    direction,
    refTime,
    refPrice,
    status: MATCH_STATUS.INSUFFICIENT_DATA,
    reason: null,
    engineEvent: null,
    timing: null,
    price: null,
  };

  if (!direction) return { ...base, reason: "اتجاه الصفقة غير معروف" };
  if (refTime == null) return { ...base, reason: "ما في وقت مرجعي (created_at) صالح" };
  if (secs == null) return { ...base, reason: `فريم غير معروف: ${timeframe}` };
  if (!Array.isArray(candles) || candles.length === 0) return { ...base, reason: "ما في شموع لهالفريم" };

  const first = candles[0].time;
  const last = candles[candles.length - 1].time;
  if (refTime < first || refTime > last) {
    return { ...base, reason: `وقت الصفقة خارج نطاق الشموع المتوفرة (${first}..${last})` };
  }

  const windowSecs = windowCandles * secs;
  const inWindow = (events || []).filter(
    (e) => eventTypes.includes(e.type) && Math.abs(e.time - refTime) <= windowSecs
  );

  if (inWindow.length === 0) {
    return {
      ...base,
      status: MATCH_STATUS.UNMATCHED,
      reason: `ما في حدث هيكلي ضمن ±${windowCandles} شمعة من وقت الصفقة`,
    };
  }

  const sameDir = inWindow.filter((e) => e.direction === direction);
  const pool = sameDir.length ? sameDir : inWindow;

  // الأقرب زمنياً للمرجع
  pool.sort((a, b) => Math.abs(a.time - refTime) - Math.abs(b.time - refTime));
  const ev = pool[0];

  const deltaSecs = ev.time - refTime; // موجب = المحرك متأخر
  const timing = {
    engineTime: ev.time,
    referenceTime: refTime,
    diffSeconds: deltaSecs,
    diffCandles: +(deltaSecs / secs).toFixed(2),
    diffMinutes: +(deltaSecs / 60).toFixed(1),
    engineIsLate: deltaSecs > 0,
  };

  let price = null;
  if (refPrice != null && Number.isFinite(ev.price)) {
    const diff = ev.price - refPrice;
    price = {
      referencePrice: refPrice,
      enginePrice: ev.price,
      absoluteDiff: +Math.abs(diff).toFixed(6),
      percentDiff: refPrice !== 0 ? +((Math.abs(diff) / Math.abs(refPrice)) * 100).toFixed(4) : null,
      diffInTicks: priceDeltaInTicks(diff, precision),
    };
  }

  return {
    ...base,
    status: sameDir.length ? MATCH_STATUS.MATCHED : MATCH_STATUS.DIRECTION_MISMATCH,
    reason: sameDir.length
      ? `${ev.type} ${ev.direction} ضمن النافذة`
      : `في أحداث بالنافذة بس كلها بعكس اتجاه الصفقة (${inWindow.map((e) => e.direction).join(",")})`,
    engineEvent: {
      id: ev.id,
      type: ev.type,
      direction: ev.direction,
      time: ev.time,
      index: ev.index,
      price: ev.price,
      strength: ev.strength,
      confidence: ev.confidence,
      fakeBreak: ev.fakeBreak,
      reason: ev.reason,
    },
    candidatesInWindow: inWindow.length,
    timing,
    price,
  };
}

/** إحصاءات موزّعة (متوسط/وسيط/أدنى/أقصى) — null لو ما في عيّنة. */
export function describe(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return { n: 0, mean: null, median: null, min: null, max: null };
  const mid = Math.floor(v.length / 2);
  return {
    n: v.length,
    mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3),
    median: +(v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2).toFixed(3),
    min: +v[0].toFixed(3),
    max: +v[v.length - 1].toFixed(3),
  };
}
