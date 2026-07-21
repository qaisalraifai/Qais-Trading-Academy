/* ============================================================================
   lib/yahoo-candles.js
   جالب شموع Yahoo Finance المشترك — نفس المنطق اللي كان جوا
   app/api/replay-candles/route.js تماماً، اتنقل هون بدون أي تغيير بالسلوك
   عشان يقدر يُستخدم من مكانين: الراوت نفسه، وكرون Trading Radar الجديد
   (اللي بيحتاج يجيب شموع كذا أصل من السيرفر مباشرة بدون HTTP self-call).
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
  const cookieRes = await fetch("https://fc.yahoo.com", {
    headers: { "User-Agent": UA },
    redirect: "manual",
  });
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

const INTERVAL_CONFIG = {
  "1min": { yInterval: "1m", rangeDays: 7, liveRangeDays: 2 },
  "5min": { yInterval: "5m", rangeDays: 58, liveRangeDays: 3 },
  "15min": { yInterval: "15m", rangeDays: 58, liveRangeDays: 3 },
  "1h": { yInterval: "60m", rangeDays: 725, liveRangeDays: 5 },
  "4h": { yInterval: "60m", rangeDays: 725, aggregateHours: 4, liveRangeDays: 5 },
  "1day": { yInterval: "1d", rangeDays: 3650, liveRangeDays: 20 },
};

const INTERVAL_SECONDS = {
  "1min": 60,
  "5min": 300,
  "15min": 900,
  "1h": 3600,
  "4h": 4 * 3600,
  "1day": 24 * 3600,
};

function aggregateCandles(candles, groupSec) {
  const buckets = new Map();
  for (const c of candles) {
    const bucketTime = Math.floor(c.time / groupSec) * groupSec;
    const existing = buckets.get(bucketTime);
    if (!existing) {
      buckets.set(bucketTime, { time: bucketTime, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume || 0 });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
      existing.volume = (existing.volume || 0) + (c.volume || 0);
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

/**
 * يجيب شموع OHLC من Yahoo Finance.
 * @param {string} symbol - رمز يوهو (مثل GC=F, EURUSD=X, BTC-USD)
 * @param {string} interval - أحد مفاتيح INTERVAL_CONFIG (1min|5min|15min|1h|4h|1day)
 * @param {number} wanted - عدد الشموع المطلوبة (يُقص لآخر N شمعة)
 * @returns {Promise<{candles: Array}|{error: string}>}
 */
