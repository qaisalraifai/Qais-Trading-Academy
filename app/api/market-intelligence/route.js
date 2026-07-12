import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/* ============================================================================
   /api/market-intelligence
   مصدر البيانات: Yahoo Finance (مجاني بالكامل، بدون مفتاح API) — نفس المصدر
   المستخدم أصلاً بأداة الباك تيست/الريبلاي (app/api/replay-candles). هالراوت
   مستقل وعنده الكاش الخاص فيه (crumb/cookie) عشان ما نأثر على الأداة الأصلية
   إذا صار أي تعديل هون بالمستقبل.

   type=snapshot   -> قوة العملات + الخريطة الحرارية + VIX/الخوف والطمع + DXY
   type=chart       -> سلسلة أسعار DXY لفترة معيّنة (1D / 1W / 1M)
   type=technical    -> RSI/MACD/EMA/دعم/مقاومة لرمز معيّن (محسوبة من شموع حقيقية)
============================================================================ */

const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let crumbCache = { crumb: null, cookie: null, fetchedAt: 0 };
const CRUMB_TTL_MS = 55 * 60 * 1000;

async function getCrumbAndCookie() {
  const now = Date.now();
  if (crumbCache.crumb && crumbCache.cookie && now - crumbCache.fetchedAt < CRUMB_TTL_MS) {
    return crumbCache;
  }
  const cookieRes = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": UA }, redirect: "manual" });
  const rawCookies =
    typeof cookieRes.headers.getSetCookie === "function"
      ? cookieRes.headers.getSetCookie()
      : [cookieRes.headers.get("set-cookie")].filter(Boolean);
  const cookie = rawCookies.map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error("تعذّر الحصول على كوكي جلسة من يوهو");

  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": UA, Cookie: cookie },
  });
  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.includes("<html")) throw new Error("تعذّر الحصول على crumb من يوهو");

  crumbCache = { crumb, cookie, fetchedAt: now };
  return crumbCache;
}

async function fetchYahooChart(symbol, { interval = "1d", range = "5d" } = {}) {
  const params = new URLSearchParams({ interval, range, includePrePost: "false" });

  async function doFetch() {
    try {
      const { crumb, cookie } = await getCrumbAndCookie();
      const withCrumb = new URLSearchParams(params);
      withCrumb.set("crumb", crumb);
      return await fetch(`${YF_BASE}/${encodeURIComponent(symbol)}?${withCrumb.toString()}`, {
        headers: { "User-Agent": UA, Cookie: cookie },
        cache: "no-store",
      });
    } catch {
      return fetch(`${YF_BASE}/${encodeURIComponent(symbol)}?${params.toString()}`, {
        headers: { "User-Agent": UA },
        cache: "no-store",
      });
    }
  }

  const res = await doFetch();
  if (!res.ok) throw new Error(`يوهو رفض الطلب لـ ${symbol} (status ${res.status})`);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`استجابة غير صالحة من يوهو لـ ${symbol}`);
  }

  const err = data?.chart?.error;
  if (err) throw new Error(err.description || `رمز غير موجود: ${symbol}`);

  const result = data?.chart?.result?.[0];
  if (!result || !Array.isArray(result.timestamp)) throw new Error(`لا توجد بيانات لـ ${symbol}`);

  const q = result.indicators?.quote?.[0] || {};
  const candles = result.timestamp
    .map((t, i) => ({ time: t, open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i] }))
    .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close));

  return { candles, meta: result.meta || {} };
}

/* آخر تغيّر % بالاعتماد على آخر شمعتين (يومي)، وإلا نرجع لبيانات الـ meta */
function lastChangePct({ candles, meta }) {
  if (candles.length >= 2) {
    const last = candles[candles.length - 1].close;
    const prev = candles[candles.length - 2].close;
    if (Number.isFinite(last) && Number.isFinite(prev) && prev !== 0) {
      return { price: last, changePct: ((last - prev) / prev) * 100 };
    }
  }
  const price = meta?.regularMarketPrice;
  const prevClose = meta?.previousClose ?? meta?.chartPreviousClose;
  if (Number.isFinite(price) && Number.isFinite(prevClose) && prevClose !== 0) {
    return { price, changePct: ((price - prevClose) / prevClose) * 100 };
  }
  if (candles.length >= 1) return { price: candles[candles.length - 1].close, changePct: 0 };
  return null;
}

