import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/batches/[id]/quizzes — كل اختبارات هاي الدفعة (حصرية + مشتركة لكورس الدفعة)
// نفس القاعدة الذهبية المستخدمة بالمحاضرات: batch_id فاضي = مشترك لكل دفعات الكورس.
export async function GET(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: batch } = await supabase.from("batches").select("id, course_id").eq("id", params.id).maybeSingle();
  if (!batch) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });

  const { data: quizzes, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("course_id", batch.course_id)
    .or(`batch_id.is.null,batch_id.eq.${params.id}`)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const quizIds = (quizzes || []).map((q) => q.id);
  let questionCounts = {};
  let attemptCounts = {};
  if (quizIds.length) {
    const [{ data: questions }, { data: attempts }] = await Promise.all([
      supabase.from("quiz_questions").select("quiz_id").in("quiz_id", quizIds),
      supabase.from("quiz_attempts").select("quiz_id").in("quiz_id", quizIds),
    ]);
    (questions || []).forEach((q) => { questionCounts[q.quiz_id] = (questionCounts[q.quiz_id] || 0) + 1; });
    (attempts || []).forEach((a) => { attemptCounts[a.quiz_id] = (attemptCounts[a.quiz_id] || 0) + 1; });
  }

  const withCounts = (quizzes || []).map((q) => ({
    ...q,
    question_count: questionCounts[q.id] || 0,
    attempt_count: attemptCounts[q.id] || 0,
  }));

  return NextResponse.json({ quizzes: withCounts });
}

// POST /api/admin/batches/[id]/quizzes — إنشاء اختبار جديد
// body: { title, chapter?, batch_id? }  — batch_id فاضي = مشترك لكل دفعات الكورس
export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: batch } = await supabase.from("batches").select("id, course_id").eq("id", params.id).maybeSingle();
  if (!batch) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const title = body?.title?.trim();
  if (!title) return NextResponse.json({ error: "لازم تكتبي عنوان الاختبار" }, { status: 400 });

  const { data, error } = await supabase
    .from("quizzes")
    .insert({
      title,
      course_id: batch.course_id,
      chapter: body?.chapter?.trim() || null,
      batch_id: body?.batch_id || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ quiz: { ...data, question_count: 0, attempt_count: 0 } });
}
