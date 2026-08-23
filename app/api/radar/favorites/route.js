import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

// GET /api/radar/favorites — رموز المفضّلة للطالب الحالي
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("qais_favorites").select("symbol").eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ symbols: (data || []).map((r) => r.symbol) });
}

// POST /api/radar/favorites { symbol } — إضافة رمز للمفضّلة
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { symbol } = await request.json().catch(() => ({}));
  if (!symbol) return NextResponse.json({ error: "الرمز مطلوب" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("qais_favorites").upsert({ user_id: user.id, symbol }, { onConflict: "user_id,symbol" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE /api/radar/favorites { symbol } — إزالة رمز من المفضّلة
export async function DELETE(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { symbol } = await request.json().catch(() => ({}));
  if (!symbol) return NextResponse.json({ error: "الرمز مطلوب" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("qais_favorites").delete().eq("user_id", user.id).eq("symbol", symbol);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
