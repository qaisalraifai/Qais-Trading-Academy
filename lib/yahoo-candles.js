/* ============================================================================
   lib/yahoo-candles.js
   جالب شموع Yahoo Finance المشترك — نفس المنطق اللي كان جوا
   app/api/replay-candles/route.js تماماً، اتنقل هون بدون أي تغيير بالسلوك
   عشان يقدر يُستخدم من مكانين: الراوت نفسه، وكرون Trading Radar الجديد
   (اللي بيحتاج يجيب شموع كذا أصل من السيرفر مباشرة بدون HTTP self-call).
   ============================================================================ */

const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let crumbCache = { crumb: null, cookie: null, fetchedAt: 0 };
const CRUMB_TTL_MS = 55 * 60 * 1000;

export async function getCrumbAndCookie() {
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
  /* يوهو فايننس بيرفض أي طلب وحيد لفريم الدقيقة يتجاوز مدى أوسع من ~7 أيام
     (بيرجع خطأ صريح "range must be within X days")، بس البيانات الفعلية
     المتوفرة عندها بتوصل لغاية ~29-30 يوم لو طلبناها على شكل عدة طلبات
     متتالية كل وحدة ≤7 أيام (شوفي fetchChunkedRange تحت). فبدل ما نحصر
     rangeDays بـ7 (وهاد كان يمنع أي "قص" أقدم من أسبوع من الرجوع لفريم
     الدقيقة نهائياً)، رفعناها لـ29 واستخدمنا التقطيع لتغطيتها فعلياً. */
  "1min": { yInterval: "1m", rangeDays: 29, maxSingleRequestDays: 6, liveRangeDays: 2 },
  "5min": { yInterval: "5m", rangeDays: 58, liveRangeDays: 3 },
  "15min": { yInterval: "15m", rangeDays: 58, liveRangeDays: 3 },
  "1h": { yInterval: "60m", rangeDays: 725, liveRangeDays: 5 },
  "4h": { yInterval: "60m", rangeDays: 725, aggregateHours: 4, liveRangeDays: 5 },
  /* 🔴 **كان `3650` — وهو سقف من عندنا مش من يوهو.**
     -----------------------------------------------------------------------
     كل السقوف فوق موثَّق ليش: يوهو بترفض فعلياً مدى أوسع للفريمات اللحظية.
     هاد وحده كان بلا تعليق — رقم مدوّر (عشر سنين بالضبط).

     وانكشف بالقياس على الإنتاج (٢٠٢٦-٠٨-٢٦): لوحة المقارنة على SPX500 اليومي
     رجّعت **٢٥١٢ شمعة من ٢٠١٦-٠٨-٢٩ لـ٢٠٢٦-٠٨-٢٥** — عشر سنين بالضبط،
     مطابقة للسقف. بينما ناسداك (من Dukascopy) عنده ٣٥٢٠ شمعة من ٢٠١٤-١٠-٢٩.
     فبيّنت لوحة المقارنة وكأنها «ناقصة عمق»، والسبب إعدادنا مش نفاد بيانات.

     ⚠️ ليش SPX500 اليومي بيوصل ليوهو أصلاً: Dukascopy بتنهار عليه (502).
     الحدّ مقيس سابقاً — بتشتغل لـ٢٠٢١-٠١ وبتفشل من ٢٠٢١-٠٧.

     `7300` = عشرون سنة ≈ ٥٠٤٠ شمعة يومية. تغطّي عمق Dukascopy للمؤشرات
     بهامش، وبتوافق سقف TwelveData (٥٠٠٠ نقطة بالخطة المجانية) فالمزوّدان
     الاحتياطيان بيعطوا عمقاً متقارباً بدل ما يختلفوا الضعف.

     ⚠️ ما انفحص مقابل يوهو محلياً — الشبكة محجوبة بهالبيئة. القياس من
     الإنتاج: `__qtaPaneInfo().compare` بيعطي عدد الشموع وأول وقت. */
  "1day": { yInterval: "1d", rangeDays: 7300, liveRangeDays: 20 },
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
  /* ===================== باغ حقيقي بفريم اليوم للفوركس (Yahoo) =====================
     لاحظنا إن يوهو برجّع O ≈ C لكل شمعة يومية تقريباً لأزواج الفوركس (رمز
     ينتهي بـ"=X")، مش بس أيام العطلة - يعني الباغ مش خاص بالسبت/الأحد فقط
     (هيك كان مفهوماً غلط سابقاً). يوهو ببساطة ما عندها مفهوم "افتتاح جلسة"
     حقيقي لسوق الفوركس (يتداول شبه 24 ساعة بدون جرس افتتاح/إغلاق رسمي)،
     فحقل "open" اليومي عندها غير موثوق ومكرر أحياناً من الإغلاق. النتيجة:
     كل شمعة يومية بتترسم كـ"شحطة رفيعة" (خط بدون جسم واضح، بس بفتيل
     أعلى/أدنى حقيقي) بدل شمعة طبيعية - بالضبط الشكل يلي وصفته المستخدمة.
     الحل الجذري: لأزواج الفوركس بفريم اليوم بس، ما منثق بـ"1d" الجاهزة من
     يوهو إطلاقاً - منبني الشمعة اليومية بأنفسنا من بيانات الساعة الحقيقية
     (60m، نفس الأسلوب المستخدم لبناء فريم الـ4 ساعات تحت) عن طريق تجميع
     أول open/آخر close/أعلى high/أدنى low لكل يوم تقويمي UTC. التاريخ
     المتاح يصير محدود بعمق الساعة عند يوهو (~725 يوم، ~سنتين) بدل 10
     سنين نظرياً، بس هاد أفضل بكثير من شموع غلط بصرياً لعشر سنين. */
  const isDailyForex = interval === "1day" && /=X$/.test(symbol);
  const cfg = isDailyForex ? INTERVAL_CONFIG["1h"] : INTERVAL_CONFIG[interval] || INTERVAL_CONFIG["15min"];

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

  async function fetchOneRange(p1, p2) {
    const rangeParams = new URLSearchParams({
      interval: cfg.yInterval,
      period1: String(p1),
      period2: String(p2),
      includePrePost: "false",
    });
    async function doFetch() {
      try {
        const { crumb, cookie } = await getCrumbAndCookie();
        const withCrumb = new URLSearchParams(rangeParams);
        withCrumb.set("crumb", crumb);
        const res = await fetch(`${YF_BASE}/${encodeURIComponent(symbol)}?${withCrumb.toString()}`, {
          headers: { "User-Agent": UA, Cookie: cookie },
          cache: "no-store",
        });
        return { res, mode: "crumb" };
      } catch (crumbErr) {
        const res = await fetch(`${YF_BASE}/${encodeURIComponent(symbol)}?${rangeParams.toString()}`, {
          headers: { "User-Agent": UA },
          cache: "no-store",
        });
        return { res, mode: "direct", crumbErr };
      }
    }

    const { res, mode, crumbErr } = await doFetch();
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
    if (!result || !Array.isArray(result.timestamp)) return [];
    const quote = result.indicators?.quote?.[0] || {};
    return result.timestamp
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
  }

  try {
    let candles;
    if (cfg.maxSingleRequestDays && period2 - period1 > cfg.maxSingleRequestDays * 86400) {
      /* فريم الدقيقة: يوهو بيرفض طلب وحيد أوسع من maxSingleRequestDays، فمنقسم
         المدى المطلوب لعدة نوافذ متتالية (كل وحدة ≤ الحد المسموح) ومنطلبهم
         بالتوازي، وبعدين منجمع كل النتايج قبل الترتيب/التصفية العادية تحت -
         هيك منقدر نوصل فعلياً لعمق ~29 يوم بدل ما ننحصر بـ7 بس. */
      const chunkSec = cfg.maxSingleRequestDays * 86400;
      const windows = [];
      for (let start = period1; start < period2; start += chunkSec) {
        windows.push([start, Math.min(start + chunkSec, period2)]);
      }
      const chunks = await Promise.all(windows.map(([p1, p2]) => fetchOneRange(p1, p2).catch(() => [])));
      candles = chunks.flat();
    } else {
      candles = await fetchOneRange(period1, period2);
    }

    /* لازم نرتّب الشموع الخام زمنياً *قبل* أي تجميع، مش بعده - شوفي تعليق
       aggregateCandles تحت لسبب هالترتيب بالتفصيل. */
    candles.sort((a, b) => a.time - b.time);
    candles = candles.filter((c, i) => i === 0 || c.time !== candles[i - 1].time);

    /* هون كان في باغ حقيقي وخطير: كل الفريمات (حتى يلي يوهو بترجعها جاهزة
       بنفس الدقة المطلوبة زي 1min/5min/15min/1h/1day) كانت تتمرر عبر
       aggregateCandles() يلي بتعيد كتابة وقت كل شمعة لأقرب حد UTC للأسفل
       (Math.floor(time/groupSec)*groupSec) - حتى لو الوقت الأصلي من يوهو
       مش واقف بالضبط على حد الساعة/اليوم UTC (شائع جداً بأدوات زي الذهب
       والفوركس اللي بتتداول شبه 24 ساعة). النتيجة: وقت الشمعة المعروض
       (وبالتالي "تاريخها") كان يمكن ينزاح عن الوقت الحقيقي من يوهو - وهاد
       بالضبط سبب "الشموع مش مطابقة تماماً" و"القص بيصير بتاريخ غلط" اللي
       لاحظتيهم. الحل: نستخدم بيانات يوهو الخام زي ما هي بدون أي إعادة تجميع
       إلا لفريم الـ4 ساعات فقط (لأنه الوحيد يلي يوهو ما عندها له دقة أصلية -
       لازم نبنيه بأنفسنا من بيانات الساعة). كل باقي الفريمات هلق = نفس وقت
       وقيم يوهو الحقيقية 100% بدون أي لمسة. */
    if (cfg.aggregateHours) {
      candles = aggregateCandles(candles, cfg.aggregateHours * 3600);
      candles.sort((a, b) => a.time - b.time);
      candles = candles.filter((c, i) => i === 0 || c.time !== candles[i - 1].time);
    }
    if (isDailyForex) {
      // تجميع الساعات لشمعة يومية حقيقية (أول open/آخر close/أعلى high/أدنى
      // low لكل يوم تقويمي UTC) - بدل الاعتماد على "1d" الجاهزة من يوهو
      // (شوفي التعليق الطويل فوق لسبب هالتغيير).
      candles = aggregateCandles(candles, 24 * 3600);
      candles.sort((a, b) => a.time - b.time);
      candles = candles.filter((c, i) => i === 0 || c.time !== candles[i - 1].time);
    }

    /* إزالة أيام السبت/الأحد (سوق مقفول فعلياً) من *كل* الفريمات، مش بس
       اليومي - بطلب صريح: هاي الأيام مافي أي داعي إلها بأي فريم، وبعض
       المزودين (يوهو تحديداً) بيرجّعوا "شموع" وهمية بسعر شبه ثابت بعطلة
       الأسبوع (تكرار آخر سعر معروف كل فترة) بدل ما يوقفوا فعلياً - وهاد
       يطلع كـ"خط مسطّح" فاضي بالشارت (تماماً الشكل يلي وصفته المستخدمة على
       فريم قصير). ما منطبّقها على الكريبتو (بيتداول 24/7 فعلياً، السبت
       والأحد فيه بيانات حقيقية) ولا على الأسهم (يوهو أصلاً ما بترجع بيانات
       سبت/أحد إلها لأن البورصة مقفولة تماماً، فالفلتر ما إله أي تأثير سلبي
       عليها). */
    if (!/-USD$/.test(symbol)) {
      candles = candles.filter((c) => {
        const dow = new Date(c.time * 1000).getUTCDay(); // 0=أحد، 6=سبت
        return dow !== 0 && dow !== 6;
      });
    }

    candles = candles.slice(-count);

    return { candles };
  } catch (e) {
    return { error: e.message || "فشل جلب البيانات" };
  }
}

