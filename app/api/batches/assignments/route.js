import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { getStudentBatchId } from "@/lib/student-batch";

// GET /api/batches/assignments?course_id=... — واجبات دفعة الطالب المسجّل فيها لهاي
// الدورة بس، مع حالة تسليمه (لو سلّم) ودرجته (لو انقيّم)
// (نفس منطق فلترة المحتوى بالمرحلة 6: كل طالب يشوف بس واجبات دفعته)
export async function GET(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");
  if (!courseId) return NextResponse.json({ error: "لازم تحددي الدورة" }, { status: 400 });

  const batchId = await getStudentBatchId(user.id, courseId);
  if (!batchId) return NextResponse.json({ assignments: [] });

  const admin = createAdminClient();
  const { data: assignments, error } = await admin
    .from("batch_assignments")
    .select("id, title, description, due_date, created_at")
    .eq("batch_id", batchId)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const assignmentIds = (assignments || []).map((a) => a.id);
  let mySubs = {};
  if (assignmentIds.length) {
    const { data: subs } = await admin
      .from("assignment_submissions")
      .select("assignment_id, file_name, note, submitted_at, grade, feedback")
      .eq("user_id", user.id)
      .in("assignment_id", assignmentIds);
    (subs || []).forEach((s) => {
      mySubs[s.assignment_id] = s;
    });
  }

  const withStatus = (assignments || []).map((a) => ({
    ...a,
    my_submission: mySubs[a.id] || null,
  }));

  return NextResponse.json({ assignments: withStatus });
}
