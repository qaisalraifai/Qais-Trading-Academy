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

/* ------------------------- دفعة مؤشرات إضافية (توسعة المكتبة) ------------------------- */

function calcAroon(candles, p) {
  const n = candles.length;
  const up = new Array(n).fill(null);
  const down = new Array(n).fill(null);
  for (let i = p.period; i < n; i++) {
    let hiIdx = i, loIdx = i;
    for (let j = i - p.period; j <= i; j++) {
      if (candles[j].high >= candles[hiIdx].high) hiIdx = j;
      if (candles[j].low <= candles[loIdx].low) loIdx = j;
    }
    up[i] = ((p.period - (i - hiIdx)) / p.period) * 100;
    down[i] = ((p.period - (i - loIdx)) / p.period) * 100;
  }
  return { up: toSeries(candles, up), down: toSeries(candles, down) };
}

function calcVortex(candles, p) {
  const n = candles.length;
  const vmPlus = new Array(n).fill(null);
  const vmMinus = new Array(n).fill(null);
  const tr = trueRange(candles);
  for (let i = 1; i < n; i++) {
    vmPlus[i] = Math.abs(candles[i].high - candles[i - 1].low);
    vmMinus[i] = Math.abs(candles[i].low - candles[i - 1].high);
  }
  const viPlus = new Array(n).fill(null);
  const viMinus = new Array(n).fill(null);
  for (let i = p.period; i < n; i++) {
    let sumVmP = 0, sumVmM = 0, sumTr = 0;
    for (let j = i - p.period + 1; j <= i; j++) { sumVmP += vmPlus[j] || 0; sumVmM += vmMinus[j] || 0; sumTr += tr[j] || 0; }
    viPlus[i] = sumTr === 0 ? null : sumVmP / sumTr;
    viMinus[i] = sumTr === 0 ? null : sumVmM / sumTr;
  }
  return { viPlus: toSeries(candles, viPlus), viMinus: toSeries(candles, viMinus) };
}

function calcFisher(candles, p) {
  const n = candles.length;
  const hl2 = candles.map((c) => (c.high + c.low) / 2);
  const fisher = new Array(n).fill(null);
  let prevVal = 0, prevFisher = 0;
  for (let i = 0; i < n; i++) {
    if (i < p.period - 1) continue;
    let hh = -Infinity, ll = Infinity;
    for (let j = i - p.period + 1; j <= i; j++) { hh = Math.max(hh, candles[j].high); ll = Math.min(ll, candles[j].low); }
    const range = hh - ll;
    let x = range === 0 ? 0 : ((hl2[i] - ll) / range - 0.5) * 2;
    let val = 0.33 * x + 0.67 * prevVal;
    val = Math.max(-0.999, Math.min(0.999, val));
    const f = 0.5 * Math.log((1 + val) / (1 - val)) + 0.5 * prevFisher;
    fisher[i] = f;
    prevVal = val;
    prevFisher = f;
  }
  return { main: toSeries(candles, fisher), signal: toSeries(candles, shift(fisher, 1)) };
}

function calcChoppiness(candles, p) {
  const n = candles.length;
  const tr = trueRange(candles);
  const out = new Array(n).fill(null);
  const log10p = Math.log10(p.period);
  for (let i = p.period; i < n; i++) {
    let sumTr = 0, hh = -Infinity, ll = Infinity;
    for (let j = i - p.period + 1; j <= i; j++) { sumTr += tr[j] || 0; hh = Math.max(hh, candles[j].high); ll = Math.min(ll, candles[j].low); }
    const range = hh - ll;
    out[i] = range === 0 ? null : (100 * Math.log10(sumTr / range)) / log10p;
  }
  return { main: toSeries(candles, out) };
}

