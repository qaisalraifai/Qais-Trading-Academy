import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/quizzes/[id]/questions — كل أسئلة اختبار وحدة، مرتبة
export async function GET(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { data: questions, error } = await supabase
    .from("quiz_questions")
    .select("*")
    .eq("quiz_id", params.id)
    .order("order_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ questions: questions || [] });
}

// POST /api/admin/quizzes/[id]/questions — إضافة سؤال جديد
// body: { question_text, options: string[], correct_option_index }
export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const body = await request.json().catch(() => null);

  const question_text = body?.question_text?.trim();
  const options = Array.isArray(body?.options) ? body.options.map((o) => (o || "").trim()).filter(Boolean) : [];
  const correct_option_index = Number(body?.correct_option_index);

  if (!question_text) return NextResponse.json({ error: "لازم تكتبي نص السؤال" }, { status: 400 });
  if (options.length < 2) return NextResponse.json({ error: "لازم خيارين على الأقل" }, { status: 400 });
  if (!Number.isInteger(correct_option_index) || correct_option_index < 0 || correct_option_index >= options.length) {
    return NextResponse.json({ error: "لازم تحددي الإجابة الصحيحة من ضمن الخيارات" }, { status: 400 });
  }

  const { count } = await supabase
    .from("quiz_questions")
    .select("id", { count: "exact", head: true })
    .eq("quiz_id", params.id);

  const { data, error } = await supabase
    .from("quiz_questions")
    .insert({
      quiz_id: params.id,
      question_text,
      options,
      correct_option_index,
      order_index: count || 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ question: data });
}
