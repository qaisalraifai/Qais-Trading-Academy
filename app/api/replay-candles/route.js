import { NextResponse } from "next/server";
import { fetchYahooCandles } from "@/lib/yahoo-candles";

export const dynamic = "force-dynamic";

/* هاد الراوت صار مجرد غلاف رقيق فوق lib/yahoo-candles.js (نفس المنطق تماماً،
   بس تم نقله لملف مشترك عشان كرون Trading Radar الجديد يقدر يستخدمه من
   السيرفر مباشرة بدون استدعاء HTTP ذاتي). السلوك من زاوية الواجهة ما تغيّر إطلاقاً. */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const interval = searchParams.get("interval") || "15min";
  const wanted = Math.min(Number(searchParams.get("count") || 1000), 20000);
  const anchorRaw = searchParams.get("anchor");
  const anchor = anchorRaw != null && Number.isFinite(Number(anchorRaw)) ? Number(anchorRaw) : null;

  if (!symbol) {
    return NextResponse.json({ error: "الرجاء تحديد symbol" }, { status: 400 });
  }

  const result = await fetchYahooCandles(symbol, interval, wanted, anchor);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ candles: result.candles });
}
