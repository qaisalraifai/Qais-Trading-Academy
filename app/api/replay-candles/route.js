bash

cat /home/claude/replay-rebuild/api_replay-candles_route.js
Output

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TD_BASE = "https://api.twelvedata.com/time_series";
const MAX_PER_REQUEST = 5000; // أقصى عدد شموع بالطلب الواحد عند Twelve Data
const MAX_BATCHES = 3; // حماية من استهلاك الحد اليومي المجاني بسرعة

function toChartCandle(row) {
  return {
    time: Math.floor(new Date(row.datetime.replace(" ", "T") + "Z").getTime() / 1000),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
  };
}

async function fetchBatch(symbol, interval, apikey, endDate) {
  const params = new URLSearchParams({
    symbol,
    interval,
    outputsize: String(MAX_PER_REQUEST),
    order: "DESC",
    apikey,
  });
  if (endDate) params.set("end_date", endDate);

  const res = await fetch(`${TD_BASE}?${params.toString()}`);
  const data = await res.json();

  if (data.status === "error") {
    throw new Error(data.message || "خطأ من Twelve Data");
  }
  if (!Array.isArray(data.values)) return [];
  return data.values;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const interval = searchParams.get("interval") || "15min";
  const wanted = Math.min(Number(searchParams.get("count") || 1000), MAX_PER_REQUEST * MAX_BATCHES);

  const apikey = process.env.TWELVE_DATA_API_KEY;
  if (!apikey) {
    return NextResponse.json({ error: "TWELVE_DATA_API_KEY غير مضبوط بالسيرفر" }, { status: 500 });
  }
  if (!symbol) {
    return NextResponse.json({ error: "الرجاء تحديد symbol" }, { status: 400 });
  }

  try {
    let all = [];
    let endDate = undefined;

    while (all.length < wanted) {
      const batch = await fetchBatch(symbol, interval, apikey, endDate);
      if (batch.length === 0) break;

      all = all.concat(batch);

      // نجهز نقطة النهاية للطلب الجاي (أقدم شمعة بالدفعة الحالية)
      const oldest = batch[batch.length - 1];
      endDate = oldest.datetime;

      if (batch.length < MAX_PER_REQUEST) break; // وصلنا لأقدم بيانات متوفرة عند المصدر
      if (all.length >= MAX_PER_REQUEST * MAX_BATCHES) break;
    }

    // إزالة تكرار محتمل بسبب end_date المتداخل + الترتيب من الأقدم للأحدث
    const seen = new Set();
    const deduped = [];
    for (let i = all.length - 1; i >= 0; i--) {
      const row = all[i];
      if (seen.has(row.datetime)) continue;
      seen.add(row.datetime);
      deduped.push(row);
    }

    const candles = deduped.map(toChartCandle).slice(-wanted);

    return NextResponse.json({ candles });
  } catch (e) {
    return NextResponse.json({ error: e.message || "فشل جلب البيانات" }, { status: 502 });
  }
}
