import { createAdminClient } from "@/lib/supabase-server";
import { createNotification } from "@/lib/notifications";
import { fetchYahooCandles } from "@/lib/yahoo-candles";
import { getAssetByValue } from "@/lib/assets";
import { analyzeSymbol, getCorrelatedSymbol } from "@/lib/qais/engine";
import { radarRow } from "@/lib/qais/symbol-readiness";
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

  // -------- جلب مسبق بالتوازي (مهم بعد زيادة عدد الشموع لكل فريم من 300
  // لـ5000 لمطابقة الشارت الحي): لو جبنا شموع كل رمز الواحد ورا التاني جوا
  // الحلقة تحت زي ما كان قبل، ٦٠ ثانية (maxDuration) ممكن ما تكفي مع عدد
  // رموز أكبر. هون بنجيب الكل مع بعض دفعة وحدة (شامل رموز الـSMT
  // المترابطة)، وبعدين الحلقة تحت بتقرأ من الكاش مباشرة بدون أي انتظار شبكة
  // إضافي. --------
  const symbolsToPrefetch = new Set(symbols);
  for (const s of symbols) {
    const corr = getCorrelatedSymbol(s);
    if (corr) symbolsToPrefetch.add(corr);
  }
  // تجميع بالتوازي بس بدفعات محدودة (٤ بالمرة) — أسرع بكتير من وحدة وحدة
  // بدون ما نضرب حد معدّل طلبات يوهو (Yahoo rate limit) بإطلاق عشرات
  // الطلبات دفعة وحدة لو الرموز كتار.
  const prefetchList = [...symbolsToPrefetch];
  const BATCH_SIZE = 4;
  for (let i = 0; i < prefetchList.length; i += BATCH_SIZE) {
    await Promise.all(prefetchList.slice(i, i + BATCH_SIZE).map((s) => getCandles(s)));
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

      /* ⚠️ الصف بينتبنى بـ`radarRow` — مصدر واحد للشكل، بيستعمله الكرون
         واللوحة معاً. قبل هيك كان كل واحد بيبني صفه بإيده، فصار ممكن
         يتناقضوا. والأعمدة اللي مصدرها انشال بتنكتب `null` صراحةً بدل ما
         تضل قيمة قديمة معلّقة. */
      await supabase.from("qais_radar_state").upsert({
        ...radarRow(result),
        decision: result,
        updated_at: new Date().toISOString(),
      });

      /* -------- تاريخ الإشارات --------
         ⚠️ كان الفتح/الإغلاق مربوطاً بـ`radar_status` من `decision.js` —
         يعني بحالة مشتقّة من مجموع موزون. صار مربوطاً بـ`tradeValid`:
         السلسلة اكتملت فعلاً (كتلة → ثلث → SMT → CISD) ولا لأ. */
      const wasRadarActive = previousState?.radar_status === "green";
      const isRadarActive = !!result.tradeValid;
      const radarDirectionFlipped = wasRadarActive && isRadarActive && previousState?.direction !== result.direction;

      if (isRadarActive && (!wasRadarActive || radarDirectionFlipped)) {
        await supabase.from("qais_signal_history").insert({
          symbol,
          direction: result.direction,
          /* الدخول الفعلي من السلسلة — مش سعر اللحظة. */
          entry_price: result.entry ?? result.price,
          entry_time: new Date().toISOString(),
          rr_target: result.riskReward,
          status: "open",
          signal_label: result.signal,
          /* ⚠️ ما في رقم — `score` كان `radarScore`. */
          score: null,
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

      /* إشعار عند اكتمال سلسلة جديدة وبس — مش بكل تشغيلة كرون.
         ⚠️ كان في مساران للإشعار (`shouldNotify` و`radarShouldNotify`)،
         الاتنين مربوطين بعتبة على مجموع موزون (`score >= 85`). صار مسار
         واحد: السلسلة اكتملت، والرسالة بتقول **الشرط** مش نسبة. */
      const justBecameValid = result.tradeValid && !wasRadarActive;

      if (justBecameValid) {
        const { data: watchers } = await supabase.from("qais_watchlist").select("user_id").eq("symbol", symbol);
        const userIds = [...new Set((watchers || []).map((w) => w.user_id))];
        const met = result.readiness?.metCount ?? null;
        const total = result.readiness?.totalCount ?? null;
        for (const userId of userIds) {
          await createNotification(supabase, userId, {
            type: "qais_radar_signal",
            title: `${symbol} — ${result.signal} (${result.direction === "up" ? "Long" : "Short"})`,
            /* عدّ صريح بدل «Confidence: ٩٥٪». */
            message:
              `${met != null && total != null ? `${met}/${total} شرط · ` : ""}` +
              `دخول ${result.entry ?? "—"} · ستوب ${result.stopLoss ?? "—"}` +
              `${result.riskReward != null ? ` · ${result.riskReward}R` : ""} — ${result.sessionLabel}`,
            link: `/trading-radar?symbol=${symbol}`,
          });
        }
      }

      results.push({
        symbol,
        tradeValid: result.tradeValid,
        signal: result.signal,
        entryStatus: result.entryStatus,
        conditions: result.readiness?.metCount != null ? `${result.readiness.metCount}/${result.readiness.totalCount}` : null,
      });
    } catch (e) {
      errors.push({ symbol, error: e.message });
    }
  }

  return Response.json({ success: true, processed: results.length, results, errors, timestamp: new Date().toISOString() });
}
