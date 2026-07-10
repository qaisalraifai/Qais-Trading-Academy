/* ============================================================================
   lib/indicators.js
   مكتبة مؤشرات فنية عامة تُحسب من بيانات الشموع (OHLC) بس - بدون فوليوم،
   لأن مصدر بيانات الريبلاي/الباك تيست ما بيوفر فوليوم حقيقي بكل الأصول.

   كل مؤشر معرّف بـ:
     id          - معرّف فريد ثابت
     name        - الاسم يلي بيظهر بالعربي
     aliases     - كلمات بحث إضافية (عربي/انجليزي/اختصارات) عشان البحث يلاقيه
     type        - "overlay" (يترسم فوق شارت السعر) أو "oscillator" (لوحة منفصلة تحت)
     params      - إعدادات المؤشر (فترة، انحراف معياري...الخ) قابلة للتعديل
     lines       - كل خط رح يترسم: { key, label, color, lineWidth?, lineStyle? }
     calc(candles, params) -> object { [lineKey]: [{ time, value }, ...] }

   candles المتوقعة: [{ time, open, high, low, close }, ...] مرتبة زمنياً تصاعدياً
   ============================================================================ */

/* ------------------------- أدوات حساب أساسية ------------------------- */

function closes(candles) { return candles.map((c) => c.close); }

function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function ema(values, period) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    if (values[i] == null) { out[i] = prev; continue; }
    if (prev == null) {
      // نبلّش أول EMA بمتوسط بسيط لأول period نقطة عشان نتيجة أدق وأثبت
      if (i >= period - 1) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += values[j];
        prev = sum / period;
        out[i] = prev;
      }
    } else {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

function wma(values, period) {
  const out = new Array(values.length).fill(null);
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += values[i - j] * (period - j);
    out[i] = sum / denom;
  }
  return out;
}

function stddevArr(values, period, meanArr) {
  const out = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const mean = meanArr ? meanArr[i] : values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    if (mean == null) continue;
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) sq += (values[j] - mean) ** 2;
    out[i] = Math.sqrt(sq / period);
  }
  return out;
}

function shift(values, n) {
  const out = new Array(values.length).fill(null);
  for (let i = n; i < values.length; i++) out[i] = values[i - n];
  return out;
}

function highs(candles) { return candles.map((c) => c.high); }
function lows(candles) { return candles.map((c) => c.low); }

function trueRange(candles) {
  const out = new Array(candles.length).fill(null);
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { out[i] = candles[i].high - candles[i].low; continue; }
    const pc = candles[i - 1].close;
    out[i] = Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - pc), Math.abs(candles[i].low - pc));
  }
  return out;
}

/* متوسط وايلدر (Wilder's smoothing) - مستخدم بـ RSI/ATR/ADX الأصلية */
function wilderSmooth(values, period) {
  const out = new Array(values.length).fill(null);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    if (values[i] == null) continue;
    if (prev == null) {
      const slice = values.slice(Math.max(0, i - period + 1), i + 1);
      if (slice.length < period) continue;
      prev = slice.reduce((a, b) => a + b, 0) / period;
    } else {
      prev = (prev * (period - 1) + values[i]) / period;
    }
    out[i] = prev;
  }
  return out;
}

function toSeries(candles, arr) {
  return candles.map((c, i) => ({ time: c.time, value: arr[i] })).filter((p) => p.value != null && Number.isFinite(p.value));
}

/* ------------------------- Overlays (فوق شارت السعر) ------------------------- */

function calcSMA(candles, p) { return { main: toSeries(candles, sma(closes(candles), p.period)) }; }
function calcEMA(candles, p) { return { main: toSeries(candles, ema(closes(candles), p.period)) }; }
function calcWMA(candles, p) { return { main: toSeries(candles, wma(closes(candles), p.period)) }; }

function calcDEMA(candles, p) {
  const c = closes(candles);
  const e1 = ema(c, p.period);
  const e2 = ema(e1.map((v) => (v == null ? null : v)), p.period);
  const dema = c.map((_, i) => (e1[i] == null || e2[i] == null ? null : 2 * e1[i] - e2[i]));
  return { main: toSeries(candles, dema) };
}

function calcTEMA(candles, p) {
  const c = closes(candles);
  const e1 = ema(c, p.period);
  const e2 = ema(e1, p.period);
  const e3 = ema(e2, p.period);
  const tema = c.map((_, i) => (e1[i] == null || e2[i] == null || e3[i] == null ? null : 3 * e1[i] - 3 * e2[i] + e3[i]));
  return { main: toSeries(candles, tema) };
}

