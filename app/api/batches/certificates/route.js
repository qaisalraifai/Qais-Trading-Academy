import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { getStudentBatchId } from "@/lib/student-batch";
import { computeBatchProgress, ensureAutoCertificate } from "@/lib/certificates";

// GET /api/batches/certificates?course_id=... — شهادة دفعة الطالب لهاي الدورة (لو موجودة)
// ونسبة إكماله الحالية. لو وصل 100% ولسا ما عنده شهادة، بتصدرله وحدة تلقائيًا هون
// (أول مرة يفتح فيها هاي الصفحة بعد ما يخلّص).
export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");
  if (!courseId) return NextResponse.json({ error: "لازم تحددي الدورة" }, { status: 400 });

  const batchId = await getStudentBatchId(user.id, courseId);
  if (!batchId) return NextResponse.json({ certificate: null, progress: null });

  const admin = createAdminClient();

  const certificate = await ensureAutoCertificate(admin, batchId, user.id);
  const progress = await computeBatchProgress(admin, batchId, user.id);

  return NextResponse.json({ certificate, progress });
}
