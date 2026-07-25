import { NextResponse } from "next/server";
import { fetchYahooCandles } from "@/lib/yahoo-candles";
import { fetchTwelveDataCandles } from "@/lib/twelvedata-candles";
import { fetchDukascopyCandles } from "@/lib/dukascopy-candles";

export const dynamic = "force-dynamic";
// دوكاسكوبي بتنزّل وتفكّ ملفات أرشيف حقيقية (مش JSON فوري)، فأول طلب لمدى
// طويل ممكن ياخد كذا ثانية - منمدد وقت تنفيذ الدالة عشان ما تنقطع على
// Vercel قبل ما تخلص (عدّليه حسب الخطة عندك لو احتجتي).
export const maxDuration = 30;

/* مهلة زمنية لـDukascopy (شوفي withTimeout تحت): لو ما رد بهاد الوقت، منكمل
   فوراً لـTwelve Data/يوهو بدل ما تضل الواجهة عالقة على "جاري تحميل
   البيانات..." للأبد (هاد بالضبط كان سبب تعليق الشارت اللي لاحظته
   المستخدمة على فريم الساعة للذهب - أرشيف Dukascopy لمدى طويل ممكن ياخد
   وقت أطول من المتوقع أو ما يرد أصلاً أحياناً). بوضع الريبلاي (anchor
   موجود) منعطيه صبر أطول لأنه هناك المستخدمة قاصدة فعلاً تاريخ عميق
   وعم تتوقع انتظار؛ بوضع اللايف العادي (بدون anchor) منقصّرها كتير عشان
   الشارت يفتح بسرعة معقولة دايماً حتى لو رجعنا لمصدر أضعف تاريخياً. */
const DUKASCOPY_TIMEOUT_MS_LIVE = 8000;
const DUKASCOPY_TIMEOUT_MS_ANCHOR = 22000;

function withTimeout(promise, ms, timeoutResult) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(timeoutResult), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/* هاد الراوت غلاف رقيق فوق lib/yahoo-candles.js وlib/twelvedata-candles.js
   (نفس المنطق القديم بالضبط، بس تم نقله لملف مشترك عشان كرون Trading Radar
   يقدر يستخدمه من السيرفر مباشرة). السلوك من زاوية الواجهة القديمة ما تغيّر.

   باراميترات:
   - symbol (إجباري): رمز Yahoo (سبوت لو متوفر، مثلاً XAU= للذهب)
   - td (اختياري): رمز Twelve Data (مثلاً "XAU/USD") - لو موجود ومتوفر مفتاح
     TWELVE_DATA_API_KEY، منجرّبه *قبل* كل شي لأنه بيرجّع سعر سبوت حقيقي.

   تحديث مهم (بطلب صريح من المستخدمة): ما في ولا رجعة تلقائية لعقد آجل
   (futures) بعد اليوم. قبل هيك كان في مستوى ثالث صامت (fallback=GC=F) بيصير
   لو فشل السبوت من الاثنين - وهاد بالضبط اللي كانت بتظهر بسببه علامة
   "تقريب: عقود آجلة" اللي المستخدمة رفضتها صراحة. لو المستخدمة بدها ترجّع
   خيار العقد الآجل كملاذ أخير مستقبلاً، الدالة fetchYahooCandlesWithFallback
   لسا موجودة بـ lib/yahoo-candles.js وجاهزة - بس محدا عم يستدعيها من هون
   قصداً الآن.

   تحديث لاحق: الترتيب الحالي صار Dukascopy (مجاني، أعمق تاريخياً، وبدون
   شموع عطلة أسبوع مسطّحة) → Twelve Data سبوت → Yahoo سبوت → خطأ واضح
   (بدل بيانات غلط بصمت). شوفي تعليق "المستوى 0" تحت لتفاصيل السبب. */
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

  // المستوى 0: Dukascopy - هلق هو المصدر الافتراضي الأساسي (مو بس لما يكون
  // في anchor فعلي). قبل هيك كان محصور بوضع الريبلاي العميق بس، بس تبيّن
  // إنه أفضل خيار افتراضي أصلاً لثلاث أسباب مع بعض:
  //   1) مجاني بالكامل وبدون مفتاح API أو حد طلبات يومي (بعكس Twelve Data).
  //   2) عمق تاريخي حقيقي أكبر بكثير من يوهو لفريمات زي 15 دقيقة/ساعة/4
  //      ساعات (يوهو محدودة عملياً بحوالي 58 يوم لـ15 دقيقة، وDukascopy
  //      بيوصل لسنين للخلف) - هاد كان سبب "عدد الشموع قليل" المذكور.
  //   3) ignoreFlats:true بمكتبة dukascopy-node بتشيل تلقائياً شموع عطلة
  //      الأسبوع "المسطّحة" (شكل صليب/شحطة رفيعة) لكل الأصول وكل الفريمات
  //      دفعة وحدة، بدل الفلتر اليدوي يلي كان مقتصر بس على فريم اليوم
  //      ولأزواج الفوركس (=X) بـ lib/yahoo-candles.js - فهلق أي أصل/فريم
  //      بيستفيد من نفس الحل، وأول ما يفتح السوق (الإثنين مثلاً) بتطلع أول
  //      شمعة حقيقية طبيعية مباشرة بدل ما تسبقها شمعة فارغة/مسطّحة.
  // لو Dukascopy فشل لأي سبب (رمز غير مدعوم، تعطّل مؤقت بالأرشيف...) منكمل
  // تلقائياً لـTwelve Data ثم يوهو زي ما كان بالضبط - صفر خطر كسر أي أصل.
  if (dukSymbol) {
    const dukTimeoutMs = anchor != null ? DUKASCOPY_TIMEOUT_MS_ANCHOR : DUKASCOPY_TIMEOUT_MS_LIVE;
    const dukResult = await withTimeout(
      fetchDukascopyCandles(dukSymbol, interval, wanted, anchor),
      dukTimeoutMs,
      { error: `انتهت مهلة الانتظار (${dukTimeoutMs / 1000} ثانية) بدون رد من Dukascopy` }
    );
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
      return NextResponse.json({
        candles: tdResult.candles,
        sourceSymbol: tdSymbol,
        provider: "twelvedata",
        usedFallback: false,
      });
    }
    tdError = tdResult.error || "استجابة فارغة من Twelve Data";
  }

  // المستوى 2: Yahoo سبوت (لو الرمز نفسه أصلاً رمز سبوت زي XAU=).
  const yahooResult = await fetchYahooCandles(symbol, interval, wanted, anchor);
  if (!yahooResult.error && (yahooResult.candles?.length || 0) >= 2) {
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
  if (dukSymbol) parts.push(`Dukascopy (${dukSymbol}): ${dukError}`);
  if (tdSymbol) parts.push(`Twelve Data (${tdSymbol}): ${tdError}`);
  parts.push(`Yahoo (${symbol}): ${yahooResult.error || "بيانات غير كافية"}`);

  return NextResponse.json(
    { error: `لا توجد بيانات سبوت متاحة حالياً — ${parts.join(" | ")}` },
    { status: 502 }
  );
}
