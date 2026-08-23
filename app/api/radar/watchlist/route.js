import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { ASSETS } from "@/lib/assets";

const SUPPORTED_SYMBOLS = new Set(ASSETS.flatMap((g) => g.items.map((i) => i.v)));

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("qais_watchlist").select("symbol").eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ symbols: (data || []).map((r) => r.symbol) });
}

// POST { symbol } — يضيف رمز لقائمة المتابعة
export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { symbol } = await request.json().catch(() => ({}));
  if (!symbol || !SUPPORTED_SYMBOLS.has(symbol)) {
    return NextResponse.json({ error: "رمز غير مدعوم" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("qais_watchlist").upsert({ user_id: user.id, symbol }, { onConflict: "user_id,symbol" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE { symbol } — يشيل رمز من قائمة المتابعة
export async function DELETE(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { symbol } = await request.json().catch(() => ({}));
  if (!symbol) return NextResponse.json({ error: "الرجاء تحديد الرمز" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("qais_watchlist").delete().eq("user_id", user.id).eq("symbol", symbol);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
