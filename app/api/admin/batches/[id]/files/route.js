import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { safeContentType } from "@/lib/upload-safety";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

const BUCKET = "batch-files";
const MAX_SIZE = 25 * 1024 * 1024; // 25MB

async function ensureBucket(supabaseAdmin) {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: "25MB" });
  }
}

// GET /api/admin/batches/[id]/files — كل ملفات هاي الدفعة مع رابط تحميل مؤقت لكل وحدة
export async function GET(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: files, error } = await supabase
    .from("batch_files")
    .select("*")
    .eq("batch_id", params.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // إثراء كل ملف باسم الدورة اللي مرتبط فيها (لو محدد) — عبر batch_course_id
  const batchCourseIds = [...new Set((files || []).map((f) => f.batch_course_id).filter(Boolean))];
  let batchCourseMap = {};
  if (batchCourseIds.length) {
    const { data: links } = await supabase.from("batch_courses").select("id, course_id").in("id", batchCourseIds);
    const courseIds = [...new Set((links || []).map((l) => l.course_id))];
    const { data: courses } = await supabase.from("courses").select("id, title, icon").in("id", courseIds);
    const coursesMap = (courses || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {});
    batchCourseMap = (links || []).reduce((acc, l) => ({ ...acc, [l.id]: coursesMap[l.course_id] || null }), {});
  }

  const withUrls = await Promise.all(
    (files || []).map(async (f) => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(f.file_path, 60 * 60); // ساعة
      return { ...f, download_url: data?.signedUrl || null, course: f.batch_course_id ? batchCourseMap[f.batch_course_id] || null : null };
    })
  );

  return NextResponse.json({ files: withUrls });
}

// POST /api/admin/batches/[id]/files — رفع ملف جديد لمكتبة هاي الدفعة (multipart/form-data: file)
export async function POST(request, { params }) {
  const limited = checkRateLimit(request, "upload");
  if (limited) return limited;

  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: batch } = await supabase.from("batches").select("id").eq("id", params.id).maybeSingle();
  if (!batch) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const batch_course_id = formData?.get("batch_course_id") || null;
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "لازم تختاري ملف" }, { status: 400 });
  }
  if (batch_course_id) {
    const { data: link } = await supabase.from("batch_courses").select("id").eq("id", batch_course_id).eq("batch_id", params.id).maybeSingle();
    if (!link) return NextResponse.json({ error: "الدورة غير مرتبطة بهاي الدفعة" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "حجم الملف أكبر من 25MB" }, { status: 400 });
  }

  await ensureBucket(supabase);

  const safeName = file.name?.replace(/[^\w.\-\u0600-\u06FF ]/g, "_") || "ملف";
  const path = `${params.id}/${Date.now()}-${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    /* ⚠️ نوع المحتوى ما بينؤخذ من العميل — `file.type` قيمة بيبعتها هو.
       `safeContentType` بترجّع النوع بس لو كان آمناً للعرض، وإلا
       `application/octet-stream` فبينزّل بدل ما ينفّذ. ولا تضييق على الصيغ
       هون: الواجهة بلا `accept` يعني مفتوحة بالتصميم. */
    .upload(path, Buffer.from(arrayBuffer), {
      contentType: safeContentType(file.type),
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: `فشل رفع الملف: ${uploadError.message}` }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("batch_files")
    .insert({
      batch_id: params.id,
      batch_course_id: batch_course_id || null,
      uploaded_by: auth.user.id,
      file_name: file.name || safeName,
      file_path: path,
      file_type: file.type || null,
      file_size: file.size || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let course = null;
  if (data.batch_course_id) {
    const { data: link } = await supabase.from("batch_courses").select("course_id").eq("id", data.batch_course_id).maybeSingle();
    if (link?.course_id) {
      const { data: c } = await supabase.from("courses").select("id, title, icon").eq("id", link.course_id).maybeSingle();
      course = c || null;
    }
  }

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return NextResponse.json({ file: { ...data, download_url: signed?.signedUrl || null, course } });
}
