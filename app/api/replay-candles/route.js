import { NextResponse } from "next/server";
import { fetchYahooCandles, fetchYahooCandlesWithFallback } from "@/lib/yahoo-candles";

export const dynamic = "force-dynamic";

/* هاد الراوت صار مجرد غلاف رقيق فوق lib/yahoo-candles.js (نفس المنطق تماماً،
   بس تم نقله لملف مشترك عشان كرون Trading Radar الجديد يقدر يستخدمه من
   السيرفر مباشرة بدون استدعاء HTTP ذاتي). السلوك من زاوية الواجهة ما تغيّر إطلاقاً.

   باراميتر جديد اختياري: fallback=<رمز يوهو احتياطي>. لو مبعوت، بنجرب symbol
   (المفروض يكون رمز "سبوت" أقرب لتسعير TradingView/البروكر) أولاً، ولو يوهو
   رفضه أو رجّع بيانات ناقصة بنرجع تلقائياً لـ fallback (رمز العقد الآجل
   المضمون القديم). لو ما انبعتش fallback، السلوك 100% زي ما كان (رجعة توافقية،
   ما بينكسر أي استدعاء قديم للراوت). شوفي lib/assets.js وlib/yahoo-candles.js
   للتفاصيل الكاملة لسبب هالتغيير. */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const fallbackSymbol = searchParams.get("fallback") || null;
  const interval = searchParams.get("interval") || "15min";
  const wanted = Math.min(Number(searchParams.get("count") || 1000), 20000);
  const anchorRaw = searchParams.get("anchor");
  const anchor = anchorRaw != null && Number.isFinite(Number(anchorRaw)) ? Number(anchorRaw) : null;

  if (!symbol) {
    return NextResponse.json({ error: "الرجاء تحديد symbol" }, { status: 400 });
  }

  const result = fallbackSymbol
    ? await fetchYahooCandlesWithFallback(symbol, fallbackSymbol, interval, wanted, anchor)
    : await fetchYahooCandles(symbol, interval, wanted, anchor);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({
    candles: result.candles,
    sourceSymbol: result.sourceSymbol || symbol,
    usedFallback: !!result.usedFallback,
  });
}