/* الحد الأدنى من الشموع عشان نعتبر رد يوهو "صالح" - لو رجع أقل من هيك (أو
   فاضي) بنعتبره فشل ومنجرب الرمز الاحتياطي، حتى لو تقنياً ما رجّع خطأ صريح
   (يوهو أحياناً بيرجع مصفوفة فاضية بدل خطأ لرموز غير مدعومة أو ناقصة البيانات). */
const MIN_VALID_CANDLES = 2;

/**
 * نفس fetchYahooCandles بالضبط، بس بتجرب أول رمز "سبوت" (primarySymbol) قبل
 * الرجوع لرمز احتياطي مضمون (fallbackSymbol، عادة رمز العقد الآجل القديم).
 * هاد بيسمح لنا نستخدم بيانات أقرب لتسعير TradingView/البروكر للمعادن
 * (شوفي التعليق بأول lib/assets.js) بدون أي خطر كسر الأداة لو الرمز
 * الجديد مش مدعوم فعلياً عند يوهو - بترجع تلقائياً لنفس السلوك القديم.
 * @returns {Promise<{candles: Array, sourceSymbol: string, usedFallback: boolean}|{error: string}>}
 */
export async function fetchYahooCandlesWithFallback(
  primarySymbol,
  fallbackSymbol,
  interval = "15min",
  wanted = 1000,
  anchorTimestamp = null
) {
  const primary = await fetchYahooCandles(primarySymbol, interval, wanted, anchorTimestamp);
  if (!primary.error && (primary.candles?.length || 0) >= MIN_VALID_CANDLES) {
    return { candles: primary.candles, sourceSymbol: primarySymbol, usedFallback: false };
  }

  if (!fallbackSymbol || fallbackSymbol === primarySymbol) {
    return primary.error ? primary : { error: "لا توجد بيانات كافية لهذا الرمز" };
  }

  const fallback = await fetchYahooCandles(fallbackSymbol, interval, wanted, anchorTimestamp);
  if (!fallback.error && (fallback.candles?.length || 0) >= MIN_VALID_CANDLES) {
    return { candles: fallback.candles, sourceSymbol: fallbackSymbol, usedFallback: true };
  }

  return fallback.error ? fallback : primary.error ? primary : { error: "لا توجد بيانات كافية لهذا الرمز" };
}
