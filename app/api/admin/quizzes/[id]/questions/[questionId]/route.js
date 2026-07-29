import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// PATCH /api/admin/quizzes/[id]/questions/[questionId] — تعديل سؤال
export async function PATCH(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });

  const updateData = {};
  if (body.question_text !== undefined) {
    const question_text = body.question_text?.trim();
    if (!question_text) return NextResponse.json({ error: "لازم تكتبي نص السؤال" }, { status: 400 });
    updateData.question_text = question_text;
  }
  if (body.options !== undefined) {
    const options = Array.isArray(body.options) ? body.options.map((o) => (o || "").trim()).filter(Boolean) : [];
    if (options.length < 2) return NextResponse.json({ error: "لازم خيارين على الأقل" }, { status: 400 });
    updateData.options = options;
  }
  if (body.correct_option_index !== undefined) {
    updateData.correct_option_index = Number(body.correct_option_index);
  }

  const { data, error } = await supabase
    .from("quiz_questions")
    .update(updateData)
    .eq("id", params.questionId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ question: data });
}

// DELETE /api/admin/quizzes/[id]/questions/[questionId] — حذف سؤال
export async function DELETE(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("quiz_questions").delete().eq("id", params.questionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
