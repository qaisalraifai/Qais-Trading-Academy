import { NextResponse } from "next/server";
import { fetchYahooCandles } from "@/lib/yahoo-candles";
import { fetchTwelveDataCandles } from "@/lib/twelvedata-candles";
import { fetchDukascopyCandles } from "@/lib/dukascopy-candles";

export const dynamic = "force-dynamic";
// دوكاسكوبي بتنزّل وتفكّ ملفات أرشيف حقيقية (مش JSON فوري)، فأول طلب لمدى
// طويل ممكن ياخد كذا ثانية - منمدد وقت تنفيذ الدالة عشان ما تنقطع على
// Vercel قبل ما تخلص (عدّليه حسب الخطة عندك لو احتجتي).
export const maxDuration = 30;

<<<<<<< HEAD
/* هاد الراوت غلاف رقيق فوق lib/yahoo-candles.js وlib/twelvedata-candles.js
=======
/* مهلة زمنية لـDukascopy (شوفي withTimeout تحت): لو ما رد بهاد الوقت، منكمل
   فوراً لـTwelve Data/يوهو بدل ما تضل الواجهة عالقة على "جاري تحميل
   البيانات..." للأبد (هاد بالضبط كان سبب تعليق الشارت اللي لاحظته
   المستخدمة على فريم الساعة للذهب - أرشيف Dukascopy لمدى طويل ممكن ياخد
   وقت أطول من المتوقع أو ما يرد أصلاً أحياناً). بوضع الريبلاي (anchor
   موجود) منعطيه صبر أطول لأنه هناك المستخدمة قاصدة فعلاً تاريخ عميق
   وعم تتوقع انتظار؛ بوضع اللايف العادي (بدون anchor) منقصّرها كتير عشان
   الشارت يفتح بسرعة معقولة دايماً حتى لو رجعنا لمصدر أضعف تاريخياً.

   رفعناها من 22 لـ27 ثانية (maxDuration المسموح 30): تبيّن إنه لما تكون
   نقطة القص قديمة جداً (زي 2016)، Dukascopy كان بيضرب المهلة القديمة (22
   ثانية) بالضبط قبل ما يخلص تحميل/فك أرشيف السنين البعيدة، فكان يرجع
   تلقائياً لـYahoo - ويوهو تحديداً لبيانات الفوركس اليومية القديمة بترجع
   شموع فتحها≈إغلاقها (فرق أقل من نقطة واحدة أحياناً) بينما مداها (أعلى-أدنى)
   عشرات النقاط - شكل "شحطة رفيعة بفتيل ضخم" مغلوط تماماً، مش انعكاس حقيقي
   لحركة السوق (شوفي isDailyBatchSuspicious تحت لتفاصيل الفحص والرفض). */
const DUKASCOPY_TIMEOUT_MS_LIVE = 8000;
const DUKASCOPY_TIMEOUT_MS_ANCHOR = 27000;

