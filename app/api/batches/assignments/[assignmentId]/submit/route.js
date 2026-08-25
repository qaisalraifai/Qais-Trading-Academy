import { NextResponse } from "next/server";
import { safeContentType } from "@/lib/upload-safety";
import { createClient, createAdminClient } from "@/lib/supabase-server";

const BUCKET = "assignment-submissions";
const MAX_SIZE = 25 * 1024 * 1024; // 25MB

async function ensureBucket(supabaseAdmin) {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: "25MB" });
  }
}

// POST /api/batches/assignments/[assignmentId]/submit — تسليم (أو إعادة تسليم) واجب
// multipart/form-data: file? (اختياري), note? (اختياري) — لازم واحد منهم عالأقل
// إعادة التسليم بتصفّر الدرجة والتقييم القديم لأنه صار تسليم جديد يحتاج تقييم من جديد
export async function POST(request, { params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();

  const { data: assignment } = await admin
    .from("batch_assignments")
    .select("id, batch_id")
    .eq("id", params.assignmentId)
    .maybeSingle();
  if (!assignment) return NextResponse.json({ error: "الواجب غير موجود" }, { status: 404 });

  // تأكيد إن الطالب فعلًا مسجّل بنفس الدفعة صاحبة الواجب
  const { data: enrollment } = await admin
    .from("batch_enrollments")
    .select("id")
    .eq("batch_id", assignment.batch_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!enrollment) return NextResponse.json({ error: "غير مسموح" }, { status: 403 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const note = formData?.get("note")?.toString().trim() || null;
  const hasFile = file && typeof file !== "string";

  if (!hasFile && !note) {
    return NextResponse.json({ error: "لازم ترفعي ملف أو تكتبي ملاحظة عالأقل" }, { status: 400 });
  }

  let filePath = null;
  let fileName = null;

  if (hasFile) {
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "حجم الملف أكبر من 25MB" }, { status: 400 });
    }
    await ensureBucket(admin);

    const safeName = file.name?.replace(/[^\w.\-\u0600-\u06FF ]/g, "_") || "ملف";
    filePath = `${params.assignmentId}/${user.id}/${Date.now()}-${safeName}`;
    fileName = file.name || safeName;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      /* ⚠️ نوع المحتوى ما بينؤخذ من العميل — `file.type` قيمة بيبعتها هو.
         `safeContentType` بترجّع النوع بس لو كان آمناً للعرض، وإلا
         `application/octet-stream` فبينزّل بدل ما ينفّذ. ولا تضييق على الصيغ
         هون: الواجهة بلا `accept` يعني مفتوحة بالتصميم. */
      .upload(filePath, Buffer.from(arrayBuffer), {
        contentType: safeContentType(file.type),
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: `فشل رفع الملف: ${uploadError.message}` }, { status: 500 });
    }
  }

  const { data, error } = await admin
    .from("assignment_submissions")
    .upsert(
      {
        assignment_id: params.assignmentId,
        user_id: user.id,
        file_path: filePath,
        file_name: fileName,
        note,
        submitted_at: new Date().toISOString(),
        // تسليم جديد = يحتاج تقييم من جديد
        grade: null,
        feedback: null,
        graded_at: null,
        graded_by: null,
      },
      { onConflict: "assignment_id,user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ submission: data });
}