function calcHMA(candles, p) {
  const c = closes(candles);
  const half = Math.max(1, Math.round(p.period / 2));
  const sqrtP = Math.max(1, Math.round(Math.sqrt(p.period)));
  const wmaHalf = wma(c, half);
  const wmaFull = wma(c, p.period);
  const diff = c.map((_, i) => (wmaHalf[i] == null || wmaFull[i] == null ? null : 2 * wmaHalf[i] - wmaFull[i]));
  const filled = diff.map((v) => v); // wma بتتجاهل null تلقائياً بالحلقة تبعها لأنها بتبلش من period-1
  const hma = wma(filled.map((v) => (v == null ? 0 : v)), sqrtP);
  // نلغي أي نقطة كانت أصلاً null قبل الفتره الكافية
  const out = hma.map((v, i) => (diff[i] == null ? null : v));
  return { main: toSeries(candles, out) };
}

function calcBollinger(candles, p) {
  const c = closes(candles);
  const mid = sma(c, p.period);
  const sd = stddevArr(c, p.period, mid);
  const upper = c.map((_, i) => (mid[i] == null ? null : mid[i] + sd[i] * p.stdDev));
  const lower = c.map((_, i) => (mid[i] == null ? null : mid[i] - sd[i] * p.stdDev));
  return { upper: toSeries(candles, upper), mid: toSeries(candles, mid), lower: toSeries(candles, lower) };
}

function calcEnvelope(candles, p) {
  const c = closes(candles);
  const mid = sma(c, p.period);
  const upper = mid.map((v) => (v == null ? null : v * (1 + p.percent / 100)));
  const lower = mid.map((v) => (v == null ? null : v * (1 - p.percent / 100)));
  return { upper: toSeries(candles, upper), mid: toSeries(candles, mid), lower: toSeries(candles, lower) };
}

function calcKeltner(candles, p) {
  const c = closes(candles);
  const mid = ema(c, p.period);
  const tr = trueRange(candles);
  const atr = wilderSmooth(tr, p.atrPeriod);
  const upper = c.map((_, i) => (mid[i] == null || atr[i] == null ? null : mid[i] + atr[i] * p.mult));
  const lower = c.map((_, i) => (mid[i] == null || atr[i] == null ? null : mid[i] - atr[i] * p.mult));
  return { upper: toSeries(candles, upper), mid: toSeries(candles, mid), lower: toSeries(candles, lower) };
}

function calcDonchian(candles, p) {
  const h = highs(candles), l = lows(candles);
  const upper = new Array(candles.length).fill(null);
  const lower = new Array(candles.length).fill(null);
  const mid = new Array(candles.length).fill(null);
  for (let i = p.period - 1; i < candles.length; i++) {
    let hi = -Infinity, lo = Infinity;
    for (let j = i - p.period + 1; j <= i; j++) { if (h[j] > hi) hi = h[j]; if (l[j] < lo) lo = l[j]; }
    upper[i] = hi; lower[i] = lo; mid[i] = (hi + lo) / 2;
  }
  return { upper: toSeries(candles, upper), mid: toSeries(candles, mid), lower: toSeries(candles, lower) };
}

function calcPSAR(candles, p) {
  const out = new Array(candles.length).fill(null);
  if (candles.length < 2) return { main: [] };
  let bullish = true;
  let af = p.step;
  let ep = candles[0].high;
  let sar = candles[0].low;
  out[0] = sar;
  for (let i = 1; i < candles.length; i++) {
    sar = sar + af * (ep - sar);
    const hi = candles[i].high, lo = candles[i].low;
    if (bullish) {
      sar = Math.min(sar, candles[i - 1].low, i >= 2 ? candles[i - 2].low : candles[i - 1].low);
      if (lo < sar) {
        bullish = false; sar = ep; ep = lo; af = p.step;
      } else if (hi > ep) { ep = hi; af = Math.min(p.max, af + p.step); }
    } else {
      sar = Math.max(sar, candles[i - 1].high, i >= 2 ? candles[i - 2].high : candles[i - 1].high);
      if (hi > sar) {
        bullish = true; sar = ep; ep = hi; af = p.step;
      } else if (lo < ep) { ep = lo; af = Math.min(p.max, af + p.step); }
    }
    out[i] = sar;
  }
  return { main: toSeries(candles, out) };
}

