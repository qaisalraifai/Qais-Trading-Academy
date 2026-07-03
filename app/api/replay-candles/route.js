
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/* مصدر البيانات: Yahoo Finance (مجاني بالكامل، بدون مفتاح API، بيغطي المعادن/الفوركس/الكريبتو/المؤشرات/الأسهم) */
const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

/* إعدادات كل فريم: الفريم المكافئ عند Yahoo + أقصى مدى تاريخي متاح لهالفريم (بالأيام)
   ملاحظة: Yahoo بيحدد مدى البيانات التاريخية حسب الفريم (شموع الدقيقة مثلاً تتوفر لآخر أسبوع بس)
   فريم 4 ساعات مش متوفر مباشرة عند Yahoo، فبنجيب شموع الساعة ونجمعها كل 4 شموع سوا */
const INTERVAL_CONFIG = {
  "1min":  { yInterval: "1m",  rangeDays: 7 },
  "5min":  { yInterval: "5m",  rangeDays: 60 },
  "15min": { yInterval: "15m", rangeDays: 60 },
  "1h":    { yInterval: "60m", rangeDays: 729 },
  "4h":    { yInterval: "60m", rangeDays: 729, aggregateEvery: 4 },
  "1day":  { yInterval: "1d",  rangeDays: 3650 },
};

function aggregateCandles(candles, groupSize) {
  const out = [];
  for (let i = 0; i < candles.length; i += groupSize) {
    const chunk = candles.slice(i, i + groupSize);
    if (chunk.length === 0) continue;
    out.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map((c) => c.high)),
      low: Math.min(...chunk.map((c) => c.low)),
      close: chunk[chunk.length - 1].close,
    });
  }
  return out;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const interval = searchParams.get("interval") || "15min";
  const wanted = Math.min(Number(searchParams.get("count") || 1000), 5000);

  if (!symbol) {
    return NextResponse.json({ error: "الرجاء تحديد symbol" }, { status: 400 });
  }

  const cfg = INTERVAL_CONFIG[interval] || INTERVAL_CONFIG["15min"];

  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - cfg.rangeDays * 24 * 60 * 60;

  const params = new URLSearchParams({
    interval: cfg.yInterval,
    period1: String(period1),
    period2: String(period2),
    includePrePost: "false",
  });

  const url = `${YF_BASE}/${encodeURIComponent(symbol)}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        // يوهو بيرفض الطلبات اللي بدون User-Agent شبيه بالمتصفح
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      cache: "no-store",
    });
    const data = await res.json();

    const err = data?.chart?.error;
    if (err) {
      throw new Error(err.description || "الرمز غير موجود عند مزود البيانات");
    }

    const result = data?.chart?.result?.[0];
    if (!result || !Array.isArray(result.timestamp)) {
      return NextResponse.json({ candles: [] });
    }

    const quote = result.indicators?.quote?.[0] || {};
    let candles = result.timestamp
      .map((t, i) => ({
        time: t,
        open: quote.open?.[i],
        high: quote.high?.[i],
        low: quote.low?.[i],
        close: quote.close?.[i],
      }))
      // نشيل الشموع الفاضية (Yahoo بيرجع null بالأوقات اللي السوق مقفول فيها لبعض الأصول)
      .filter(
        (c) => c.open != null && c.high != null && c.low != null && c.close != null
      );

    if (cfg.aggregateEvery) {
      candles = aggregateCandles(candles, cfg.aggregateEvery);
    }

    candles = candles.slice(-wanted);

    return NextResponse.json({ candles });
  } catch (e) {
    return NextResponse.json({ error: e.message || "فشل جلب البيانات" }, { status: 502 });
  }
}
