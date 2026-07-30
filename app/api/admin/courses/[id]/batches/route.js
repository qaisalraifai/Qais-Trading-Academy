import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/courses/[id]/batches — كل الدفعات اللي فيها هاي الدورة (عمليًا كل
// الدفعات، لأن كل دفعة بتحتوي تلقائيًا كل الدورات) + batch_course_id تبع كل وحدة،
// المطلوب لتحديد محتوى (محاضرة/اختبار) حصري لدفعة معينة داخل هاي الدورة.
export async function GET(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: links, error } = await supabase
    .from("batch_courses")
    .select("id, batch_id")
    .eq("course_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const batchIds = (links || []).map((l) => l.batch_id);
  let batchesMap = {};
  if (batchIds.length) {
    const { data: batches } = await supabase.from("batches").select("id, name, is_archived").in("id", batchIds);
    batchesMap = (batches || []).reduce((acc, b) => ({ ...acc, [b.id]: b }), {});
  }

  const enriched = (links || [])
    .map((l) => ({ batch_course_id: l.id, batch_id: l.batch_id, batch: batchesMap[l.batch_id] || null }))
    .filter((l) => l.batch && !l.batch.is_archived)
    .sort((a, b) => (a.batch?.name || "").localeCompare(b.batch?.name || ""));

  return NextResponse.json({ links: enriched });
}