function calcSuperTrend(candles, p) {
  const tr = trueRange(candles);
  const atr = wilderSmooth(tr, p.period);
  const hl2 = candles.map((c) => (c.high + c.low) / 2);
  const upperBasic = hl2.map((v, i) => (atr[i] == null ? null : v + p.mult * atr[i]));
  const lowerBasic = hl2.map((v, i) => (atr[i] == null ? null : v - p.mult * atr[i]));
  const out = new Array(candles.length).fill(null);
  let trend = 1; // 1 = صاعد, -1 = هابط
  let finalUpper = null, finalLower = null;
  for (let i = 0; i < candles.length; i++) {
    if (upperBasic[i] == null) continue;
    const close = candles[i].close;
    if (finalUpper == null) { finalUpper = upperBasic[i]; finalLower = lowerBasic[i]; out[i] = finalLower; continue; }
    finalUpper = (upperBasic[i] < finalUpper || candles[i - 1].close > finalUpper) ? upperBasic[i] : finalUpper;
    finalLower = (lowerBasic[i] > finalLower || candles[i - 1].close < finalLower) ? lowerBasic[i] : finalLower;
    if (trend === 1 && close < finalLower) trend = -1;
    else if (trend === -1 && close > finalUpper) trend = 1;
    out[i] = trend === 1 ? finalLower : finalUpper;
  }
  return { main: toSeries(candles, out) };
}

function calcIchimoku(candles, p) {
  const h = highs(candles), l = lows(candles);
  const mid = (period) => {
    const out = new Array(candles.length).fill(null);
    for (let i = period - 1; i < candles.length; i++) {
      let hi = -Infinity, lo = Infinity;
      for (let j = i - period + 1; j <= i; j++) { if (h[j] > hi) hi = h[j]; if (l[j] < lo) lo = l[j]; }
      out[i] = (hi + lo) / 2;
    }
    return out;
  };
  const tenkan = mid(p.conversion);
  const kijun = mid(p.base);
  const spanA = tenkan.map((v, i) => (v == null || kijun[i] == null ? null : (v + kijun[i]) / 2));
  const spanB = mid(p.spanB);
  return {
    tenkan: toSeries(candles, tenkan),
    kijun: toSeries(candles, kijun),
    spanA: toSeries(candles, spanA),
    spanB: toSeries(candles, spanB),
  };
}

/* ------------------------- Oscillators (لوحة منفصلة تحت) ------------------------- */

function calcRSI(candles, p) {
  const c = closes(candles);
  const gains = new Array(c.length).fill(null);
  const losses = new Array(c.length).fill(null);
  for (let i = 1; i < c.length; i++) {
    const diff = c[i] - c[i - 1];
    gains[i] = Math.max(diff, 0);
    losses[i] = Math.max(-diff, 0);
  }
  const avgGain = wilderSmooth(gains, p.period);
  const avgLoss = wilderSmooth(losses, p.period);
  const rsi = c.map((_, i) => {
    if (avgGain[i] == null || avgLoss[i] == null) return null;
    if (avgLoss[i] === 0) return 100;
    const rs = avgGain[i] / avgLoss[i];
    return 100 - 100 / (1 + rs);
  });
  return { main: toSeries(candles, rsi) };
}

function calcStochRSI(candles, p) {
  const rsi = calcRSI(candles, { period: p.rsiPeriod }).main.map((pt) => pt.value);
  // نعيد بناء مصفوفة كاملة الطول محاذية للشموع (calcRSI بترجع نقاط مفلترة بس)
  const rsiFull = new Array(candles.length).fill(null);
  let idx = 0;
  const rsiRaw = calcRSI(candles, { period: p.rsiPeriod }).main;
  candles.forEach((c, i) => { const found = rsiRaw.find((pt) => pt.time === c.time); rsiFull[i] = found ? found.value : null; });
  const out = new Array(candles.length).fill(null);
  for (let i = p.stochPeriod - 1; i < candles.length; i++) {
    const slice = rsiFull.slice(i - p.stochPeriod + 1, i + 1).filter((v) => v != null);
    if (slice.length < p.stochPeriod) continue;
    const hi = Math.max(...slice), lo = Math.min(...slice);
    out[i] = hi === lo ? 0 : ((rsiFull[i] - lo) / (hi - lo)) * 100;
  }
  const k = sma(out.map((v) => (v == null ? NaN : v)), p.kSmooth).map((v) => (Number.isFinite(v) ? v : null));
  const d = sma(k.map((v) => (v == null ? NaN : v)), p.dSmooth).map((v) => (Number.isFinite(v) ? v : null));
  return { k: toSeries(candles, k), d: toSeries(candles, d) };
}

