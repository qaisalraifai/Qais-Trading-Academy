import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { getStudentBatchId } from "@/lib/student-batch";

// GET /api/batches/for-course/[courseId]
// بيرجّع للطالب إما دفعته المحلولة لهاي الدورة (batch_id + batch_course_id)،
// أو (لو لسا ما اختار) قائمة الدفعات المتاحة عشان يختار منها.
// هاي نقطة الدخول الحقيقية لبوابة اختيار الدفعة — مستخدمة من app/courses/CoursesClient.js
// (الواجهة الفعلية اللي الطالب بيتصفح فيها المحاضرات).
export async function GET(_request, { params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "لازم تسجّلي دخول" }, { status: 401 });

  const courseId = params.courseId;
  const batchId = await getStudentBatchId(user.id, courseId);

  if (batchId) {
    const admin = createAdminClient();
    const { data: link } = await admin
      .from("batch_courses")
      .select("id")
      .eq("batch_id", batchId)
      .eq("course_id", courseId)
      .maybeSingle();
    return NextResponse.json({ needs_selection: false, batch_id: batchId, batch_course_id: link?.id || null });
  }

  const admin = createAdminClient();
  const { data: links } = await admin.from("batch_courses").select("batch_id").eq("course_id", courseId);
  const batchIds = [...new Set((links || []).map((l) => l.batch_id))];

  let batches = [];
  if (batchIds.length) {
    const { data: rawBatches } = await admin
      .from("batches")
      .select("*")
      .in("id", batchIds)
      .eq("is_archived", false)
      .eq("registration_status", "open")
      .order("start_date", { ascending: true });

    batches = await Promise.all(
      (rawBatches || []).map(async (b) => {
        const { count } = await admin
          .from("batch_enrollments")
          .select("id", { count: "exact", head: true })
          .eq("batch_id", b.id);
        const seatsTaken = count || 0;
        return {
          ...b,
          seats_remaining: b.seats_total == null ? null : Math.max(b.seats_total - seatsTaken, 0),
          is_full: b.seats_total != null && seatsTaken >= b.seats_total,
        };
      })
    );
  }

  return NextResponse.json({ needs_selection: true, batches });
}
