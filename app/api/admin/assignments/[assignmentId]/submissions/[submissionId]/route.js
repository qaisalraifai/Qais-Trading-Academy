import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { createNotification } from "@/lib/notifications";

// PATCH /api/admin/assignments/[assignmentId]/submissions/[submissionId] — تقييم تسليم الطالب
// body: { grade, feedback? }
export async function PATCH(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const body = await request.json().catch(() => null);
  const grade = body?.grade?.toString().trim();
  if (!grade) return NextResponse.json({ error: "لازم تحطي درجة أو تقييم" }, { status: 400 });

  const { data, error } = await supabase
    .from("assignment_submissions")
    .update({
      grade,
      feedback: body?.feedback?.trim() || null,
      graded_at: new Date().toISOString(),
      graded_by: auth.user.id,
    })
    .eq("id", params.submissionId)
    .eq("assignment_id", params.assignmentId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // إشعار الطالب إنه واجبه انقيّم (نفس نظام الإشعارات الموجود من المرحلة 9)
  const { data: assignment } = await supabase
    .from("batch_assignments")
    .select("title")
    .eq("id", params.assignmentId)
    .maybeSingle();

  await createNotification(supabase, data.user_id, {
    type: "assignment_graded",
    title: "تم تقييم واجبك",
    message: `واجب "${assignment?.title || ""}" — الدرجة: ${grade}`,
    link: null,
  });

  return NextResponse.json({ submission: data });
}
