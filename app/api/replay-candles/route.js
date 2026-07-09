import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/* مصدر البيانات: Yahoo Finance (مجاني بالكامل، بدون مفتاح API، بيغطي المعادن/الفوركس/الكريبتو/المؤشرات/الأسهم) */
const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/* يوهو صار بيرفض/بيحظر الطلبات اللي بدون كوكي جلسة + "crumb" صالح، وبالأخص من
   IPs السيرفرات السحابية (زي Vercel) بشكل أعلى بكثير من الطلبات العادية.
   لما يصير الرفض، يوهو بيرجع صفحة خطأ مش JSON صالح أو chart.error، وهاد
   كان عم يترجم لـ 502 عام بدون أي تفاصيل تساعد بمعرفة السبب الحقيقي.
   الحل: نجيب كوكي جلسة + crumb مرة وحدة ونعيد استخدامهم (مع تخزين مؤقت
   بالذاكرة لمدة ساعة) بدل ما نرسل كل طلب "عاري" بدون هوية جلسة. */
let crumbCache = { crumb: null, cookie: null, fetchedAt: 0 };
const CRUMB_TTL_MS = 55 * 60 * 1000;

async function getCrumbAndCookie() {
  const now = Date.now();
  if (crumbCache.crumb && crumbCache.cookie && now - crumbCache.fetchedAt < CRUMB_TTL_MS) {
    return crumbCache;
  }

  // الخطوة 1: نزور fc.yahoo.com عشان ياخد كوكي جلسة صالح
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

  // الخطوة 2: نستخدم الكوكي لجلب الـ crumb
  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": UA, Cookie: cookie },
  });
  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.includes("<html")) throw new Error("تعذّر الحصول على crumb من يوهو");

  crumbCache = { crumb, cookie, fetchedAt: now };
  return crumbCache;
}

/* إعدادات كل فريم: الفريم المكافئ عند Yahoo + أقصى مدى تاريخي متاح لهالفريم (بالأيام)
   ملاحظة: Yahoo بيحدد مدى البيانات التاريخية حسب الفريم (شموع الدقيقة مثلاً تتوفر لآخر أسبوع بس)
   فريم 4 ساعات مش متوفر مباشرة عند Yahoo، فبنجيب شموع الساعة ونجمعها كل 4 شموع سوا */
const INTERVAL_CONFIG = {
  "1min":  { yInterval: "1m",  rangeDays: 7,   liveRangeDays: 2  },
  "5min":  { yInterval: "5m",  rangeDays: 58,  liveRangeDays: 3  },
  "15min": { yInterval: "15m", rangeDays: 58,  liveRangeDays: 3  },
  "1h":    { yInterval: "60m", rangeDays: 725, liveRangeDays: 5  },
  "4h":    { yInterval: "60m", rangeDays: 725, aggregateHours: 4, liveRangeDays: 5  },
  "1day":  { yInterval: "1d",  rangeDays: 3650, liveRangeDays: 20 },
};

/* تجميع الشموع حسب الوقت الفعلي (تقريب لأقرب حد الفريم UTC) مش حسب ترتيبها بالمصفوفة.
   هيك التجميع بيضل صحيح ومتسلسل حتى لو صار انقطاع بالبيانات (عطلة/سوق مقفول)،
   لأن التجميع القديم (كل N عناصر متتالية) كان ممكن ينتج طوابع زمنية مش متسلسلة بشكل صحيح
   بعد أي فجوة، ومكتبة الشارت بترفض هيك بيانات وتعمل كراش بالواجهة */
