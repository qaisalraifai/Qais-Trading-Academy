import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

// GET /api/notifications?limit=20 — آخر إشعارات المستخدم الحالي + عدد غير المقروء
export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit")) || 20, 50);

  const { data: items, error } = await admin
    .from("notifications")
    .select("id, type, title, message, link, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count: unreadCount } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  return NextResponse.json({ items: items || [], unreadCount: unreadCount || 0 });
}

// PATCH /api/notifications  { id }  -> يأشر إشعار واحد كمقروء
// PATCH /api/notifications  { all: true } -> يأشر كل الإشعارات كمقروءة
export async function PATCH(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();

  let query = admin.from("notifications").update({ read: true }).eq("user_id", user.id);
  query = body.all ? query.eq("read", false) : query.eq("id", body.id);

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