function calcKST(candles, p) {
  const c = closes(candles);
  const roc = (period) => c.map((v, i) => (i >= period && c[i - period] ? ((v - c[i - period]) / c[i - period]) * 100 : null));
  const smaOf = (arr, period) => sma(arr.map((v) => v ?? NaN), period).map((v) => (Number.isFinite(v) ? v : null));
  const r1 = smaOf(roc(10), 10), r2 = smaOf(roc(15), 10), r3 = smaOf(roc(20), 10), r4 = smaOf(roc(30), 15);
  const kst = c.map((_, i) => {
    if (r1[i] == null || r2[i] == null || r3[i] == null || r4[i] == null) return null;
    return r1[i] * 1 + r2[i] * 2 + r3[i] * 3 + r4[i] * 4;
  });
  const signal = smaOf(kst, p.signalPeriod);
  return { main: toSeries(candles, kst), signal: toSeries(candles, signal) };
}

function calcCoppock(candles, p) {
  const c = closes(candles);
  const roc = (period) => c.map((v, i) => (i >= period && c[i - period] ? ((v - c[i - period]) / c[i - period]) * 100 : null));
  const summed = c.map((_, i) => {
    const a = roc(14)[i], b = roc(11)[i];
    return a == null || b == null ? null : a + b;
  });
  const out = wma(summed.map((v) => v ?? NaN), p.wmaPeriod).map((v) => (Number.isFinite(v) ? v : null));
  return { main: toSeries(candles, out) };
}

function calcElderRay(candles, p) {
  const c = closes(candles);
  const e = ema(c, p.period);
  const bull = candles.map((cd, i) => (e[i] == null ? null : cd.high - e[i]));
  const bear = candles.map((cd, i) => (e[i] == null ? null : cd.low - e[i]));
  return { bull: toSeries(candles, bull), bear: toSeries(candles, bear) };
}

function calcMassIndex(candles, p) {
  const n = candles.length;
  const hl = candles.map((c) => c.high - c.low);
  const e1 = ema(hl, p.emaPeriod);
  const e2 = ema(e1.map((v) => v ?? NaN), p.emaPeriod).map((v) => (Number.isFinite(v) ? v : null));
  const ratio = hl.map((_, i) => (e1[i] == null || e2[i] == null || e2[i] === 0 ? null : e1[i] / e2[i]));
  const out = new Array(n).fill(null);
  for (let i = p.sumPeriod - 1; i < n; i++) {
    let sum = 0, ok = true;
    for (let j = i - p.sumPeriod + 1; j <= i; j++) { if (ratio[j] == null) { ok = false; break; } sum += ratio[j]; }
    out[i] = ok ? sum : null;
  }
  return { main: toSeries(candles, out) };
}

function calcRVI(candles, p) {
  const n = candles.length;
  const num = new Array(n).fill(null);
  const den = new Array(n).fill(null);
  for (let i = 3; i < n; i++) {
    const co = (k) => candles[i - k].close - candles[i - k].open;
    const hl = (k) => candles[i - k].high - candles[i - k].low;
    num[i] = (co(0) + 2 * co(1) + 2 * co(2) + co(3)) / 6;
    den[i] = (hl(0) + 2 * hl(1) + 2 * hl(2) + hl(3)) / 6;
  }
  const numSma = sma(num.map((v) => v ?? NaN), p.period).map((v) => (Number.isFinite(v) ? v : null));
  const denSma = sma(den.map((v) => v ?? NaN), p.period).map((v) => (Number.isFinite(v) ? v : null));
  const rvi = candles.map((_, i) => (numSma[i] == null || denSma[i] == null || denSma[i] === 0 ? null : numSma[i] / denSma[i]));
  const signal = new Array(n).fill(null);
  for (let i = 3; i < n; i++) {
    if (rvi[i] == null || rvi[i - 1] == null || rvi[i - 2] == null || rvi[i - 3] == null) continue;
    signal[i] = (rvi[i] + 2 * rvi[i - 1] + 2 * rvi[i - 2] + rvi[i - 3]) / 6;
  }
  return { main: toSeries(candles, rvi), signal: toSeries(candles, signal) };
}

