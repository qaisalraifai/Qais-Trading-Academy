
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
  "4h":    { yInterval: "60m", rangeDays: 729, aggregateHours: 4 },
  "1day":  { yInterval: "1d",  rangeDays: 3650 },
};

/* تجميع الشموع حسب الوقت الفعلي (تقريب لأقرب حد 4 ساعات UTC) مش حسب ترتيبها بالمصفوفة.
   هيك التجميع بيضل صحيح ومتسلسل حتى لو صار انقطاع بالبيانات (عطلة/سوق مقفول)،
   لأن التجميع القديم (كل 4 عناصر متتالية) كان ممكن ينتج طوابع زمنية مش متسلسلة بشكل صحيح
   بعد أي فجوة، ومكتبة الشارت بترفض هيك بيانات وتعمل كراش بالواجهة */
function aggregateCandles(candles, groupHours) {
  const groupSec = groupHours * 3600;
  const buckets = new Map();
  for (const c of candles) {
    const bucketTime = Math.floor(c.time / groupSec) * groupSec;
    const existing = buckets.get(bucketTime);
    if (!existing) {
      buckets.set(bucketTime, { time: bucketTime, open: c.open, high: c.high, low: c.low, close: c.close });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
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
      // نشيل الشموع الفاضية أو الفاسدة (Yahoo بيرجع null بالأوقات اللي السوق مقفول فيها لبعض الأصول،
      // وأحياناً بيرجع قيم NaN/Infinity) - أي شمعة مش رقمية بالكامل بتكسر مكتبة الشارت بالواجهة
      .filter(
        (c) =>
          Number.isFinite(c.time) &&
          Number.isFinite(c.open) &&
          Number.isFinite(c.high) &&
          Number.isFinite(c.low) &&
          Number.isFinite(c.close)
      );

    if (cfg.aggregateHours) {
      candles = aggregateCandles(candles, cfg.aggregateHours);
    }

    // ضمان إضافي: ترتيب تصاعدي وحذف أي تكرار بنفس الطابع الزمني (مكتبة الشارت بترفض
    // أي بيانات مش متسلسلة تصاعدياً بشكل صارم وبتعمل كراش بالواجهة كلها)
    candles.sort((a, b) => a.time - b.time);
    candles = candles.filter((c, i) => i === 0 || c.time !== candles[i - 1].time);

    candles = candles.slice(-wanted);

    return NextResponse.json({ candles });
  } catch (e) {
    return NextResponse.json({ error: e.message || "فشل جلب البيانات" }, { status: 502 });
  }
}
