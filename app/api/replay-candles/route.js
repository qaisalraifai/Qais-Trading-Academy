import { NextResponse } from "next/server";
import { fetchYahooCandles, fetchYahooCandlesWithFallback } from "@/lib/yahoo-candles";
import { fetchTwelveDataCandles } from "@/lib/twelvedata-candles";

export const dynamic = "force-dynamic";

/* هاد الراوت غلاف رقيق فوق lib/yahoo-candles.js وlib/twelvedata-candles.js
   (نفس المنطق القديم بالضبط، بس تم نقله لملف مشترك عشان كرون Trading Radar
   يقدر يستخدمه من السيرفر مباشرة). السلوك من زاوية الواجهة القديمة ما تغيّر.

   باراميترات:
   - symbol (إجباري): رمز Yahoo الأساسي (سبوت لو متوفر، وإلا عقد آجل)
   - fallback (اختياري): رمز Yahoo احتياطي (عقد آجل) لو symbol فشل/رجع بيانات ناقصة
   - td (اختياري، جديد): رمز Twelve Data (مثلاً "XAU/USD") - لو موجود ومتوفر
     مفتاح TWELVE_DATA_API_KEY، منجرّبه *قبل* كل شي لأنه بيرجّع سعر سبوت حقيقي
     (مش عقد آجل مستمر فيه قفزات تدوير مصطنعة زي GC=F). لو فشل لأي سبب (حصة
     يومية خلصت، رمز مش مدعوم، مفتاح غير مضبوط...) بننزل تلقائياً لسلسلة
     Yahoo القديمة (symbol ثم fallback) بدون ما ينكسر أي شي.

   الترتيب الكامل: Twelve Data سبوت → Yahoo سبوت → Yahoo عقد آجل.
   شوفي lib/assets.js، lib/twelvedata-candles.js، وlib/yahoo-candles.js
   للتفاصيل الكاملة. */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const fallbackSymbol = searchParams.get("fallback") || null;
  const tdSymbol = searchParams.get("td") || null;
  const interval = searchParams.get("interval") || "15min";
  const wanted = Math.min(Number(searchParams.get("count") || 1000), 20000);
  const anchorRaw = searchParams.get("anchor");
  const anchor = anchorRaw != null && Number.isFinite(Number(anchorRaw)) ? Number(anchorRaw) : null;

  if (!symbol) {
    return NextResponse.json({ error: "الرجاء تحديد symbol" }, { status: 400 });
  }

  // المستوى 1: Twelve Data (سبوت حقيقي) - نجرّبه بس لو انبعت رمزه صراحة.
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
  }

  // المستوى 2 و3: سلسلة Yahoo القديمة (سبوت ثم عقد آجل) - نفس السلوك التوافقي القديم تماماً.
  const result = fallbackSymbol
    ? await fetchYahooCandlesWithFallback(symbol, fallbackSymbol, interval, wanted, anchor)
    : await fetchYahooCandles(symbol, interval, wanted, anchor);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({
    candles: result.candles,
    sourceSymbol: result.sourceSymbol || symbol,
    provider: "yahoo",
    usedFallback: !!result.usedFallback,
  });
}
