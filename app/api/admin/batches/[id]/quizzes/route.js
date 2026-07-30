import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/batches/[id]/quizzes?batch_course_id=... — اختبارات دورة معينة
// جوا هاي الدفعة (حصرية لهاي الدفعة + مشتركة لكل دفعات نفس الدورة).
// batch_course_id مطلوب هلأ (بما إن الدفعة صارت تحتوي أكتر من دورة).
export async function GET(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const batchCourseId = new URL(request.url).searchParams.get("batch_course_id");
  if (!batchCourseId) return NextResponse.json({ error: "لازم تحددي الدورة" }, { status: 400 });

  const { data: link } = await supabase.from("batch_courses").select("id, course_id").eq("id", batchCourseId).eq("batch_id", params.id).maybeSingle();
  if (!link) return NextResponse.json({ error: "الدورة غير مرتبطة بهاي الدفعة" }, { status: 404 });

  const { data: quizzes, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("course_id", link.course_id)
    .or(`batch_course_id.is.null,batch_course_id.eq.${batchCourseId}`)
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
// body: { title, chapter?, batch_course_id (مطلوب — أي دورة جوا الدفعة), scope: 'shared'|'exclusive' }
export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const body = await request.json().catch(() => null);

  const title = body?.title?.trim();
  if (!title) return NextResponse.json({ error: "لازم تكتبي عنوان الاختبار" }, { status: 400 });
  if (!body?.batch_course_id) return NextResponse.json({ error: "لازم تحددي الدورة" }, { status: 400 });

  const { data: link } = await supabase.from("batch_courses").select("id, course_id").eq("id", body.batch_course_id).eq("batch_id", params.id).maybeSingle();
  if (!link) return NextResponse.json({ error: "الدورة غير مرتبطة بهاي الدفعة" }, { status: 404 });

  const { data, error } = await supabase
    .from("quizzes")
    .insert({
      title,
      course_id: link.course_id,
      chapter: body?.chapter?.trim() || null,
      batch_course_id: body?.scope === "exclusive" ? link.id : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ quiz: { ...data, question_count: 0, attempt_count: 0 } });
}