function calcStochastic(candles, p) {
  const h = highs(candles), l = lows(candles), c = closes(candles);
  const rawK = new Array(candles.length).fill(null);
  for (let i = p.kPeriod - 1; i < candles.length; i++) {
    let hi = -Infinity, lo = Infinity;
    for (let j = i - p.kPeriod + 1; j <= i; j++) { if (h[j] > hi) hi = h[j]; if (l[j] < lo) lo = l[j]; }
    rawK[i] = hi === lo ? 0 : ((c[i] - lo) / (hi - lo)) * 100;
  }
  const k = sma(rawK.map((v) => (v == null ? NaN : v)), p.kSmooth).map((v) => (Number.isFinite(v) ? v : null));
  const d = sma(k.map((v) => (v == null ? NaN : v)), p.dSmooth).map((v) => (Number.isFinite(v) ? v : null));
  return { k: toSeries(candles, k), d: toSeries(candles, d) };
}

function calcMACD(candles, p) {
  const c = closes(candles);
  const fast = ema(c, p.fast);
  const slow = ema(c, p.slow);
  const macd = c.map((_, i) => (fast[i] == null || slow[i] == null ? null : fast[i] - slow[i]));
  const signal = ema(macd.map((v) => (v == null ? null : v)), p.signal);
  const hist = c.map((_, i) => (macd[i] == null || signal[i] == null ? null : macd[i] - signal[i]));
  return { macd: toSeries(candles, macd), signal: toSeries(candles, signal), hist: toSeries(candles, hist) };
}

function calcCCI(candles, p) {
  const tp = candles.map((c) => (c.high + c.low + c.close) / 3);
  const maTp = sma(tp, p.period);
  const out = new Array(candles.length).fill(null);
  for (let i = p.period - 1; i < candles.length; i++) {
    const mean = maTp[i];
    let meanDev = 0;
    for (let j = i - p.period + 1; j <= i; j++) meanDev += Math.abs(tp[j] - mean);
    meanDev /= p.period;
    out[i] = meanDev === 0 ? 0 : (tp[i] - mean) / (0.015 * meanDev);
  }
  return { main: toSeries(candles, out) };
}

function calcMomentum(candles, p) {
  const c = closes(candles);
  const out = c.map((v, i) => (i >= p.period ? v - c[i - p.period] : null));
  return { main: toSeries(candles, out) };
}

function calcROC(candles, p) {
  const c = closes(candles);
  const out = c.map((v, i) => (i >= p.period && c[i - p.period] ? ((v - c[i - p.period]) / c[i - p.period]) * 100 : null));
  return { main: toSeries(candles, out) };
}

function calcWilliamsR(candles, p) {
  const h = highs(candles), l = lows(candles), c = closes(candles);
  const out = new Array(candles.length).fill(null);
  for (let i = p.period - 1; i < candles.length; i++) {
    let hi = -Infinity, lo = Infinity;
    for (let j = i - p.period + 1; j <= i; j++) { if (h[j] > hi) hi = h[j]; if (l[j] < lo) lo = l[j]; }
    out[i] = hi === lo ? 0 : ((hi - c[i]) / (hi - lo)) * -100;
  }
  return { main: toSeries(candles, out) };
}

function calcATR(candles, p) {
  const tr = trueRange(candles);
  const atr = wilderSmooth(tr, p.period);
  return { main: toSeries(candles, atr) };
}

function calcADX(candles, p) {
  const n = candles.length;
  const plusDM = new Array(n).fill(null);
  const minusDM = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }
  const tr = trueRange(candles);
  const smTr = wilderSmooth(tr, p.period);
  const smPlus = wilderSmooth(plusDM, p.period);
  const smMinus = wilderSmooth(minusDM, p.period);
  const plusDI = candles.map((_, i) => (smTr[i] ? (smPlus[i] / smTr[i]) * 100 : null));
  const minusDI = candles.map((_, i) => (smTr[i] ? (smMinus[i] / smTr[i]) * 100 : null));
  const dx = candles.map((_, i) => {
    if (plusDI[i] == null || minusDI[i] == null) return null;
    const sum = plusDI[i] + minusDI[i];
    return sum === 0 ? 0 : (Math.abs(plusDI[i] - minusDI[i]) / sum) * 100;
  });
  const adx = wilderSmooth(dx, p.period);
  return { adx: toSeries(candles, adx), plusDI: toSeries(candles, plusDI), minusDI: toSeries(candles, minusDI) };
}

