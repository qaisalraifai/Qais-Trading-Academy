import { NextResponse } from "next/server";
import { jsonHandler } from "@/lib/api-guard";
import { requireUser } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { createAdminClient } from "@/lib/supabase-server";

/* ============================================================================
   POST /api/quiz/[id]/submit   { answers: { [questionId]: optionIndex } }

   ---------------------------------------------------------------------------
   🔴 **ليش انبنى هالمسار: التصحيح كان بالمتصفّح.**

   قبله، `app/(shell)/quiz/[id]/page.js` كانت تعمل `select("*")` على
   `quiz_questions` — **بما فيه `correct_option_index`** — وتمرّر الصفوف كما هي
   لـ`QuizForm` وهو **مكوّن عميل**. يعني:

     ١) الإجابات الصحيحة بتوصل المتصفّح مع كل اختبار. الطالب بيفتح أدوات
        المطوّر ويشوفهن قبل ما يجاوب.
     ٢) الدرجة بتتحسب بالمتصفّح وبتنكتب مباشرة بـ`quiz_attempts` — فحتى بلا
        قراءة المفاتيح، بيقدر يُدرج أي رقم.

   السبب الجذري واحد: التصحيح ما بيصير إلا وين الإجابات موجودة. فنقلناه هون.

   ---------------------------------------------------------------------------
   ⚠️ **الهوية من الجلسة مش من الطلب.** الإدراج القديم كان بياخد `studentId`
   من خاصية ممرَّرة للمكوّن — والمتصفّح بيقدر يبدّلها. هون `requireUser()` هي
   المصدر الوحيد.

   ⚠️ الإجابات بتنقرا بمفتاح الخدمة، فما بتمرق على RLS ولا بتوصل العميل أبداً.
   ============================================================================ */
async function POSTImpl(request, { params }) {
  const limited = checkRateLimit(request, "quiz");
  if (limited) return limited;

  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const quizId = params?.id;
  if (!quizId) return NextResponse.json({ error: "اختبار غير محدَّد" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const answers = body?.answers;
  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "إجابات ناقصة" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: questions, error } = await admin
    .from("quiz_questions")
    .select("id, correct_option_index")
    .eq("quiz_id", quizId);

  if (error) {
    console.error("quiz submit: فشل جلب الأسئلة:", error);
    return NextResponse.json({ error: "تعذّر تصحيح الاختبار", code: "QUIZ_LOAD_FAILED" }, { status: 500 });
  }
  if (!questions?.length) {
    return NextResponse.json({ error: "الاختبار ما إله أسئلة", code: "QUIZ_EMPTY" }, { status: 404 });
  }

  /* ⚠️ التصحيح على **أسئلة الخادم** مش على اللي بعتها العميل: سؤال مش من
     هالاختبار بينتجاهل، وسؤال ما جاوبه بينعدّ خطأ. فما بيقدر يزيد المجموع
     ولا يقلّل المقام. */
  let score = 0;
  for (const q of questions) {
    if (answers[q.id] === q.correct_option_index) score += 1;
  }

  const { error: insertError } = await admin.from("quiz_attempts").insert({
    student_id: user.id,
    quiz_id: quizId,
    score,
    total_questions: questions.length,
  });

  if (insertError) {
    console.error("quiz submit: فشل حفظ المحاولة:", insertError);
    return NextResponse.json({ error: "تعذّر حفظ النتيجة", code: "ATTEMPT_SAVE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ score, total: questions.length });
}

export const POST = jsonHandler(POSTImpl);
