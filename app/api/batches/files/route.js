import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { getStudentBatchId } from "@/lib/student-batch";

const BUCKET = "batch-files";

// GET /api/batches/files?course_id=... — ملفات دفعة الطالب المسجّل فيها لهاي الدورة بس
// (نفس منطق فلترة المحتوى بالمرحلة 6: كل طالب يشوف بس ملفات دفعته)
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
  if (!batchId) return NextResponse.json({ files: [] });

  const admin = createAdminClient();
  const { data: files, error } = await admin
    .from("batch_files")
    .select("id, file_name, file_type, file_size, created_at, file_path")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const withUrls = await Promise.all(
    (files || []).map(async (f) => {
      const { data } = await admin.storage.from(BUCKET).createSignedUrl(f.file_path, 60 * 60);
      const { file_path, ...rest } = f;
      return { ...rest, download_url: data?.signedUrl || null };
    })
  );

  return NextResponse.json({ files: withUrls });
}