function calcTRIX(candles, p) {
  const c = closes(candles);
  const e1 = ema(c, p.period);
  const e2 = ema(e1, p.period);
  const e3 = ema(e2, p.period);
  const out = new Array(c.length).fill(null);
  for (let i = 1; i < c.length; i++) {
    if (e3[i] == null || e3[i - 1] == null || e3[i - 1] === 0) continue;
    out[i] = ((e3[i] - e3[i - 1]) / e3[i - 1]) * 100;
  }
  return { main: toSeries(candles, out) };
}

function calcUltimateOsc(candles, p) {
  const n = candles.length;
  const bp = new Array(n).fill(null);
  const tr = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    const pc = candles[i - 1].close;
    const trueLow = Math.min(candles[i].low, pc);
    const trueHigh = Math.max(candles[i].high, pc);
    bp[i] = candles[i].close - trueLow;
    tr[i] = trueHigh - trueLow;
  }
  const avg = (period) => {
    const out = new Array(n).fill(null);
    for (let i = period; i < n; i++) {
      let sBp = 0, sTr = 0;
      for (let j = i - period + 1; j <= i; j++) { sBp += bp[j] || 0; sTr += tr[j] || 0; }
      out[i] = sTr === 0 ? 0 : sBp / sTr;
    }
    return out;
  };
  const a1 = avg(p.period1), a2 = avg(p.period2), a3 = avg(p.period3);
  const out = candles.map((_, i) => (a1[i] == null || a2[i] == null || a3[i] == null ? null : (100 * (4 * a1[i] + 2 * a2[i] + a3[i])) / 7));
  return { main: toSeries(candles, out) };
}

function calcAwesomeOsc(candles, p) {
  const hl2 = candles.map((c) => (c.high + c.low) / 2);
  const fast = sma(hl2, p.fast);
  const slow = sma(hl2, p.slow);
  const out = hl2.map((_, i) => (fast[i] == null || slow[i] == null ? null : fast[i] - slow[i]));
  return { main: toSeries(candles, out) };
}

function calcStdDev(candles, p) {
  const c = closes(candles);
  return { main: toSeries(candles, stddevArr(c, p.period)) };
}

function calcDPO(candles, p) {
  const c = closes(candles);
  const ma = sma(c, p.period);
  const lag = Math.floor(p.period / 2) + 1;
  const shifted = shift(ma, lag);
  const out = c.map((v, i) => (shifted[i] == null ? null : v - shifted[i]));
  return { main: toSeries(candles, out) };
}

function calcCMO(candles, p) {
  const c = closes(candles);
  const out = new Array(c.length).fill(null);
  for (let i = p.period; i < c.length; i++) {
    let up = 0, down = 0;
    for (let j = i - p.period + 1; j <= i; j++) {
      const diff = c[j] - c[j - 1];
      if (diff > 0) up += diff; else down += -diff;
    }
    out[i] = up + down === 0 ? 0 : ((up - down) / (up + down)) * 100;
  }
  return { main: toSeries(candles, out) };
}

/* ------------------------- سجل كل المؤشرات ------------------------- */

const CAT_TREND = "اتجاه ومتوسطات";
const CAT_VOLATILITY = "تذبذب / نطاقات";
const CAT_MOMENTUM = "زخم";