export async function fetchYahooCandles(symbol, interval = "15min", wanted = 1000, anchorTimestamp = null) {
  /* ملاحظة مهمة: هاد الحد الأقصى لازم يضل كافي عشان يغطي كامل المدى المسموح به
     (rangeDays) للفريمات يلي ما بتتجمّع (زي 1h) بدون ما "يقص" جزء من التاريخ.
     لو ضل 5000: شمعة الساعة الواحدة عبر 725 يوم بتنتج تقريباً 12000+ شمعة خام،
     فبتنقص لآخر 5000 بس (~208 يوم) - بعكس فريم 4 ساعات يلي نفس الداتا الخام
     عنده بتتجمّع لتقريباً ربع العدد (تحت الـ 5000 أصلاً فما بتنقص). هاد الفرق
     كان يسبب مشكلة: نقطة "قص" (Replay anchor) قديمة على فريم 4 ساعات بتختفي
     تماماً لما تتحول لفريم الساعة (لأنها أقدم من أول شمعة متوفرة بعد القص)،
     فبيطلع رينج غريب بشمعة وحدة. رفع الحد لـ 20000 بيخلي كل الفريمات تحافظ
     على نفس المدى الزمني الحقيقي المتاح من يوهو. */
  const count = Math.min(Number(wanted) || 1000, 20000);
  const cfg = INTERVAL_CONFIG[interval] || INTERVAL_CONFIG["15min"];

  const isLightPoll = count <= 10;
  const effectiveRangeDays = isLightPoll ? cfg.liveRangeDays || cfg.rangeDays : cfg.rangeDays;
  const rangeSeconds = effectiveRangeDays * 24 * 60 * 60;

  const nowSec = Math.floor(Date.now() / 1000);
  let period1, period2;
  if (anchorTimestamp && Number.isFinite(anchorTimestamp) && !isLightPoll) {
    // في نقطة قص/Replay معروفة: يوهو غالباً بيحدّد أقصى عدد نقاط برجّعها
    // بطلب وحد بغض النظر عن حجم period1..period2 المطلوب - فطلب مدى ضخم
    // (زي 725 يوم كامل) ممكن يخلّيه "يقص" الجزء الأقدم بصمت ويرجّع بس آخر
    // جزء قريب من period2، حتى لو نقطة القص نفسها كانت أصلاً جوا الـ 725
    // يوم نظرياً. فبدل ما نطلب دايماً أقصى مدى ممكن من "الآن"، لما يكون في
    // نقطة قص معروفة منطلب مدى "مستهدف" بس (يبلّش شوي قبل نقطة القص لغاية
    // الآن) - أصغر بكثير من الحد الأقصى، فما بيتعرّض لنفس القص الصامت.
    period2 = nowSec;
    const bufferSeconds = Math.max((INTERVAL_SECONDS[interval] || 900) * 300, 3 * 24 * 60 * 60); // ~300 شمعة سياق أو 3 أيام كحد أدنى
    const targetedPeriod1 = anchorTimestamp - bufferSeconds;
    const maxAllowedPeriod1 = nowSec - rangeSeconds;
    // منختار الأقرب-للآن من الاثنين (يعني أضيق مدى ممكن يغطي نقطة القص)
    // بشرط ما نتجاوز الحد الأقصى المسموح فعلياً لهاد الفريم من يوهو.
    period1 = Math.max(targetedPeriod1, maxAllowedPeriod1);
  } else {
    period2 = nowSec;
    period1 = nowSec - rangeSeconds;
  }

  const params = new URLSearchParams({
    interval: cfg.yInterval,
    period1: String(period1),
    period2: String(period2),
    includePrePost: "false",
  });

  async function fetchYahoo() {
    try {
      const { crumb, cookie } = await getCrumbAndCookie();
      const withCrumb = new URLSearchParams(params);
      withCrumb.set("crumb", crumb);
      const res = await fetch(`${YF_BASE}/${encodeURIComponent(symbol)}?${withCrumb.toString()}`, {
        headers: { "User-Agent": UA, Cookie: cookie },
        cache: "no-store",
      });
      return { res, mode: "crumb" };
    } catch (crumbErr) {
      const res = await fetch(`${YF_BASE}/${encodeURIComponent(symbol)}?${params.toString()}`, {
        headers: { "User-Agent": UA },
        cache: "no-store",
      });
      return { res, mode: "direct", crumbErr };
    }
  }

  try {
    const { res, mode, crumbErr } = await fetchYahoo();

    if (!res.ok) {
      const bodyPreview = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(
        `يوهو فايننس رفض الطلب (status ${res.status}${mode === "direct" ? ", direct-fallback" : ""})${
          crumbErr ? ` — فشل جلب crumb: ${crumbErr.message}` : ""
        }${bodyPreview ? ` — ${bodyPreview}` : ""}`
      );
    }

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("يوهو فايننس رجّع استجابة مش JSON صالح (على الأغلب صفحة حظر/تحقق)");
    }

    const err = data?.chart?.error;
    if (err) throw new Error(err.description || "الرمز غير موجود عند مزود البيانات");

    const result = data?.chart?.result?.[0];
    if (!result || !Array.isArray(result.timestamp)) return { candles: [] };

    const quote = result.indicators?.quote?.[0] || {};
    let candles = result.timestamp
      .map((t, i) => ({
        time: t,
        open: quote.open?.[i],
        high: quote.high?.[i],
        low: quote.low?.[i],
        close: quote.close?.[i],
        volume: Number.isFinite(quote.volume?.[i]) ? quote.volume[i] : 0,
      }))
      .filter(
        (c) =>
          Number.isFinite(c.time) &&
          Number.isFinite(c.open) &&
          Number.isFinite(c.high) &&
          Number.isFinite(c.low) &&
          Number.isFinite(c.close)
      );

    if (cfg.aggregateHours) {
      candles = aggregateCandles(candles, cfg.aggregateHours * 3600);
    } else {
      candles = aggregateCandles(candles, INTERVAL_SECONDS[interval] || 60);
    }

    candles.sort((a, b) => a.time - b.time);
    candles = candles.filter((c, i) => i === 0 || c.time !== candles[i - 1].time);
    candles = candles.slice(-count);

    return { candles };
  } catch (e) {
    return { error: e.message || "فشل جلب البيانات" };
  }
}
