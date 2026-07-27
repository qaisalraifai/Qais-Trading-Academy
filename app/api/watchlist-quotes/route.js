import { NextResponse } from "next/server";
import { ASSETS } from "@/lib/assets";
import { fetchYahooQuotes } from "@/lib/yahoo-quotes";

export const dynamic = "force-dynamic";

/* كل الأصول يلي عندها رمز يوهو صالح (سبوت لو موجود، وإلا العقد الآجل) -
   نفس القائمة يلي بتظهر بلوحة الـ Watchlist بالكامل. */
const ALL_ITEMS = ASSETS.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group })));

/* ذاكرة تخزين مؤقت بالسيرفر (Best effort فقط - ما بتضمن مشاركة عبر كل
   الـinstances بالإنتاج، بس بتقلل كتير عدد طلبات يوهو لما يكون أكتر من
   تبويب/مستخدم فاتحين اللوحة بنفس اللحظة على نفس الـinstance). عمر الكاش
   أقصر من فترة تحديث الواجهة (10 ثانية) عشان أول طلب دايماً يجيب بيانات
   طازة، والطلبات اللي بعده خلال نفس الثانية العشرة بتاخد نفس النتيجة. */
const CACHE_TTL_MS = 8000;
let cache = { at: 0, quotes: null };

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols"); // رموز داخلية (v) مفصولة بفاصلة، اختياري

  const wanted = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : ALL_ITEMS.map((it) => it.v);

  const items = ALL_ITEMS.filter((it) => wanted.includes(it.v) && (it.yahooSpot || it.yahoo));
  if (items.length === 0) return NextResponse.json({ quotes: {} });

  const now = Date.now();
  if (!cache.quotes || now - cache.at > CACHE_TTL_MS) {
    const yahooSymbols = items.map((it) => it.yahooSpot || it.yahoo);
    const result = await fetchYahooQuotes(yahooSymbols);
    if (result.error) {
      // لو الطلب فشل بس عندنا كاش قديم، منفضّل نرجّعه على ما نكسر الواجهة بالكامل
      if (cache.quotes) return NextResponse.json({ quotes: cache.quotes, stale: true });
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    const bySymbolCode = {};
    for (const it of items) {
      const ySym = it.yahooSpot || it.yahoo;
      const q = result.quotes[ySym];
      if (q) bySymbolCode[it.v] = q;
    }
    cache = { at: now, quotes: bySymbolCode };
  }

  return NextResponse.json({ quotes: cache.quotes });
}