export const INDICATOR_DEFS = [
  {
    id: "sma", name: "المتوسط المتحرك البسيط (SMA)", aliases: "moving average simple ma متوسط بسيط",
    type: "overlay", category: CAT_TREND,
    params: [{ key: "period", label: "الفترة", default: 20, min: 2, max: 400 }],
    lines: [{ key: "main", label: "SMA", color: "#4FC3F7" }],
    calc: calcSMA,
  },
  {
    id: "ema", name: "المتوسط المتحرك الأسي (EMA)", aliases: "exponential moving average ema متوسط أسي",
    type: "overlay", category: CAT_TREND,
    params: [{ key: "period", label: "الفترة", default: 20, min: 2, max: 400 }],
    lines: [{ key: "main", label: "EMA", color: "#FFB300" }],
    calc: calcEMA,
  },
  {
    id: "wma", name: "المتوسط المتحرك الموزون (WMA)", aliases: "weighted moving average",
    type: "overlay", category: CAT_TREND,
    params: [{ key: "period", label: "الفترة", default: 20, min: 2, max: 400 }],
    lines: [{ key: "main", label: "WMA", color: "#AB47BC" }],
    calc: calcWMA,
  },
  {
    id: "dema", name: "DEMA (متوسط أسي مضاعف)", aliases: "double exponential moving average",
    type: "overlay", category: CAT_TREND,
    params: [{ key: "period", label: "الفترة", default: 20, min: 2, max: 400 }],
    lines: [{ key: "main", label: "DEMA", color: "#26A69A" }],
    calc: calcDEMA,
  },
  {
    id: "tema", name: "TEMA (متوسط أسي ثلاثي)", aliases: "triple exponential moving average",
    type: "overlay", category: CAT_TREND,
    params: [{ key: "period", label: "الفترة", default: 20, min: 2, max: 400 }],
    lines: [{ key: "main", label: "TEMA", color: "#EF5350" }],
    calc: calcTEMA,
  },
  {
    id: "hma", name: "Hull Moving Average (HMA)", aliases: "hull ma هل",
    type: "overlay", category: CAT_TREND,
    params: [{ key: "period", label: "الفترة", default: 20, min: 2, max: 400 }],
    lines: [{ key: "main", label: "HMA", color: "#7E57C2" }],
    calc: calcHMA,
  },
  {
    id: "bollinger", name: "بولينجر باندز (Bollinger Bands)", aliases: "bollinger bands bb بولنجر",
    type: "overlay", category: CAT_VOLATILITY,
    params: [
      { key: "period", label: "الفترة", default: 20, min: 2, max: 400 },
      { key: "stdDev", label: "الانحراف المعياري", default: 2, min: 0.5, max: 5, step: 0.5 },
    ],
    lines: [
      { key: "upper", label: "الحد العلوي", color: "#66BB6A" },
      { key: "mid", label: "المتوسط", color: "#FFCA28" },
      { key: "lower", label: "الحد السفلي", color: "#66BB6A" },
    ],
    calc: calcBollinger,
  },
  {
    id: "envelope", name: "MA Envelope (مغلف متوسط متحرك)", aliases: "moving average envelope",
    type: "overlay", category: CAT_VOLATILITY,
    params: [
      { key: "period", label: "الفترة", default: 20, min: 2, max: 400 },
      { key: "percent", label: "النسبة %", default: 2.5, min: 0.1, max: 20, step: 0.1 },
    ],
    lines: [
      { key: "upper", label: "الحد العلوي", color: "#4DD0E1" },
      { key: "mid", label: "المتوسط", color: "#B0BEC5" },
      { key: "lower", label: "الحد السفلي", color: "#4DD0E1" },
    ],
    calc: calcEnvelope,
  },
  {
    id: "keltner", name: "قنوات كيلتنر (Keltner Channels)", aliases: "keltner channels",
    type: "overlay", category: CAT_VOLATILITY,
    params: [
      { key: "period", label: "فترة المتوسط", default: 20, min: 2, max: 400 },
      { key: "atrPeriod", label: "فترة ATR", default: 10, min: 2, max: 100 },
      { key: "mult", label: "المضاعِف", default: 2, min: 0.5, max: 6, step: 0.5 },
    ],
    lines: [
      { key: "upper", label: "الحد العلوي", color: "#FF8A65" },
      { key: "mid", label: "المتوسط", color: "#FFD54F" },
      { key: "lower", label: "الحد السفلي", color: "#FF8A65" },
    ],
    calc: calcKeltner,
  },
  {
    id: "donchian", name: "قنوات دونشيان (Donchian Channels)", aliases: "donchian channels",
    type: "overlay", category: CAT_VOLATILITY,
    params: [{ key: "period", label: "الفترة", default: 20, min: 2, max: 400 }],
    lines: [
      { key: "upper", label: "أعلى سعر", color: "#42A5F5" },
      { key: "mid", label: "المنتصف", color: "#90A4AE" },
      { key: "lower", label: "أدنى سعر", color: "#42A5F5" },
    ],
    calc: calcDonchian,
  },
  {
    id: "psar", name: "Parabolic SAR", aliases: "parabolic sar وقف وعكس",
    type: "overlay", category: CAT_TREND,
    params: [
      { key: "step", label: "الخطوة", default: 0.02, min: 0.001, max: 0.5, step: 0.001 },
      { key: "max", label: "الحد الأقصى", default: 0.2, min: 0.05, max: 1, step: 0.01 },
    ],
    lines: [{ key: "main", label: "PSAR", color: "#FF7043" }],
    calc: calcPSAR,
  },
  {
    id: "supertrend", name: "SuperTrend", aliases: "سوبرترند super trend",
    type: "overlay", category: CAT_TREND,
    params: [
      { key: "period", label: "فترة ATR", default: 10, min: 2, max: 100 },
      { key: "mult", label: "المضاعِف", default: 3, min: 0.5, max: 10, step: 0.5 },
    ],
    lines: [{ key: "main", label: "SuperTrend", color: "#26C6DA" }],
    calc: calcSuperTrend,
  },
  {
    id: "ichimoku", name: "سحابة إيشيموكو (Ichimoku Cloud)", aliases: "ichimoku cloud ايشيموكو",
    type: "overlay", category: CAT_TREND,
    params: [
      { key: "conversion", label: "خط التحويل", default: 9, min: 2, max: 100 },
      { key: "base", label: "خط الأساس", default: 26, min: 2, max: 200 },
      { key: "spanB", label: "Span B", default: 52, min: 2, max: 300 },
    ],
    lines: [
      { key: "tenkan", label: "Tenkan-sen", color: "#EF5350" },
      { key: "kijun", label: "Kijun-sen", color: "#42A5F5" },
      { key: "spanA", label: "Senkou Span A", color: "#66BB6A" },
      { key: "spanB", label: "Senkou Span B", color: "#AB47BC" },
    ],
    calc: calcIchimoku,
  },

  /* ---------------- Oscillators ---------------- */
  {
    id: "rsi", name: "مؤشر القوة النسبية (RSI)", aliases: "relative strength index rsi",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [{ key: "period", label: "الفترة", default: 14, min: 2, max: 100 }],
    lines: [{ key: "main", label: "RSI", color: "#CE93D8" }],
    range: [0, 100], refLines: [30, 70],
    calc: calcRSI,
  },
  {
    id: "stochastic", name: "ستوكاستيك (Stochastic Oscillator)", aliases: "stochastic oscillator",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [
      { key: "kPeriod", label: "%K", default: 14, min: 1, max: 100 },
      { key: "kSmooth", label: "تنعيم %K", default: 3, min: 1, max: 20 },
      { key: "dSmooth", label: "%D", default: 3, min: 1, max: 20 },
    ],
    lines: [{ key: "k", label: "%K", color: "#4FC3F7" }, { key: "d", label: "%D", color: "#FFB74D" }],
    range: [0, 100], refLines: [20, 80],
    calc: calcStochastic,
  },
  {
    id: "stochrsi", name: "Stochastic RSI", aliases: "stoch rsi",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [
      { key: "rsiPeriod", label: "فترة RSI", default: 14, min: 2, max: 100 },
      { key: "stochPeriod", label: "فترة Stoch", default: 14, min: 2, max: 100 },
      { key: "kSmooth", label: "تنعيم %K", default: 3, min: 1, max: 20 },
      { key: "dSmooth", label: "%D", default: 3, min: 1, max: 20 },
    ],
    lines: [{ key: "k", label: "%K", color: "#4FC3F7" }, { key: "d", label: "%D", color: "#FFB74D" }],
    range: [0, 100], refLines: [20, 80],
    calc: calcStochRSI,
  },
  {
    id: "macd", name: "MACD", aliases: "moving average convergence divergence",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [
      { key: "fast", label: "سريع", default: 12, min: 2, max: 100 },
      { key: "slow", label: "بطيء", default: 26, min: 2, max: 200 },
      { key: "signal", label: "الإشارة", default: 9, min: 2, max: 100 },
    ],
    lines: [
      { key: "macd", label: "MACD", color: "#42A5F5" },
      { key: "signal", label: "Signal", color: "#FFA726" },
      { key: "hist", label: "Histogram", color: "#66BB6A", isHistogram: true },
    ],
    calc: calcMACD,
  },
  {
    id: "cci", name: "مؤشر قناة السلعة (CCI)", aliases: "commodity channel index",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [{ key: "period", label: "الفترة", default: 20, min: 2, max: 200 }],
    lines: [{ key: "main", label: "CCI", color: "#26C6DA" }],
    refLines: [-100, 100],
    calc: calcCCI,
  },
  {
    id: "momentum", name: "الزخم (Momentum)", aliases: "momentum mom",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [{ key: "period", label: "الفترة", default: 10, min: 1, max: 200 }],
    lines: [{ key: "main", label: "Momentum", color: "#EF5350" }],
    calc: calcMomentum,
  },
  {
    id: "roc", name: "معدل التغيّر (ROC)", aliases: "rate of change",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [{ key: "period", label: "الفترة", default: 12, min: 1, max: 200 }],
    lines: [{ key: "main", label: "ROC %", color: "#FFCA28" }],
    calc: calcROC,
  },
  {
    id: "williamsr", name: "Williams %R", aliases: "williams percent range",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [{ key: "period", label: "الفترة", default: 14, min: 2, max: 200 }],
    lines: [{ key: "main", label: "%R", color: "#BA68C8" }],
    range: [-100, 0], refLines: [-80, -20],
    calc: calcWilliamsR,
  },
  {
    id: "atr", name: "متوسط المدى الحقيقي (ATR)", aliases: "average true range",
    type: "oscillator", category: CAT_VOLATILITY,
    params: [{ key: "period", label: "الفترة", default: 14, min: 2, max: 200 }],
    lines: [{ key: "main", label: "ATR", color: "#FF7043" }],
    calc: calcATR,
  },
  {
    id: "adx", name: "مؤشر الاتجاه المتوسط (ADX)", aliases: "average directional index +di -di",
    type: "oscillator", category: CAT_TREND,
    params: [{ key: "period", label: "الفترة", default: 14, min: 2, max: 200 }],
    lines: [
      { key: "adx", label: "ADX", color: "#FFFFFF" },
      { key: "plusDI", label: "+DI", color: "#66BB6A" },
      { key: "minusDI", label: "-DI", color: "#EF5350" },
    ],
    calc: calcADX,
  },
  {
    id: "trix", name: "TRIX", aliases: "trix triple exponential average",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [{ key: "period", label: "الفترة", default: 15, min: 2, max: 200 }],
    lines: [{ key: "main", label: "TRIX", color: "#4FC3F7" }],
    calc: calcTRIX,
  },
  {
    id: "ultimate", name: "Ultimate Oscillator", aliases: "ultimate oscillator uo",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [
      { key: "period1", label: "الفترة 1", default: 7, min: 1, max: 100 },
      { key: "period2", label: "الفترة 2", default: 14, min: 1, max: 100 },
      { key: "period3", label: "الفترة 3", default: 28, min: 1, max: 200 },
    ],
    lines: [{ key: "main", label: "UO", color: "#AB47BC" }],
    range: [0, 100], refLines: [30, 70],
    calc: calcUltimateOsc,
  },
  {
    id: "awesome", name: "Awesome Oscillator", aliases: "awesome oscillator ao",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [
      { key: "fast", label: "سريع", default: 5, min: 1, max: 100 },
      { key: "slow", label: "بطيء", default: 34, min: 2, max: 200 },
    ],
    lines: [{ key: "main", label: "AO", color: "#26A69A", isHistogram: true }],
    calc: calcAwesomeOsc,
  },
  {
    id: "stddev", name: "الانحراف المعياري (Standard Deviation)", aliases: "standard deviation volatility",
    type: "oscillator", category: CAT_VOLATILITY,
    params: [{ key: "period", label: "الفترة", default: 20, min: 2, max: 200 }],
    lines: [{ key: "main", label: "StdDev", color: "#78909C" }],
    calc: calcStdDev,
  },
  {
    id: "dpo", name: "Detrended Price Oscillator (DPO)", aliases: "detrended price oscillator",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [{ key: "period", label: "الفترة", default: 20, min: 2, max: 200 }],
    lines: [{ key: "main", label: "DPO", color: "#FFB300" }],
    calc: calcDPO,
  },
  {
    id: "cmo", name: "Chande Momentum Oscillator (CMO)", aliases: "chande momentum oscillator",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [{ key: "period", label: "الفترة", default: 14, min: 2, max: 200 }],
    lines: [{ key: "main", label: "CMO", color: "#4DB6AC" }],
    range: [-100, 100], refLines: [-50, 50],
    calc: calcCMO,
  },
];

export function searchIndicators(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return INDICATOR_DEFS;
  return INDICATOR_DEFS.filter((d) =>
    d.name.toLowerCase().includes(q) ||
    d.id.toLowerCase().includes(q) ||
    (d.aliases || "").toLowerCase().includes(q)
  );
}

export function getIndicatorDef(id) {
  return INDICATOR_DEFS.find((d) => d.id === id) || null;
}

export function defaultParamsFor(def) {
  const p = {};
  (def.params || []).forEach((f) => { p[f.key] = f.default; });
  return p;
}
