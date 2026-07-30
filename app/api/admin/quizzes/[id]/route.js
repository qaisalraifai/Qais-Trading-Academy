import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// PATCH /api/admin/quizzes/[id] — تعديل بيانات اختبار
export async function PATCH(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });

  const updateData = {};
  if (body.title !== undefined) {
    const title = body.title?.trim();
    if (!title) return NextResponse.json({ error: "لازم تكتبي عنوان الاختبار" }, { status: 400 });
    updateData.title = title;
  }
  if (body.chapter !== undefined) updateData.chapter = body.chapter?.trim() || null;
  if (body.scope !== undefined && body.batch_course_id !== undefined) {
    updateData.batch_course_id = body.scope === "exclusive" ? body.batch_course_id : null;
  }

  const { data, error } = await supabase.from("quizzes").update(updateData).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ quiz: data });
}

// DELETE /api/admin/quizzes/[id] — حذف اختبار كامل (أسئلته ومحاولات الطلاب فيه)
export async function DELETE(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  await supabase.from("quiz_attempts").delete().eq("quiz_id", params.id);
  await supabase.from("quiz_questions").delete().eq("quiz_id", params.id);
  const { error } = await supabase.from("quizzes").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
