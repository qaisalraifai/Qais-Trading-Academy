/* ============================================================================
   lib/yahoo-quotes.js
   جالب أسعار Yahoo Finance اللحظية (Watchlist) — بعكس lib/yahoo-candles.js
   يلي بيجيب شموع OHLC كاملة لأصل واحد، هاد بيجيب "آخر سعر + نسبة/قيمة التغيّر"
   لعدة أصول دفعة وحدة (طلب HTTP واحد لكل رموز الـ Watchlist كلها) عن طريق
   v7/finance/quote (يقبل عدة رموز مفصولة بفاصلة بنفس الطلب). نفس منطق
   الكوكي/الـcrumb المستخدم أصلاً بجالب الشموع (مشترك، ما بينكرر). */

import { getCrumbAndCookie, UA } from "./yahoo-candles";

const YF_QUOTE_BASE = "https://query1.finance.yahoo.com/v7/finance/quote";

/**
 * يجيب آخر سعر + قيمة/نسبة التغيّر اليومي لعدة رموز يوهو دفعة وحدة.
 * @param {string[]} yahooSymbols - رموز يوهو (مثال: ["EURUSD=X","GC=F","BTC-USD"])
 * @returns {Promise<{quotes: Record<string, {price:number, change:number, changePercent:number}>}|{error:string}>}
 */
export async function fetchYahooQuotes(yahooSymbols) {
  const symbols = [...new Set((yahooSymbols || []).filter(Boolean))];
  if (symbols.length === 0) return { quotes: {} };

  const params = new URLSearchParams({ symbols: symbols.join(",") });

  async function doFetch() {
    try {
      const { crumb, cookie } = await getCrumbAndCookie();
      const withCrumb = new URLSearchParams(params);
      withCrumb.set("crumb", crumb);
      const res = await fetch(`${YF_QUOTE_BASE}?${withCrumb.toString()}`, {
        headers: { "User-Agent": UA, Cookie: cookie },
        cache: "no-store",
      });
      return { res, mode: "crumb" };
    } catch (crumbErr) {
      const res = await fetch(`${YF_QUOTE_BASE}?${params.toString()}`, {
        headers: { "User-Agent": UA },
        cache: "no-store",
      });
      return { res, mode: "direct", crumbErr };
    }
  }

  try {
    const { res, mode, crumbErr } = await doFetch();
    if (!res.ok) {
      const bodyPreview = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(
        `يوهو فايننس رفض طلب الأسعار (status ${res.status}${mode === "direct" ? ", direct-fallback" : ""})${
          crumbErr ? ` — فشل جلب crumb: ${crumbErr.message}` : ""
        }${bodyPreview ? ` — ${bodyPreview}` : ""}`
      );
    }
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("يوهو فايننس رجّع استجابة مش JSON صالح");
    }
    const results = data?.quoteResponse?.result || [];
    const quotes = {};
    for (const r of results) {
      if (!r?.symbol) continue;
      const price = r.regularMarketPrice;
      if (!Number.isFinite(price)) continue;
      quotes[r.symbol] = {
        price,
        change: Number.isFinite(r.regularMarketChange) ? r.regularMarketChange : 0,
        changePercent: Number.isFinite(r.regularMarketChangePercent) ? r.regularMarketChangePercent : 0,
      };
    }
    return { quotes };
  } catch (e) {
    return { error: e.message || "فشل جلب الأسعار" };
  }
}