/* -------------------- مؤشرات فنية بسيطة من شموع حقيقية -------------------- */
function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round(100 - 100 / (1 + rs));
}

function emaSeries(values, period) {
  const k = 2 / (period + 1);
  let prev = null;
  const out = [];
  for (let i = 0; i < values.length; i++) {
    if (prev == null) {
      if (i >= period - 1) {
        let s = 0;
        for (let j = i - period + 1; j <= i; j++) s += values[j];
        prev = s / period;
      }
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

function calcMACDBullish(closes) {
  const e12 = emaSeries(closes, 12);
  const e26 = emaSeries(closes, 26);
  const macdLine = closes.map((_, i) => (e12[i] != null && e26[i] != null ? e12[i] - e26[i] : null));
  const validMacd = macdLine.filter((v) => v != null);
  if (validMacd.length < 9) return null;
  const signalArr = emaSeries(validMacd, 9);
  const lastMacd = validMacd[validMacd.length - 1];
  const lastSignal = signalArr[signalArr.length - 1];
  if (lastMacd == null || lastSignal == null) return null;
  return lastMacd > lastSignal;
}

function computeTechnical(candles) {
  const closes = candles.map((c) => c.close);
  if (closes.length < 30) throw new Error("بيانات غير كافية لحساب المؤشرات الفنية");
  const rsi = calcRSI(closes, 14);
  const ema20arr = emaSeries(closes, 20);
  const ema50arr = emaSeries(closes, 50);
  const ema20 = ema20arr[ema20arr.length - 1];
  const ema50 = ema50arr[ema50arr.length - 1] ?? ema20arr[Math.max(0, ema20arr.length - 1)];
  const macdBullish = calcMACDBullish(closes);
  const recent = candles.slice(-30);
  const support = Math.min(...recent.map((c) => c.low ?? c.close));
  const resistance = Math.max(...recent.map((c) => c.high ?? c.close));
  const emaUp = ema20 != null && ema50 != null ? ema20 > ema50 : null;
  let trend = "Sideways";
  if (rsi != null) {
    if (rsi >= 60 && emaUp !== false) trend = "Strong Uptrend";
    else if (rsi <= 40 && emaUp !== true) trend = "Strong Downtrend";
  }
  return {
    rsi,
    macd: macdBullish === null ? null : macdBullish ? "Bullish" : "Bearish",
    emaUp,
    trend,
    support: Number(support.toFixed(support < 10 ? 4 : 2)),
    resistance: Number(resistance.toFixed(resistance < 10 ? 4 : 2)),
  };
}

/* رموز يوهو المستخدمة */
const CCY_PAIRS = { EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X", USDJPY: "USDJPY=X", AUDUSD: "AUDUSD=X", USDCAD: "USDCAD=X" };
const HEATMAP_SYMBOLS = { Forex: "DX-Y.NYB", Stocks: "^GSPC", Commodities: "GC=F", Bonds: "TLT", Crypto: "BTC-USD", Indices: "^IXIC" };
const VIX_SYMBOL = "^VIX";
const DXY_SYMBOL = "DX-Y.NYB";

const CURRENCY_TO_SYMBOL = {
  USD: DXY_SYMBOL, EUR: "EURUSD=X", GBP: "GBPUSD=X", JPY: "USDJPY=X",
  AUD: "AUDUSD=X", CAD: "USDCAD=X", CHF: "USDCHF=X", NZD: "NZDUSD=X",
  CNY: "USDCNY=X",
};

async function buildSnapshot() {
  const uniqueSymbols = Array.from(new Set([...Object.values(CCY_PAIRS), ...Object.values(HEATMAP_SYMBOLS), VIX_SYMBOL]));

  const results = await Promise.allSettled(uniqueSymbols.map((s) => fetchYahooChart(s, { interval: "1d", range: "5d" })));
  const bySymbol = {};
  uniqueSymbols.forEach((s, i) => {
    const r = results[i];
    bySymbol[s] = r.status === "fulfilled" ? lastChangePct(r.value) : null;
  });

  // قوة العملات: مشتقة من نسبة تغيّر أزواجها الرئيسية اليوم مقابل الدولار
  const eur = bySymbol[CCY_PAIRS.EURUSD]?.changePct ?? null;
  const gbp = bySymbol[CCY_PAIRS.GBPUSD]?.changePct ?? null;
  const jpyPair = bySymbol[CCY_PAIRS.USDJPY]?.changePct ?? null; // USD/JPY: يرتفع = الين يضعف
  const aud = bySymbol[CCY_PAIRS.AUDUSD]?.changePct ?? null;
  const cadPair = bySymbol[CCY_PAIRS.USDCAD]?.changePct ?? null; // USD/CAD: يرتفع = الكندي يضعف

  const rawChanges = {
    EUR: eur,
    GBP: gbp,
    JPY: jpyPair != null ? -jpyPair : null,
    AUD: aud,
    CAD: cadPair != null ? -cadPair : null,
  };
  const usdParts = [eur, gbp, jpyPair, aud, cadPair].filter((v) => v != null);
  // USD يقوى لما اليورو/الباوند/الأسترالي يضعفوا مقابله، ويقوى لما USDJPY وUSDCAD يرتفعوا
  rawChanges.USD = usdParts.length
    ? (usdParts.reduce((acc, v, idx) => {
        const isInverse = idx === 0 || idx === 1 || idx === 3; // EUR, GBP, AUD معكوسين بالنسبة للدولار
        return acc + (isInverse ? -v : v);
      }, 0) / usdParts.length)
    : null;

  const currencies = {};
  Object.entries(rawChanges).forEach(([ccy, raw]) => {
    currencies[ccy] = raw == null ? null : Math.round(Math.max(3, Math.min(97, 50 + raw * 28)));
  });

  const heatmap = Object.entries(HEATMAP_SYMBOLS).map(([sector, symbol]) => ({
    sector,
    pct: bySymbol[symbol]?.changePct != null ? Math.round(bySymbol[symbol].changePct * 100) / 100 : null,
  }));

  const vix = bySymbol[VIX_SYMBOL];
  const fearGreed =
    vix?.price != null ? Math.round(Math.max(0, Math.min(100, 100 - ((vix.price - 10) / (35 - 10)) * 100))) : null;

  const dxy = bySymbol[DXY_SYMBOL];

  return {
    currencies,
    heatmap,
    vix: vix ? { price: Math.round(vix.price * 100) / 100, changePct: Math.round(vix.changePct * 100) / 100 } : null,
    fearGreed,
    dxy: dxy ? { price: Math.round(dxy.price * 100) / 100, changePct: Math.round(dxy.changePct * 100) / 100 } : null,
    updatedAt: new Date().toISOString(),
    source: "Yahoo Finance",
  };
}

const CHART_TF_CONFIG = {
  "1D": { interval: "15m", range: "1d" },
  "1W": { interval: "1h", range: "5d" },
  "1M": { interval: "1d", range: "1mo" },
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "snapshot";

  try {
    if (type === "snapshot") {
      const snapshot = await buildSnapshot();
      return NextResponse.json(snapshot);
    }

    if (type === "chart") {
      const tf = searchParams.get("tf") || "1D";
      const cfg = CHART_TF_CONFIG[tf] || CHART_TF_CONFIG["1D"];
      const { candles } = await fetchYahooChart(DXY_SYMBOL, cfg);
      return NextResponse.json({
        symbol: DXY_SYMBOL,
        tf,
        points: candles.map((c) => ({ time: c.time, close: c.close })),
        updatedAt: new Date().toISOString(),
      });
    }

    if (type === "technical") {
      const currency = (searchParams.get("currency") || "USD").toUpperCase();
      const symbol = CURRENCY_TO_SYMBOL[currency] || DXY_SYMBOL;
      const { candles } = await fetchYahooChart(symbol, { interval: "1d", range: "6mo" });
      const tech = computeTechnical(candles);
      return NextResponse.json({ symbol, currency, ...tech, updatedAt: new Date().toISOString() });
    }

    return NextResponse.json({ error: "type غير مدعوم" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message || "فشل جلب بيانات السوق" }, { status: 502 });
  }
}