function calcTSI(candles, p) {
  const c = closes(candles);
  const mom = c.map((v, i) => (i === 0 ? null : v - c[i - 1]));
  const absMom = mom.map((v) => (v == null ? null : Math.abs(v)));
  const smooth = (arr) => {
    const e1 = ema(arr.map((v) => v ?? NaN), p.longPeriod).map((v) => (Number.isFinite(v) ? v : null));
    return ema(e1.map((v) => v ?? NaN), p.shortPeriod).map((v) => (Number.isFinite(v) ? v : null));
  };
  const dSmoothed = smooth(mom);
  const dAbsSmoothed = smooth(absMom);
  const tsi = c.map((_, i) => (dSmoothed[i] == null || dAbsSmoothed[i] == null || dAbsSmoothed[i] === 0 ? null : (100 * dSmoothed[i]) / dAbsSmoothed[i]));
  const signal = sma(tsi.map((v) => v ?? NaN), p.signalPeriod).map((v) => (Number.isFinite(v) ? v : null));
  return { main: toSeries(candles, tsi), signal: toSeries(candles, signal) };
}

function calcBOP(candles, p) {
  const raw = candles.map((c) => (c.high - c.low === 0 ? 0 : (c.close - c.open) / (c.high - c.low)));
  const out = p.period > 1 ? sma(raw, p.period) : raw;
  return { main: toSeries(candles, out) };
}

function calcLinReg(candles, p) {
  const c = closes(candles);
  const n = c.length;
  const out = new Array(n).fill(null);
  const period = p.period;
  for (let i = period - 1; i < n; i++) {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let j = 0; j < period; j++) {
      const x = j, y = c[i - period + 1 + j];
      sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
    }
    const denom = period * sumX2 - sumX * sumX;
    const slope = denom === 0 ? 0 : (period * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / period;
    out[i] = intercept + slope * (period - 1);
  }
  return { main: toSeries(candles, out) };
}