function aggregateCandles(candles, groupSec) {
  const buckets = new Map();
  for (const c of candles) {
    const bucketTime = Math.floor(c.time / groupSec) * groupSec;
    const existing = buckets.get(bucketTime);
    if (!existing) {
      buckets.set(bucketTime, { time: bucketTime, open: c.open, high: c.high, low: c.low, close: c.close });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

/* مدة كل فريم بالثواني - نستخدمها لضبط (محاذاة) الطابع الزمني لكل شمعة على
   بداية الفريم الصحيحة. هاي هي "الحل الجذري" لمشكلة الشحطات بالشارت اللايف:
   يوهو فايننس بيرجع للشمعة الحالية (اللي لسا عم تتكوّن) طابع زمني هو وقت
   آخر تحديث/تيكة وصلت، مش وقت بداية الفريم الثابت. يعني مع كل استعلام لايف
   (كل 5 ثواني) كان ممكن يرجع طابع زمني مختلف شوي عن المرة اللي قبل، فالكود
   كان يفهمها غلط على إنها "شمعة جديدة" ويضيفها (push) بدل ما يحدّث نفس
   الشمعة (update) - وبما إنها لسا لحظية (open≈high≈low≈close تقريباً بنفس
   اللحظة) بتظهر كخط أفقي رفيع (شحطة) بدل شمعة طبيعية، وبتتكرر عشرات المرات
   بمكان قريب من بعض بدل ما تكبر/تتحرك بشكل طبيعي متزامن مع السوق.
   الحل: نحاذي (floor) كل طابع زمني على بداية فريمه الثابتة *قبل* أي شيء
   تاني - هيك أي تحديثات لايف جاية لنفس الفريم بترجع بنفس الطابع الزمني
   الثابت دايماً، فتنعمل عليها "update" صحيح بدل "push" مكرر. */
const INTERVAL_SECONDS = {
  "1min": 60,
  "5min": 300,
  "15min": 900,
  "1h": 3600,
  "4h": 4 * 3600,
  "1day": 24 * 3600,
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const interval = searchParams.get("interval") || "15min";
  const wanted = Math.min(Number(searchParams.get("count") || 1000), 5000);

  if (!symbol) {
    return NextResponse.json({ error: "الرجاء تحديد symbol" }, { status: 400 });
  }

  const cfg = INTERVAL_CONFIG[interval] || INTERVAL_CONFIG["15min"];

  /* السبب الحقيقي لمشكلة "الشارت الرئيسي بيتجمّد ومش بيتحدّث لايف بينما لوحة
     المقارنة عم تجيب بيانات أحدث": التحديث اللايف (pollLiveOnce بالواجهة)
     كان عم يطلب count=3 بس (آخر 3 شموع)، لكن هالسطر كان عم يحسب period1
     دايماً بناءً على rangeDays الكامل (تقدر توصل 729 يوم لفريم 4 ساعات/ساعة)
     بغض النظر عن count المطلوب! يعني كل 5 ثواني كان عم يترسل طلب ليوهو
     فايننس يجيب سنتين كاملتين من بيانات الساعة بس عشان ياخد آخر 3 شموع منها -
     طلب ضخم وغير ضروري بيتكرر كل 5 ثواني، وهاد بيوصل بسرعة لحد الحظر/التقييد
     (rate limit) عند يوهو لأنه API مجاني بدون مفتاح. لما يصير الحظر، يوهو
     بيرجع خطأ، و pollLiveOnce كان عم يتجاهل الخطأ بصمت (بدون أي إشعار)
     فيضل الشارت الرئيسي واقف عند آخر شمعة نجحت قبل الحظر - ممكن لأيام - بينما
     لوحة المقارنة (اللي بتطلب مرة وحدة بس لما تنفتح) ما بتتأثر بنفس الحظر
     وبتضل تجيب بيانات حديثة، فيصير فرق واضح بين اللوحتين.
     الحل: أي طلب بعدد شموع صغير (count <= 10) هو أكيد طلب "تحديث لايف" أو
     "مزامنة سريعة"، مش تحميل تاريخي كامل - فمنستخدمله مدى زمني صغير جداً
     (liveRangeDays) بدل rangeDays الكامل، فيصير الطلب خفيف جداً وما يوصل
     لحد التقييد أبداً. */
  const isLightPoll = wanted <= 10;
  const effectiveRangeDays = isLightPoll ? (cfg.liveRangeDays || cfg.rangeDays) : cfg.rangeDays;

  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - effectiveRangeDays * 24 * 60 * 60;

  const params = new URLSearchParams({
    interval: cfg.yInterval,
    period1: String(period1),
    period2: String(period2),
    includePrePost: "false",
  });

  /* نحاول أولاً بالطريقة "الموثوقة" (كوكي جلسة + crumb)، وهاي صارت شبه إلزامية
     من يوهو خصوصاً للطلبات الجاية من سيرفرات سحابية زي Vercel. لو فشلت (يوهو
     غيّر آلية الحماية مثلاً)، منرجع نجرب الطلب المباشر القديم كخطة بديلة بدل
     ما نطفّي الميزة بالكامل. */
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
      // خطة بديلة: طلب مباشر بدون crumb (كان هيك شغال قبل ما يوهو يشدد الحماية)
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
      // نرجع كود الحالة الحقيقي جوا الرسالة عشان يكون واضح بالـ console
      // إذا كانت مشكلة حظر/تقييد (429) أو صلاحية (401/403) أو غيرها
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
    if (err) {
      throw new Error(err.description || "الرمز غير موجود عند مزود البيانات");
    }

    const result = data?.chart?.result?.[0];
    if (!result || !Array.isArray(result.timestamp)) {
      return NextResponse.json({ candles: [] });
    }

    const quote = result.indicators?.quote?.[0] || {};
    let candles = result.timestamp
      .map((t, i) => ({
        time: t,
        open: quote.open?.[i],
        high: quote.high?.[i],
        low: quote.low?.[i],
        close: quote.close?.[i],
      }))
      // نشيل الشموع الفاضية أو الفاسدة (Yahoo بيرجع null بالأوقات اللي السوق مقفول فيها لبعض الأصول،
      // وأحياناً بيرجع قيم NaN/Infinity) - أي شمعة مش رقمية بالكامل بتكسر مكتبة الشارت بالواجهة
      .filter(
        (c) =>
          Number.isFinite(c.time) &&
          Number.isFinite(c.open) &&
          Number.isFinite(c.high) &&
          Number.isFinite(c.low) &&
          Number.isFinite(c.close)
      );

    if (cfg.aggregateHours) {
      // فريم 4 ساعات: نجمّع شموع الساعة كل 4 مع بعض
      candles = aggregateCandles(candles, cfg.aggregateHours * 3600);
    } else {
      // باقي الفريمات: يوهو بيرجعها بفريم مطابق أصلاً (1m/5m/15m/60m/1d)، بس
      // بنحاذي طابعها الزمني على بداية الفريم الثابتة لضمان استقرار الشمعة
      // الحالية (اللي لسا عم تتكوّن) بين كل استعلام لايف والتاني - هاد يمنع
      // مشكلة "الشحطات" (شموع لحظية مكررة قريبة من بعض بدل شمعة وحدة طبيعية).
      candles = aggregateCandles(candles, INTERVAL_SECONDS[interval] || 60);
    }

    // ضمان إضافي: ترتيب تصاعدي وحذف أي تكرار بنفس الطابع الزمني (مكتبة الشارت بترفض
    // أي بيانات مش متسلسلة تصاعدياً بشكل صارم وبتعمل كراش بالواجهة كلها)
    candles.sort((a, b) => a.time - b.time);
    candles = candles.filter((c, i) => i === 0 || c.time !== candles[i - 1].time);

    candles = candles.slice(-wanted);

    return NextResponse.json({ candles });
  } catch (e) {
    return NextResponse.json({ error: e.message || "فشل جلب البيانات" }, { status: 502 });
  }
}