function withTimeout(promise, ms, timeoutResult) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(timeoutResult), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Keep the API contract valid for every client, not only the replay chart.
// A candle's wick must always contain its body: low <= open/close <= high.
function normalizeOhlc(candles) {
  if (!Array.isArray(candles)) return [];
  const byTime = new Map();
  for (const candle of candles) {
    const time = Number(candle?.time);
    const open = Number(candle?.open);
    const high = Number(candle?.high);
    const low = Number(candle?.low);
    const close = Number(candle?.close);
    if (![time, open, high, low, close].every(Number.isFinite)) continue;
    byTime.set(time, {
      ...candle,
      time,
      open,
      close,
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
    });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/* ============================================================================
   فحص جودة شموع اليومي القادمة من مصدر احتياطي (Twelve Data أو Yahoo) لأزواج
   الفوركس تحديداً. اكتشفنا (بالتشخيص المباشر مع المستخدمة) إنه أرشيف Yahoo
   القديم لليومي أحياناً بيرجّع شموع فتحها≈إغلاقها (فرق أقل من نقطة) بينما
   مداها (أعلى-أدنى) عشرات النقاط - شكل "شحطة رفيعة بفتيل ضخم" مغلوط تماماً،
   بيتكرر بمعظم شموع الدفعة مش بشمعة واحدة عرضية. الدوجي الحقيقي (فتح≈إغلاق
   بمدى كبير فعلاً) بيصير أحياناً بس نادراً - مش بمعظم أيام الدفعة كلها. فمنعتبر
   الدفعة كلها "غير موثوقة" فقط لو نسبة كبيرة منها (40%+) عندها هالنمط سوا،
   ومنرفضها صراحة بدل ما نعرضها بصمت (نفس فلسفة "خطأ واضح بدل بيانات غلط
   بصمت" المطبّقة فوق لعقود الآجل). Dukascopy ما بيمرّ من هالفحص أصلاً (مصدر
   موثوق، شوفي المستوى 0 تحت). */
function isDailyBatchSuspicious(candles) {
  if (!Array.isArray(candles) || candles.length < 5) return false;
  let suspicious = 0;
  for (const c of candles) {
    const range = c.high - c.low;
    if (range <= 0) continue;
    const body = Math.abs(c.close - c.open);
    // جسم أقل من 5% من المدى *و* المدى نفسه أوسع من 15 نقطة (0.0015) لزوج
    // فوركس عادي - دوجي حقيقي نادراً بيوصل هالنسبة على مدى بهالاتساع.
    if (body / range < 0.05 && range > 0.0015) suspicious++;
  }
  return suspicious / candles.length >= 0.4;
}


>>>>>>> dc2cc2d76418732e290147244cd9ea9b2eb3dc10
   (نفس المنطق القديم بالضبط، بس تم نقله لملف مشترك عشان كرون Trading Radar
   يقدر يستخدمه من السيرفر مباشرة). السلوك من زاوية الواجهة القديمة ما تغيّر.

   باراميترات:
   - symbol (إجباري): رمز Yahoo (سبوت لو متوفر، مثلاً XAU= للذهب)
   - td (اختياري): رمز Twelve Data (مثلاً "XAU/USD") - لو موجود ومتوفر مفتاح
     TWELVE_DATA_API_KEY، منجرّبه *قبل* كل شي لأنه بيرجّع سعر سبوت حقيقي.

   تحديث مهم (بطلب صريح من المستخدمة): ما في ولا رجعة تلقائية لعقد آجل
   (futures) بعد اليوم. قبل هيك كان في مستوى ثالث صامت (fallback=GC=F) بيصير
   لو فشل السبوت من الاثنين - وهاد بالضبط اللي كانت بتظهر بسببه علامة
   "تقريب: عقود آجلة" اللي المستخدمة رفضتها صراحة. هلق الترتيب بس:
   Twelve Data سبوت → Yahoo سبوت → خطأ واضح (بدل بيانات غلط بصمت). لو
   المستخدمة بدها ترجّع خيار العقد الآجل كملاذ أخير مستقبلاً، الدالة
   fetchYahooCandlesWithFallback لسا موجودة بـ lib/yahoo-candles.js وجاهزة -
   بس محدا عم يستدعيها من هون قصداً الآن. */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const tdSymbol = searchParams.get("td") || null;
  const dukSymbol = searchParams.get("duk") || null;
  const interval = searchParams.get("interval") || "15min";
  const wanted = Math.min(Number(searchParams.get("count") || 1000), 20000);
  const anchorRaw = searchParams.get("anchor");
  const anchor = anchorRaw != null && Number.isFinite(Number(anchorRaw)) ? Number(anchorRaw) : null;

  if (!symbol) {
    return NextResponse.json({ error: "الرجاء تحديد symbol" }, { status: 400 });
  }

  let dukError = null;
  let tdError = null;

  // المستوى 0: Dukascopy - بس لما يكون في anchor فعلي (وضع ريبلاي حقيقي
  // بيرجع لتاريخ ممكن يكون أقدم من حد يوهو ~29-58 يوم للفريمات الصغيرة).
  // ما منستخدمه بوضع اللايف العادي (بدون anchor) لأنه مصمم كأرشيف تاريخي
  // مش بث لحظي، ويوهو/Twelve Data أسرع وأنسب لهيك حالة أصلاً.
  if (dukSymbol && anchor != null) {
    const dukResult = await fetchDukascopyCandles(dukSymbol, interval, wanted, anchor);
    if (!dukResult.error && (dukResult.candles?.length || 0) >= 2) {
      return NextResponse.json({
        candles: dukResult.candles,
        sourceSymbol: dukSymbol,
        provider: "dukascopy",
        usedFallback: false,
      });
    }
    dukError = dukResult.error || "استجابة فارغة من Dukascopy";
  }

  // المستوى 1: Twelve Data (سبوت حقيقي).
  if (tdSymbol) {
    const tdResult = await fetchTwelveDataCandles(tdSymbol, interval, wanted, anchor);
    if (!tdResult.error && (tdResult.candles?.length || 0) >= 2) {
<<<<<<< HEAD
      return NextResponse.json({
        candles: tdResult.candles,
        sourceSymbol: tdSymbol,
        provider: "twelvedata",
        usedFallback: false,
      });
=======
      if (interval === "1day" && isDailyBatchSuspicious(tdResult.candles)) {
        tdError = "بيانات Twelve Data اليومية لهذا المدى تبدو غير موثوقة (أجسام شموع أصغر بكثير من مداها بمعظم الدفعة)";
      } else {
        return NextResponse.json({
          candles: normalizeOhlc(tdResult.candles),
          sourceSymbol: tdSymbol,
          provider: "twelvedata",
          usedFallback: false,
        });
      }
    } else {
      tdError = tdResult.error || "استجابة فارغة من Twelve Data";
>>>>>>> dc2cc2d76418732e290147244cd9ea9b2eb3dc10
    }
  }

  // المستوى 2: Yahoo سبوت (لو الرمز نفسه أصلاً رمز سبوت زي XAU=).
  const yahooResult = await fetchYahooCandles(symbol, interval, wanted, anchor);
  const yahooSuspicious = interval === "1day" && !yahooResult.error && isDailyBatchSuspicious(yahooResult.candles);
  if (!yahooResult.error && !yahooSuspicious && (yahooResult.candles?.length || 0) >= 2) {
    return NextResponse.json({
      candles: yahooResult.candles,
      sourceSymbol: symbol,
      provider: "yahoo",
      usedFallback: false,
    });
  }

  // فشل الاثنين - نرجّع خطأ واضح بدل ما ننزل لعقد آجل بصمت. منرفق تفاصيل
  // الخطأين الحقيقيين (مو رسالة عامة) عشان يسهل تشخيص أي مشكلة مستقبلية
  // (مفتاح API غلط، حصة يومية خلصت، رمز مش مدعوم...) من تبويب Network مباشرة.
  const parts = [];
  if (dukSymbol && anchor != null) parts.push(`Dukascopy (${dukSymbol}): ${dukError}`);
  if (tdSymbol) parts.push(`Twelve Data (${tdSymbol}): ${tdError}`);
  parts.push(
    `Yahoo (${symbol}): ${
      yahooSuspicious
        ? "بيانات اليومي لهذا المدى تبدو غير موثوقة (أجسام شموع أصغر بكثير من مداها بمعظم الدفعة) - أرشيف يوهو القديم للفوركس معروف بهالمشكلة"
        : yahooResult.error || "بيانات غير كافية"
    }`
  );

  return NextResponse.json(
    { error: `لا توجد بيانات سبوت متاحة حالياً — ${parts.join(" | ")}` },
    { status: 502 }
  );
}
