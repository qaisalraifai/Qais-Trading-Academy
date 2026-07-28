import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// POST /api/admin/live { batch_id, title? } — يبدأ بث جديد لدفعة محددة
// (المرحلة 7: كل بث مرتبط بدفعة، وما بيأثر على بثوث الدفعات الثانية إطلاقًا)
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const { batch_id } = body;

  if (!batch_id) {
    return NextResponse.json({ error: "لازم تحددي الدفعة اللي رح يبدأ فيها البث" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("id, name, course_id, is_archived")
    .eq("id", batch_id)
    .maybeSingle();

  if (!batch) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });
  if (batch.is_archived) {
    return NextResponse.json({ error: "هاي دفعة مؤرشفة — ما فيك تبدئي فيها بث" }, { status: 400 });
  }

  const { data: course } = await supabase
    .from("courses")
    .select("title")
    .eq("id", batch.course_id)
    .maybeSingle();

  const title = body?.title?.trim() || `بث مباشر — ${course?.title || "Qais Trading Academy"} (${batch.name})`;

  // اقفلي أي بث نشط قديم بنفس الدفعة بس (احتياط لو نسيت تقفليه المرة الماضية)
  // بثوث الدفعات الثانية ما بتتأثر إطلاقًا
  await supabase
    .from("live_sessions")
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq("batch_id", batch_id)
    .eq("is_active", true);

  const roomName = `qta-live-${batch_id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { data, error } = await supabase
    .from("live_sessions")
    .insert({
      room_name: roomName,
      title,
      is_active: true,
      started_by: auth.user.id,
      batch_id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: { ...data, batch_name: batch.name, course_title: course?.title || null } });
}

// DELETE /api/admin/live?batch_id=... — ينهي البث النشط هلأ لهاي الدفعة بس
export async function DELETE(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batch_id");

  if (!batchId) {
    return NextResponse.json({ error: "لازم تحددي الدفعة اللي بدك تنهي بثها" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("live_sessions")
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq("batch_id", batchId)
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
