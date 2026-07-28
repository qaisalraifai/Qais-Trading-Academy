import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

// GET /api/live — يرجّع بس بثوث الدفعات اللي المستخدم فيها فعليًا
// (المرحلة 7: ما في بث عام واحد للمنصة، كل بث تابع لدفعة، وكل طالب يشوف بث دفعته بس)
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.role === "admin";

  let query = admin
    .from("live_sessions")
    .select("id, room_name, title, started_at, batch_id")
    .eq("is_active", true)
    .order("started_at", { ascending: false });

  if (!isAdmin) {
    // بدفعات الطالب المسجّل فيها بس — عن طريق batch_enrollments
    const { data: enrollments } = await admin
      .from("batch_enrollments")
      .select("batch_id")
      .eq("user_id", user.id);

    const batchIds = (enrollments || []).map((e) => e.batch_id);
    if (batchIds.length === 0) return NextResponse.json({ sessions: [] });

    query = query.in("batch_id", batchIds);
  }

  const { data: sessions, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!sessions || sessions.length === 0) return NextResponse.json({ sessions: [] });

  // نجيب اسم الدفعة والدورة عشان نعرضهم بوضوح لو الطالب/الأدمن عندهم أكثر من بث نشط بنفس الوقت
  const batchIds = [...new Set(sessions.map((s) => s.batch_id).filter(Boolean))];
  const { data: batches } = await admin
    .from("batches")
    .select("id, name, course_id")
    .in("id", batchIds);

  const courseIds = [...new Set((batches || []).map((b) => b.course_id).filter(Boolean))];
  const { data: courses } = await admin.from("courses").select("id, title, icon").in("id", courseIds);

  const batchMap = Object.fromEntries((batches || []).map((b) => [b.id, b]));
  const courseMap = Object.fromEntries((courses || []).map((c) => [c.id, c]));

  const enriched = sessions.map((s) => {
    const batch = batchMap[s.batch_id];
    const course = batch ? courseMap[batch.course_id] : null;
    return {
      ...s,
      batch_name: batch?.name || null,
      course_title: course?.title || null,
      course_icon: course?.icon || null,
    };
  });

  return NextResponse.json({ sessions: enriched });
}
