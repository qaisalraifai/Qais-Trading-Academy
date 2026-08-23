import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getActiveNewsBlock } from "@/lib/economic-calendar";
import { getSymbolCurrencies, NEWS_BLOCK_WINDOW_MINUTES } from "@/lib/qais/config";

// GET /api/economic-events/news-block?symbols=XAUUSD,EURUSD,GBPUSD — فلتر الأخبار
// الاقتصادية لـ QAIS SK Engine (توثيق RADAR الجديد، الفصل ٩): بيرجّع لكل رمز إما
// null (ما في خبر مهم قريب) أو تفاصيل أقرب خبر High ضمن نافذة NEWS_BLOCK_WINDOW_MINUTES
// دقيقة حول الوقت الحالي — تستخدمها الواجهة (QaisEngineView/MarketIntelligenceView)
// قبل تمرير النتيجة لـ analyzeSymbol() كـ newsBlocked.
export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols") || "";
  const symbols = [...new Set(symbolsParam.split(",").map((s) => s.trim()).filter(Boolean))];
  if (!symbols.length) return NextResponse.json({ error: "لازم تمرير symbols" }, { status: 400 });

  // كل عملة فريدة نسألها مرة وحدة بس (رموز كتير ممكن تشترك بنفس العملة، مثلاً كل أزواج USD)
  const currencyCache = new Map();
  async function blockForCurrencies(currencies) {
    const key = currencies.slice().sort().join("|");
    if (!currencyCache.has(key)) {
      currencyCache.set(key, await getActiveNewsBlock(currencies, NEWS_BLOCK_WINDOW_MINUTES));
    }
    return currencyCache.get(key);
  }

  const blocked = {};
  for (const symbol of symbols) {
    blocked[symbol] = await blockForCurrencies(getSymbolCurrencies(symbol));
  }

  return NextResponse.json({ success: true, windowMinutes: NEWS_BLOCK_WINDOW_MINUTES, blocked });
}
