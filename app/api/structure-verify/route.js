import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { getAssetByValue } from "@/lib/assets";
import { RADAR_TIMEFRAMES } from "@/lib/qais/config";
import { verifyStructure } from "@/lib/qais/structure/verify/index.js";
import { renderReport } from "@/lib/qais/structure/verify/render.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/* ============================================================================
   GET /api/structure-verify
     ?symbol=NAS100&tf=h4,daily&count=3000&replay=800&window=20&format=text

   Historical Verification Harness — المرحلة ٢.
   بيشغّل Structure Engine v2 على بيانات حقيقية شمعة-بشمعة، وبيقارن مخرجاته
   بسياق qais_ai_trades، وبيطلّع تقرير رقمي.

   مصدر البيانات: نفس /api/replay-candles حرفياً (Dukascopy → TwelveData →
   Yahoo). ما بنبني مصدر جديد ولا منكرّر منطق التراجع — منستدعي نفس الراوت
   بنفس المعاملات، فأي تغيير عليه بينعكس هون تلقائياً.
============================================================================ */

async function fetchCandles(origin, asset, interval, count, cookie) {
  const params = new URLSearchParams({
    symbol: asset.yahoo,
    interval,
    count: String(count),
  });
  if (asset.dukascopy) params.set("duk", asset.dukascopy);
  if (asset.twelveData) params.set("td", asset.twelveData);

  const res = await fetch(`${origin}/api/replay-candles?${params}`, {
    headers: cookie ? { cookie } : {},
    cache: "no-store",
  });
  if (!res.ok) return { candles: [], error: `HTTP ${res.status}` };
  const json = await res.json();
  return { candles: json.candles || [], provider: json.provider ?? null, error: json.error ?? null };
}

export async function GET(req) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { searchParams, origin } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "NAS100";
  const tfList = (searchParams.get("tf") || "h4").split(",").map((s) => s.trim()).filter(Boolean);
  const count = Math.min(Number(searchParams.get("count") || 3000), 20000);
  const replayCandles = Math.min(Number(searchParams.get("replay") || 800), 3000);
  const windowCandles = Math.max(1, Number(searchParams.get("window") || 20));
  const format = searchParams.get("format") || "text";

  const asset = getAssetByValue(symbol);
  if (!asset?.yahoo) {
    return NextResponse.json({ error: `رمز غير معروف: ${symbol}` }, { status: 400 });
  }

  const unknownTFs = tfList.filter((tf) => !RADAR_TIMEFRAMES[tf]);
  if (unknownTFs.length) {
    return NextResponse.json(
      { error: `فريمات غير معروفة: ${unknownTFs.join(", ")} — المتاح: ${Object.keys(RADAR_TIMEFRAMES).join(", ")}` },
      { status: 400 }
    );
  }

  // -------- الشموع الحقيقية --------
  const cookie = req.headers.get("cookie") || "";
  const candlesByTF = {};
  const providers = {};
  const fetchErrors = {};

  for (const tf of tfList) {
    const { candles, provider, error } = await fetchCandles(origin, asset, RADAR_TIMEFRAMES[tf], count, cookie);
    candlesByTF[tf] = candles;
    providers[tf] = provider;
    if (error) fetchErrors[tf] = error;
  }

  const totalCandles = Object.values(candlesByTF).reduce((n, c) => n + c.length, 0);
  if (totalCandles === 0) {
    return NextResponse.json(
      { error: "ما وصلت ولا شمعة من أي مزوّد", fetchErrors, providers },
      { status: 502 }
    );
  }

  // -------- سياق الصفقات التاريخية --------
  const admin = createAdminClient();
  const { data: trades, error: tradesError } = await admin
    .from("qais_ai_trades")
    .select("id, symbol, direction, timeframe, entry, stop_loss, status, created_at, ai_analysis")
    .eq("symbol", symbol)
    .order("created_at", { ascending: true });

  // -------- التحقق --------
  const report = verifyStructure({
    symbol,
    candlesByTF,
    trades: trades || [],
    matchOptions: { windowCandles },
    replayOptions: { maxCandles: replayCandles },
  });

  report.dataSources = { providers, fetchErrors, requestedCount: count };
  if (tradesError) report.dataSources.tradesError = tradesError.message;

  if (format === "json") return NextResponse.json(report);

  const text = renderReport(report);
  const prefix =
    Object.keys(fetchErrors).length || tradesError
      ? `⚠️  مشاكل جلب: ${JSON.stringify({ ...fetchErrors, trades: tradesError?.message })}\n\n`
      : "";

  return new NextResponse(prefix + text, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
