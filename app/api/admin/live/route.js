import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// POST /api/admin/live { title } — يبدأ بث جديد (وينهي أي بث سابق نشط أول)
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const title = body?.title || "بث مباشر — Qais Trading Academy";

  const supabase = createAdminClient();

  // اقفلي أي بث نشط قديم (احتياط لو نسيت تقفليه المرة الماضية)
  await supabase
    .from("live_sessions")
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq("is_active", true);

  const roomName = `qta-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { data, error } = await supabase
    .from("live_sessions")
    .insert({
      room_name: roomName,
      title,
      is_active: true,
      started_by: auth.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}

// DELETE /api/admin/live — ينهي البث النشط هلأ
export async function DELETE() {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("live_sessions")
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
