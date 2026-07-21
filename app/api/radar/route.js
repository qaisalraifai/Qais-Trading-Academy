import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { DEFAULT_RADAR_SYMBOLS } from "@/lib/qais/config";

// GET /api/radar — بيرجع حالة الرادار الحالية لكل الأصول اللي بمتابعة الطالب.
// أول زيارة للطالب: بننشئله قائمة متابعة افتراضية تلقائياً (DEFAULT_RADAR_SYMBOLS)
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();

  let { data: watchlist } = await admin.from("qais_watchlist").select("symbol").eq("user_id", user.id);

  if (!watchlist || watchlist.length === 0) {
    const rows = DEFAULT_RADAR_SYMBOLS.map((symbol) => ({ user_id: user.id, symbol }));
    await admin.from("qais_watchlist").insert(rows);
    watchlist = rows.map((r) => ({ symbol: r.symbol }));
  }

  const symbols = watchlist.map((w) => w.symbol);

  const { data: states, error } = await admin.from("qais_radar_state").select("*").in("symbol", symbols);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: favRows } = await admin.from("qais_favorites").select("symbol").eq("user_id", user.id);
  const favSet = new Set((favRows || []).map((f) => f.symbol));

  const bySymbol = Object.fromEntries((states || []).map((s) => [s.symbol, s]));

  // لو رمز بقائمة المتابعة لسا ما انحسب (أول مرة قبل ما يشتغل الكرون)، منرجعه بحالة "gray" مؤقتة
  const items = symbols.map((symbol) => ({
    ...(bySymbol[symbol] || {
      symbol,
      status: "gray",
      score: 0,
      radar_status: "gray",
      radar_score: 0,
      direction: null,
      price: null,
      timeframe: "M15",
      reason_tags: [],
      decision: null,
      updated_at: null,
      pending: true,
    }),
    favorite: favSet.has(symbol),
  }));

  return NextResponse.json({ items });
}
