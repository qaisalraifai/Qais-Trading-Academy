import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";

// POST /api/admin/batches/transfer { user_id, to_batch_id }
// ينقل طالب من دفعته الحالية لدفعة ثانية بنفس الدورة.
// قرار إداري بحت — ما فيه أي مسار يسمح للطالب يبدّل حاله بنفسه.
// تقدمه (lecture_progress / student_progress) ما بينلمس إطلاقًا: بيضل محفوظ
// زي ما هو، وبس الدفعة اللي هو مسجّل فيها من هلأ وطالع بتتغيّر.
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const { user_id, to_batch_id } = body;

  if (!user_id || !to_batch_id) {
    return NextResponse.json({ error: "لازم تحددي الطالب والدفعة الجديدة" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: toBatch } = await supabase.from("batches").select("*").eq("id", to_batch_id).maybeSingle();
  if (!toBatch) return NextResponse.json({ error: "الدفعة الجديدة غير موجودة" }, { status: 404 });
  if (toBatch.is_archived) {
    return NextResponse.json({ error: "ما فيك تنقلي طالب لدفعة مؤرشفة" }, { status: 400 });
  }

  // دفعة الطالب الحالية بنفس الدورة (إذا موجودة)
  const { data: currentEnrollment } = await supabase
    .from("batch_enrollments")
    .select("*")
    .eq("user_id", user_id)
    .eq("course_id", toBatch.course_id)
    .maybeSingle();

  if (currentEnrollment && currentEnrollment.batch_id === to_batch_id) {
    return NextResponse.json({ error: "الطالب أصلاً مسجّل بهاي الدفعة" }, { status: 400 });
  }

  // فحص المقاعد المتاحة بالدفعة الجديدة
  if (toBatch.seats_total != null) {
    const { count } = await supabase
      .from("batch_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", to_batch_id);
    if (count != null && count >= toBatch.seats_total) {
      return NextResponse.json({ error: "الدفعة الجديدة ماعدش فيها مقاعد متاحة" }, { status: 400 });
    }
  }

  let error;
  if (currentEnrollment) {
    ({ error } = await supabase
      .from("batch_enrollments")
      .update({ batch_id: to_batch_id }) // course_id بينسمزن تلقائيًا بالـ trigger
      .eq("id", currentEnrollment.id));
  } else {
    ({ error } = await supabase.from("batch_enrollments").insert({
      user_id,
      batch_id: to_batch_id,
      course_id: toBatch.course_id,
    }));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // سجل تدقيق للنقلة نفسها (تاريخ كامل لكل نقلات الطالب)
  await supabase.from("batch_transfers").insert({
    user_id,
    course_id: toBatch.course_id,
    from_batch_id: currentEnrollment?.batch_id || null,
    to_batch_id,
    transferred_by: auth.user.id,
  });

  await logActivity(
    user_id,
    "note",
    `تم نقل الطالب لدفعة "${toBatch.name}"`,
    { from_batch_id: currentEnrollment?.batch_id || null, to_batch_id }
  );

  return NextResponse.json({ success: true });
}
