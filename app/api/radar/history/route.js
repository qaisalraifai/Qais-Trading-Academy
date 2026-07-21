import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

// GET /api/radar/history?limit=30&symbol=XAUUSD — سجلّ الإشارات (بيانات سوق عامة)
export async function GET(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 30, 100);
  const symbol = url.searchParams.get("symbol");

  const admin = createAdminClient();
  let query = admin.from("qais_signal_history").select("*").order("entry_time", { ascending: false }).limit(limit);
  if (symbol) query = query.eq("symbol", symbol);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] });
}
