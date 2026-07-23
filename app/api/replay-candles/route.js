import { NextResponse } from "next/server";
import { fetchYahooCandles } from "@/lib/yahoo-candles";
import { fetchTwelveDataCandles } from "@/lib/twelvedata-candles";

export const dynamic = "force-dynamic";

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
   "تقريب: عقود آجلة" اللي المستخدمة رفضتها صراحة. هلق الترتيب بس:
   Twelve Data سبوت → Yahoo سبوت → خطأ واضح (بدل بيانات غلط بصمت). لو
   المستخدمة بدها ترجّع خيار العقد الآجل كملاذ أخير مستقبلاً، الدالة
   fetchYahooCandlesWithFallback لسا موجودة بـ lib/yahoo-candles.js وجاهزة -
   بس محدا عم يستدعيها من هون قصداً الآن. */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const tdSymbol = searchParams.get("td") || null;
  const interval = searchParams.get("interval") || "15min";
  const wanted = Math.min(Number(searchParams.get("count") || 1000), 20000);
  const anchorRaw = searchParams.get("anchor");
  const anchor = anchorRaw != null && Number.isFinite(Number(anchorRaw)) ? Number(anchorRaw) : null;

  if (!symbol) {
    return NextResponse.json({ error: "الرجاء تحديد symbol" }, { status: 400 });
  }

  let tdError = null;

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
  if (tdSymbol) parts.push(`Twelve Data (${tdSymbol}): ${tdError}`);
  parts.push(`Yahoo (${symbol}): ${yahooResult.error || "بيانات غير كافية"}`);

  return NextResponse.json(
    { error: `لا توجد بيانات سبوت متاحة حالياً — ${parts.join(" | ")}` },
    { status: 502 }
  );
}
