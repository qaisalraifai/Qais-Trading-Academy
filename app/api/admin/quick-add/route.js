import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { type, payload = {} } = await request.json();
  const supabase = createAdminClient();

  if (type === "add_user") {
    const { username, password, plan = "member" } = payload;
    if (!username || !password) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

    const fakeEmail = `${username.trim().toLowerCase()}@eduplatform.com`;
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: fakeEmail,
      password,
      email_confirm: true,
    });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    const { error: profileError } = await supabase.from("profiles").insert({
      id: authUser.user.id,
      username: username.trim(),
      role: "student",
      plan,
    });
    if (profileError) {
      await supabase.auth.admin.deleteUser(authUser.user.id).catch(() => {});
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    await logActivity(authUser.user.id, "note", "تمت إضافة الحساب يدوياً من لوحة التحكم");
    return NextResponse.json({ success: true, userId: authUser.user.id });
  }

  if (type === "broadcast_notification") {
    const { title, message } = payload;
    if (!title || !message) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    const { error } = await supabase.from("notifications").insert({ user_id: null, title, message });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "نوع غير معروف" }, { status: 400 });
}
