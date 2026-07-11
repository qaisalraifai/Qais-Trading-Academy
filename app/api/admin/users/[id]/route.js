import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";

export async function GET(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();
  const { id } = params;

  const [{ data: profile, error }, { data: payments }, { data: activity }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("payments").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("activity_log").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
  ]);

  if (error || !profile) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });

  return NextResponse.json({ profile, payments: payments || [], activity: activity || [] });
}

// تعديل بيانات المستخدم (Edit من الـ Drawer)
export async function PATCH(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = params;
  const body = await request.json();

  const allowed = ["username", "email", "phone", "country", "plan", "auto_renew", "role"];
  const updateData = {};
  for (const key of allowed) {
    if (key in body) updateData[key] = body[key];
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "لا يوجد شي للتعديل" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").update(updateData).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity(id, "note", "تعديل بيانات الحساب من لوحة التحكم", { fields: Object.keys(updateData) });

  return NextResponse.json({ success: true });
}

// حذف المستخدم بالكامل (Auth + profile عبر cascade)
export async function DELETE(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = params;
  const supabase = createAdminClient();

  await logActivity(id, "deleted", "تم حذف الحساب من لوحة التحكم");
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
