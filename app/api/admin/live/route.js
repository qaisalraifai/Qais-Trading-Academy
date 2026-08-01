import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { ensureRoomExists, getRoomServiceClient, getEgressClient } from "@/lib/livekit-server";

// POST /api/admin/live { batch_id, title?, description? } — يبدأ بث LiveKit لدفعة معيّنة
// (ما بيأثر ولا بيلغي بثوث دفعات ثانية — الفريدة (unique) محفوظة بقاعدة البيانات لكل دفعة)
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const batchId = body?.batch_id;
  if (!batchId) return NextResponse.json({ error: "لازم تحددي الدفعة" }, { status: 400 });

  const title = (body?.title || "بث مباشر — Qais Trading Academy").trim();
  const description = body?.description?.trim() || null;

  const supabase = createAdminClient();

  const { data: batch } = await supabase.from("batches").select("id, name").eq("id", batchId).maybeSingle();
  if (!batch) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });

  const { data: already } = await supabase
    .from("live_sessions")
    .select("id")
    .eq("batch_id", batchId)
    .eq("is_active", true)
    .maybeSingle();
  if (already) return NextResponse.json({ error: "في بث نشط أصلاً لهاي الدفعة" }, { status: 400 });

  const roomName = `qta-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    await ensureRoomExists(roomName);
  } catch (e) {
    return NextResponse.json({ error: `تعذّر إنشاء غرفة البث: ${e.message}` }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("live_sessions")
    .insert({
      room_name: roomName,
      title: title || `بث مباشر — ${batch.name}`,
      description,
      batch_id: batchId,
      is_active: true,
      provider: "livekit",
      started_by: auth.user.id,
    })
    .select("*")
    .single();

  if (error) {
    // الفهرس الفريد (بث نشط وحد لكل دفعة) — احتياط لو صار تسابق بنفس اللحظة
    if (error.code === "23505") {
      return NextResponse.json({ error: "في بث نشط أصلاً لهاي الدفعة" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ session: data });
}

// DELETE /api/admin/live?batch_id=... — ينهي البث النشط هلأ لهاي الدفعة تحديدًا
export async function DELETE(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batch_id");
  if (!batchId) return NextResponse.json({ error: "لازم تحددي الدفعة" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: active } = await supabase
    .from("live_sessions")
    .select("id, room_name, egress_id")
    .eq("batch_id", batchId)
    .eq("is_active", true)
    .maybeSingle();

  if (!active) return NextResponse.json({ error: "ما في بث نشط لهاي الدفعة" }, { status: 404 });

  const svc = getRoomServiceClient();
  if (active.egress_id) {
    const egress = getEgressClient();
    await egress.stopEgress(active.egress_id).catch(() => {});
  }
  await svc.deleteRoom(active.room_name).catch(() => {});

  const { error } = await supabase
    .from("live_sessions")
    .update({ is_active: false, ended_at: new Date().toISOString(), ended_by: auth.user.id })
    .eq("id", active.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
