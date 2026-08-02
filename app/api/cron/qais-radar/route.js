import { createAdminClient } from "@/lib/supabase-server";
import { createNotification } from "@/lib/notifications";
import { fetchYahooCandles } from "@/lib/yahoo-candles";
import { getAssetByValue } from "@/lib/assets";
import { analyzeSymbol, getCorrelatedSymbol } from "@/lib/qais/engine";
import { DEFAULT_RADAR_SYMBOLS, RADAR_TIMEFRAMES, CANDLE_COUNT, getSymbolCurrencies, NEWS_BLOCK_WINDOW_MINUTES } from "@/lib/qais/config";
import { getActiveNewsBlock } from "@/lib/economic-calendar";

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

  // فلتر الأخبار (الفصل ٩) — نكاش النتيجة حسب مجموعة العملات، عشان رموز كتير
  // بنفس العملة (مثلاً كل أزواج USD) ما تسأل قاعدة البيانات كل وحدة لحالها
  const newsBlockCache = new Map();
  async function getNewsBlockFor(symbol) {
    const currencies = getSymbolCurrencies(symbol);
    const key = currencies.slice().sort().join("|");
    if (!newsBlockCache.has(key)) {
      newsBlockCache.set(key, await getActiveNewsBlock(currencies, NEWS_BLOCK_WINDOW_MINUTES));
    }
    return newsBlockCache.get(key);
  }

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
      const newsBlocked = await getNewsBlockFor(symbol);
      const result = analyzeSymbol({ symbol, candlesByTF, correlated, previousState, newsBlocked });

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
        // -------- Smart Market Radar v2 (إضافي — ما بيلمس الأعمدة القديمة فوق) --------
        radar_status: result.radarStatus,
        radar_score: result.radarScore,
        radar_signal_label: result.radarSignalLabel,
        radar_signal_strength: result.radarSignalStrengthLabel,
        htf_trend: result.htfTrend,
        market_structure: result.marketStructure,
        bos_status: result.bosStatus,
        choch_status: result.chochStatus,
        fvg_status: result.fvgStatus,
        liquidity_status: result.liquidityStatus,
        premium_discount: result.premiumDiscount,
        session: result.session,
        session_label: result.sessionLabel,
        entry_status: result.entryStatus,
        risk_reward: result.riskReward,
        why: result.why,
      });

      // -------- Signal History (v2): فتح/إغلاق صفقة تلقائياً حسب انتقال radar_status --------
      const ACTIVE_RADAR_STATUSES = ["green", "blue", "orange", "red"]; // أي إشارة اتجاهية معتمدة (Buy/Sell) بنظام v2
      const wasRadarActive = ACTIVE_RADAR_STATUSES.includes(previousState?.radar_status);
      const isRadarActive = ACTIVE_RADAR_STATUSES.includes(result.radarStatus);
      const radarDirectionFlipped = wasRadarActive && isRadarActive && previousState?.direction !== result.direction;

      if (isRadarActive && (!wasRadarActive || radarDirectionFlipped)) {
        await supabase.from("qais_signal_history").insert({
          symbol,
          direction: result.direction,
          entry_price: result.price,
          entry_time: new Date().toISOString(),
          rr_target: result.riskReward,
          status: "open",
          signal_label: result.radarSignalLabel,
          score: result.radarScore,
        });
      } else if (wasRadarActive && (!isRadarActive || radarDirectionFlipped)) {
        const { data: openRows } = await supabase
          .from("qais_signal_history")
          .select("id, entry_price, direction")
          .eq("symbol", symbol)
          .eq("status", "open")
          .order("entry_time", { ascending: false })
          .limit(1);
        const openTrade = openRows?.[0];
        if (openTrade && openTrade.entry_price != null && result.price != null) {
          const win = openTrade.direction === "up" ? result.price > openTrade.entry_price : result.price < openTrade.entry_price;
          const pnlPct = ((result.price - openTrade.entry_price) / openTrade.entry_price) * 100 * (openTrade.direction === "up" ? 1 : -1);
          await supabase
            .from("qais_signal_history")
            .update({
              exit_price: result.price,
              exit_time: new Date().toISOString(),
              status: win ? "win" : "loss",
              pnl_pct: +pnlPct.toFixed(2),
            })
            .eq("id", openTrade.id);
        }
      }

      // إشعار فقط عند تحوّل جديد للأخضر (score >= 85) — مش بكل تشغيلة كرون لنفس الإشارة القائمة
      const justTurnedGreen = result.shouldNotify && previousState?.status !== "green";
      // إشعار v2 إضافي مستقل: فقط عند Strong Buy/Strong Sell الجديدة بنظام الرادار الجديد —
      // ما بيكرر إشعار لو نفس التحوّل أصلاً غطّاه الشرط الأصلي فوق بنفس التشغيلة
      const justConfirmedRadarV2 =
        !justTurnedGreen && result.radarShouldNotify && previousState?.radar_status !== result.radarStatus;

      if (justTurnedGreen || justConfirmedRadarV2) {
        const { data: watchers } = await supabase.from("qais_watchlist").select("user_id").eq("symbol", symbol);
        const userIds = [...new Set((watchers || []).map((w) => w.user_id))];
        for (const userId of userIds) {
          if (justTurnedGreen) {
            await createNotification(supabase, userId, {
              type: "qais_radar_signal",
              title: `${symbol} جاهز 🟢`,
              message: `Setup: SK + ICT ${result.direction === "up" ? "Buy" : "Sell"} — Confidence: ${result.confidence}% — Timeframe: ${result.timeframe}`,
              link: `/trading-radar?symbol=${symbol}`,
            });
          } else {
            await createNotification(supabase, userId, {
              type: "qais_radar_signal",
              title: `${symbol} — ${result.radarSignalLabel} ${result.direction === "up" ? "🟢" : "🔴"}`,
              message: `Confidence: ${result.radarScore}% — ${result.sessionLabel} — Tap to open chart`,
              link: `/trading-radar?symbol=${symbol}`,
            });
          }
        }
      }

      results.push({ symbol, status: result.status, score: result.score, radarStatus: result.radarStatus, radarScore: result.radarScore });
    } catch (e) {
      errors.push({ symbol, error: e.message });
    }
  }

  return Response.json({ success: true, processed: results.length, results, errors, timestamp: new Date().toISOString() });
}
