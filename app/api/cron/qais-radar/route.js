import { createAdminClient } from "@/lib/supabase-server";
import { createNotification } from "@/lib/notifications";
import { fetchYahooCandles } from "@/lib/yahoo-candles";
import { getAssetByValue } from "@/lib/assets";
import { analyzeSymbol, getCorrelatedSymbol } from "@/lib/qais/engine";
import { DEFAULT_RADAR_SYMBOLS, RADAR_TIMEFRAMES, CANDLE_COUNT } from "@/lib/qais/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* رموز مرجعية لأصول SMT مش موجودة أصلاً بقائمة أصول المنصة (lib/assets.js)
   لأنها مش قابلة للتداول عندنا، بنستخدمها بس كمرجع مقارنة لحساب الـ SMT */
const YAHOO_OVERRIDE = {
  XAUEUR: "XAUEUR=X",
};

function yahooSymbolFor(symbol) {
  return getAssetByValue(symbol)?.yahoo || YAHOO_OVERRIDE[symbol] || null;
}

async function fetchTF(symbol) {
  const yahoo = yahooSymbolFor(symbol);
  if (!yahoo) return null;
  const [daily, h4, h1, m15, m5] = await Promise.all([
    fetchYahooCandles(yahoo, RADAR_TIMEFRAMES.daily, CANDLE_COUNT.daily),
    fetchYahooCandles(yahoo, RADAR_TIMEFRAMES.h4, CANDLE_COUNT.h4),
    fetchYahooCandles(yahoo, RADAR_TIMEFRAMES.h1, CANDLE_COUNT.h1),
    fetchYahooCandles(yahoo, RADAR_TIMEFRAMES.m15, CANDLE_COUNT.m15),
    fetchYahooCandles(yahoo, RADAR_TIMEFRAMES.m5, CANDLE_COUNT.m5),
  ]);
  if (daily.error && h4.error && h1.error && m15.error && m5.error) return null;
  return { daily: daily.candles || [], h4: h4.candles || [], h1: h1.candles || [], m15: m15.candles || [], m5: m5.candles || [] };
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // الأصول المطلوب مراقبتها = القائمة الافتراضية + أي رمز أضافه طالب لقائمته الخاصة
  const { data: watchRows } = await supabase.from("qais_watchlist").select("symbol");
  const customSymbols = [...new Set((watchRows || []).map((r) => r.symbol))];
  const symbols = [...new Set([...DEFAULT_RADAR_SYMBOLS, ...customSymbols])];

  // الحالة السابقة لكل الرموز دفعة وحدة (لمعرفة "كانت جاهزة وانتهت" = أحمر، ومنع تكرار الإشعار)
  const { data: prevRows } = await supabase.from("qais_radar_state").select("*").in("symbol", symbols);
  const prevBySymbol = Object.fromEntries((prevRows || []).map((r) => [r.symbol, r]));

  // نجيب شموع كل الرموز مرة وحدة (بما فيها رموز الـ SMT المرجعية) لتفادي التكرار
  const candleCache = new Map();
  async function getCandles(symbol) {
    if (!candleCache.has(symbol)) candleCache.set(symbol, await fetchTF(symbol));
    return candleCache.get(symbol);
  }

  const results = [];
  const errors = [];

  for (const symbol of symbols) {
    try {
      const candlesByTF = await getCandles(symbol);
      if (!candlesByTF) {
        errors.push({ symbol, error: "تعذّر جلب بيانات الشموع" });
        continue;
      }

      const correlatedSymbol = getCorrelatedSymbol(symbol);
      let correlated = null;
      if (correlatedSymbol) {
        const corrCandles = await getCandles(correlatedSymbol);
        if (corrCandles) correlated = { symbol: correlatedSymbol, candlesByTF: corrCandles };
      }

      const previousState = prevBySymbol[symbol] || null;
      const result = analyzeSymbol({ symbol, candlesByTF, correlated, previousState });

      if (result.error) {
        errors.push({ symbol, error: result.error });
        continue;
      }

      await supabase.from("qais_radar_state").upsert({
        symbol,
        status: result.status,
        score: result.score,
        direction: result.direction,
        price: result.price,
        timeframe: result.timeframe,
        reason_tags: result.reasonTags,
        decision: result,
        updated_at: new Date().toISOString(),
      });

      // إشعار فقط عند تحوّل جديد للأخضر (score >= 85) — مش بكل تشغيلة كرون لنفس الإشارة القائمة
      const justTurnedGreen = result.shouldNotify && previousState?.status !== "green";
      if (justTurnedGreen) {
        const { data: watchers } = await supabase.from("qais_watchlist").select("user_id").eq("symbol", symbol);
        const userIds = [...new Set((watchers || []).map((w) => w.user_id))];
        for (const userId of userIds) {
          await createNotification(supabase, userId, {
            type: "qais_radar_signal",
            title: `${symbol} جاهز 🟢`,
            message: `Setup: SK + ICT ${result.direction === "up" ? "Buy" : "Sell"} — Confidence: ${result.confidence}% — Timeframe: ${result.timeframe}`,
            link: `/dashboard?tab=radar&symbol=${symbol}`,
          });
        }
      }

      results.push({ symbol, status: result.status, score: result.score });
    } catch (e) {
      errors.push({ symbol, error: e.message });
    }
  }

  return Response.json({ success: true, processed: results.length, results, errors, timestamp: new Date().toISOString() });
}
