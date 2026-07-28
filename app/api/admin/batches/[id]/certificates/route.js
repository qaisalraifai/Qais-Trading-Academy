import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { computeBatchProgress, generateCertificateCode } from "@/lib/certificates";

// GET /api/admin/batches/[id]/certificates — كل طلاب الدفعة مع نسبة إكمالهم
// وحالة شهادتهم (صادرة أو لسا)، بدون أي تصدير تلقائي هون (قراءة بس)
export async function GET(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: batch } = await supabase.from("batches").select("id").eq("id", params.id).maybeSingle();
  if (!batch) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });

  const { data: enrollments, error } = await supabase
    .from("batch_enrollments")
    .select("user_id, enrolled_at")
    .eq("batch_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = (enrollments || []).map((e) => e.user_id);
  let profilesMap = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, username, email").in("id", userIds);
    profilesMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
  }

  const { data: certs } = await supabase
    .from("batch_certificates")
    .select("*")
    .eq("batch_id", params.id);
  const certsMap = (certs || []).reduce((acc, c) => ({ ...acc, [c.user_id]: c }), {});

  const students = await Promise.all(
    (enrollments || []).map(async (e) => {
      const progress = await computeBatchProgress(supabase, params.id, e.user_id);
      return {
        user_id: e.user_id,
        username: profilesMap[e.user_id]?.username || "—",
        email: profilesMap[e.user_id]?.email || "—",
        enrolled_at: e.enrolled_at,
        progress,
        certificate: certsMap[e.user_id] || null,
      };
    })
  );

  return NextResponse.json({ students });
}

// POST /api/admin/batches/[id]/certificates — إصدار شهادة يدويًا لطالب معيّن
// body: { user_id } — يشتغل بغض النظر عن نسبة إكماله (قرار الأدمن)
export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: batch } = await supabase.from("batches").select("id").eq("id", params.id).maybeSingle();
  if (!batch) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const userId = body?.user_id;
  if (!userId) return NextResponse.json({ error: "لازم تحددي الطالب" }, { status: 400 });

  const { data: enrollment } = await supabase
    .from("batch_enrollments")
    .select("id")
    .eq("batch_id", params.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!enrollment) return NextResponse.json({ error: "هاد الطالب مو مسجّل بهاي الدفعة" }, { status: 404 });

  const { data: existing } = await supabase
    .from("batch_certificates")
    .select("id")
    .eq("batch_id", params.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: "الشهادة صادرة أصلاً لهاد الطالب" }, { status: 409 });

  const { data, error } = await supabase
    .from("batch_certificates")
    .insert({
      batch_id: params.id,
      user_id: userId,
      certificate_code: generateCertificateCode(),
      is_automatic: false,
      issued_by: auth.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ certificate: data });
}
