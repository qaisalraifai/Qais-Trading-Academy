import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { isAllowedDocument, safeContentType, safeExtension, ALLOWED_DOCUMENT_LABEL } from "@/lib/upload-safety";
import { logActivity } from "@/lib/activity-log";

const BUCKET = "kyc-documents";

async function ensureBucket(supabaseAdmin) {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: "10MB" });
  }
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const supabaseAdmin = createAdminClient();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("kyc_status")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({ kycStatus: profile?.kyc_status || "none" });
}

export async function POST(request) {
  const limited = checkRateLimit(request, "upload");
  if (limited) return limited;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "لازم ترفعي صورة/ملف الهوية" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "حجم الملف أكبر من 10MB" }, { status: 400 });
  }
  /* ⚠️ الواجهة بتعلن `accept="image/*,.pdf"` (`MlmClient.js`) بس الخادم ما كان
     يفرضها — فطلب مباشر بأي صيغة كان بيمرق. هاد فرض خادمي لعقد قائم، مش
     تضييق جديد. */
  if (!isAllowedDocument(file.type)) {
    return NextResponse.json(
      { error: `صيغة غير مدعومة — لازم ${ALLOWED_DOCUMENT_LABEL}`, code: "UNSUPPORTED_FILE_TYPE" },
      { status: 400 }
    );
  }

  const supabaseAdmin = createAdminClient();
  await ensureBucket(supabaseAdmin);

  /* ⚠️ الامتداد بينشتق من النوع المتحقَّق مش من اسم الملف. كان
     `file.name.split(".").pop()` — اسم زي `x.html` بيتخزّن بامتداد `.html`. */
  const path = `${user.id}/${Date.now()}.${safeExtension(file.type, "jpg")}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(arrayBuffer), {
      contentType: safeContentType(file.type),
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: `فشل الرفع: ${uploadError.message}` }, { status: 500 });
  }

  await supabaseAdmin
    .from("profiles")
    .update({ kyc_document_url: path, kyc_status: "pending" })
    .eq("id", user.id);

  await logActivity(user.id, "note", "رفع مستند KYC — بانتظار مراجعة الأدمن", { path });

  return NextResponse.json({ success: true, status: "pending" });
}
