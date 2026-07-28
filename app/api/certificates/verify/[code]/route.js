import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/certificates/verify/[code] — تحقق عام من صحة شهادة (بدون تسجيل دخول)،
// بيرجّع بس معلومات آمنة للعرض العام: اسم الطالب، الدورة، الدفعة، وتاريخ الإصدار.
export async function GET(_request, { params }) {
  const admin = createAdminClient();

  const { data: cert } = await admin
    .from("batch_certificates")
    .select("id, certificate_code, issued_at, batch_id, user_id")
    .eq("certificate_code", params.code)
    .maybeSingle();

  if (!cert) return NextResponse.json({ valid: false }, { status: 404 });

  const { data: batch } = await admin
    .from("batches")
    .select("name, course_id")
    .eq("id", cert.batch_id)
    .maybeSingle();

  const { data: course } = batch
    ? await admin.from("courses").select("title, icon").eq("id", batch.course_id).maybeSingle()
    : { data: null };

  const { data: profile } = await admin
    .from("profiles")
    .select("username")
    .eq("id", cert.user_id)
    .maybeSingle();

  return NextResponse.json({
    valid: true,
    certificate_code: cert.certificate_code,
    issued_at: cert.issued_at,
    student_name: profile?.username || "طالب",
    batch_name: batch?.name || "—",
    course_title: course?.title || "—",
    course_icon: course?.icon || "🎓",
  });
}
