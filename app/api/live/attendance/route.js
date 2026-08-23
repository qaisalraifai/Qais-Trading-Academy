import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

// POST /api/live/attendance { session_id, event? } — الطالب يسجّل حضوره تلقائيًا لما
// ينضم فعليًا لغرفة البث (Jitsi)، وممكن يرسل event:"leave" لما يغادر عشان نحدّث آخر وقت شفناه فيه.
// المرحلة 8: هاد السجل هو اللي بلوحة التحكم بتبني عليه شاشة "الحضور" لكل دفعة ولكل بث.
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { session_id, event } = body;
  if (!session_id) {
    return NextResponse.json({ error: "لازم تحددي البث" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  // المدرب/الأدمن مضيف للبث مش طالب حاضر — ما نسجله بإحصائية الحضور
  if (profile?.role === "admin") {
    return NextResponse.json({ skipped: true });
  }

  const { data: session } = await admin
    .from("live_sessions")
    .select("id, batch_id")
    .eq("id", session_id)
    .maybeSingle();
  if (!session || !session.batch_id) {
    return NextResponse.json({ error: "البث غير موجود" }, { status: 404 });
  }

  // تأكيد إن الطالب فعليًا مسجّل بنفس الدفعة تبع هاد البث (حماية من تسجيل حضور وهمي)
  const { data: enrollment } = await admin
    .from("batch_enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("batch_id", session.batch_id)
    .maybeSingle();
  if (!enrollment) {
    return NextResponse.json({ error: "أنتِ مو مسجّلة بهاي الدفعة" }, { status: 403 });
  }

  const { data: existing } = await admin
    .from("live_attendance")
    .select("id, join_count")
    .eq("live_session_id", session_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const now = new Date().toISOString();

  if (!existing) {
    if (event === "leave") return NextResponse.json({ success: true }); // ما في شي نحدّثه
    const { error } = await admin.from("live_attendance").insert({
      live_session_id: session_id,
      batch_id: session.batch_id,
      user_id: user.id,
      first_joined_at: now,
      last_seen_at: now,
      join_count: 1,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const updateData = { last_seen_at: now };
  if (event !== "leave") updateData.join_count = (existing.join_count || 1) + 1;

  const { error } = await admin.from("live_attendance").update(updateData).eq("id", existing.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