function calcRollingPivots(candles, p) {
  const n = candles.length;
  const pivot = new Array(n).fill(null);
  const r1 = new Array(n).fill(null);
  const s1 = new Array(n).fill(null);
  for (let i = p.period; i < n; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - p.period; j < i; j++) { hh = Math.max(hh, candles[j].high); ll = Math.min(ll, candles[j].low); }
    const prevClose = candles[i - 1].close;
    const piv = (hh + ll + prevClose) / 3;
    pivot[i] = piv;
    r1[i] = 2 * piv - ll;
    s1[i] = 2 * piv - hh;
  }
  return { pivot: toSeries(candles, pivot), r1: toSeries(candles, r1), s1: toSeries(candles, s1) };
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
  {
    id: "aroon", name: "أرون (Aroon Up/Down)", aliases: "aroon up down اتجاه",
    type: "oscillator", category: CAT_TREND,
    params: [{ key: "period", label: "الفترة", default: 14, min: 2, max: 200 }],
    lines: [
      { key: "up", label: "Aroon Up", color: "#26C6DA" },
      { key: "down", label: "Aroon Down", color: "#FF7043" },
    ],
    range: [0, 100],
    calc: calcAroon,
  },
  {
    id: "vortex", name: "مؤشر الدوامة (Vortex Indicator)", aliases: "vortex indicator vi",
    type: "oscillator", category: CAT_TREND,
    params: [{ key: "period", label: "الفترة", default: 14, min: 2, max: 200 }],
    lines: [
      { key: "viPlus", label: "VI+", color: "#66BB6A" },
      { key: "viMinus", label: "VI-", color: "#EF5350" },
    ],
    calc: calcVortex,
  },
  {
    id: "fisher", name: "تحويلة فيشر (Fisher Transform)", aliases: "fisher transform",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [{ key: "period", label: "الفترة", default: 9, min: 2, max: 100 }],
    lines: [
      { key: "main", label: "Fisher", color: "#29B6F6" },
      { key: "signal", label: "Signal", color: "#FFA726" },
    ],
    calc: calcFisher,
  },
  {
    id: "choppiness", name: "مؤشر التذبذب العشوائي (Choppiness Index)", aliases: "choppiness index chop",
    type: "oscillator", category: CAT_VOLATILITY,
    params: [{ key: "period", label: "الفترة", default: 14, min: 2, max: 200 }],
    lines: [{ key: "main", label: "CHOP", color: "#AB47BC" }],
    range: [0, 100], refLines: [38.2, 61.8],
    calc: calcChoppiness,
  },
  {
    id: "kst", name: "KST (Know Sure Thing)", aliases: "know sure thing kst",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [{ key: "signalPeriod", label: "فترة الإشارة", default: 9, min: 2, max: 100 }],
    lines: [
      { key: "main", label: "KST", color: "#42A5F5" },
      { key: "signal", label: "Signal", color: "#FFCA28" },
    ],
    calc: calcKST,
  },
  {
    id: "coppock", name: "منحنى كوبوك (Coppock Curve)", aliases: "coppock curve",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [{ key: "wmaPeriod", label: "فترة WMA", default: 10, min: 2, max: 100 }],
    lines: [{ key: "main", label: "Coppock", color: "#8D6E63" }],
    calc: calcCoppock,
  },
  {
    id: "elderray", name: "إلدر راي (Elder Ray - Bull/Bear Power)", aliases: "elder ray bull bear power",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [{ key: "period", label: "فترة EMA", default: 13, min: 2, max: 200 }],
    lines: [
      { key: "bull", label: "Bull Power", color: "#66BB6A", isHistogram: true },
      { key: "bear", label: "Bear Power", color: "#EF5350", isHistogram: true },
    ],
    calc: calcElderRay,
  },
  {
    id: "massindex", name: "مؤشر الكتلة (Mass Index)", aliases: "mass index",
    type: "oscillator", category: CAT_VOLATILITY,
    params: [
      { key: "emaPeriod", label: "فترة EMA", default: 9, min: 2, max: 50 },
      { key: "sumPeriod", label: "فترة الجمع", default: 25, min: 5, max: 100 },
    ],
    lines: [{ key: "main", label: "Mass Index", color: "#26A69A" }],
    refLines: [27, 26.5],
    calc: calcMassIndex,
  },
  {
    id: "rvi2", name: "مؤشر الحيوية النسبية (Relative Vigor Index)", aliases: "relative vigor index rvi",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [{ key: "period", label: "الفترة", default: 10, min: 2, max: 100 }],
    lines: [
      { key: "main", label: "RVI", color: "#5C6BC0" },
      { key: "signal", label: "Signal", color: "#FFA000" },
    ],
    calc: calcRVI,
  },
  {
    id: "tsi", name: "مؤشر القوة الحقيقية (True Strength Index)", aliases: "true strength index tsi",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [
      { key: "longPeriod", label: "الفترة الطويلة", default: 25, min: 2, max: 100 },
      { key: "shortPeriod", label: "الفترة القصيرة", default: 13, min: 2, max: 100 },
      { key: "signalPeriod", label: "فترة الإشارة", default: 7, min: 2, max: 50 },
    ],
    lines: [
      { key: "main", label: "TSI", color: "#26C6DA" },
      { key: "signal", label: "Signal", color: "#FF7043" },
    ],
    calc: calcTSI,
  },
  {
    id: "bop", name: "توازن القوة (Balance of Power)", aliases: "balance of power bop",
    type: "oscillator", category: CAT_MOMENTUM,
    params: [{ key: "period", label: "التنعيم (SMA)", default: 14, min: 1, max: 100 }],
    lines: [{ key: "main", label: "BOP", color: "#EC407A", isHistogram: true }],
    calc: calcBOP,
  },
  {
    id: "linreg", name: "خط الانحدار الخطي (Linear Regression)", aliases: "linear regression line",
    type: "overlay", category: CAT_TREND,
    params: [{ key: "period", label: "الفترة", default: 100, min: 2, max: 500 }],
    lines: [{ key: "main", label: "LinReg", color: "#FFCA28" }],
    calc: calcLinReg,
  },
  {
    id: "pivots", name: "نقاط الارتكاز المتحركة (Rolling Pivot Points)", aliases: "pivot points rolling",
    type: "overlay", category: CAT_TREND,
    params: [{ key: "period", label: "طول النافذة", default: 20, min: 5, max: 200 }],
    lines: [
      { key: "pivot", label: "Pivot", color: "#B0BEC5" },
      { key: "r1", label: "R1", color: "#66BB6A" },
      { key: "s1", label: "S1", color: "#EF5350" },
    ],
    calc: calcRollingPivots,
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
