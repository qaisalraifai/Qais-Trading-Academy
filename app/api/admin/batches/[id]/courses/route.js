import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/batches/[id]/courses — كل الدورات المرتبطة بهاي الدفعة، مرتبة
// ملاحظة: كل دفعة بتحتوي تلقائيًا كل دورات المنصة (ما في إضافة/حذف يدوي —
// الربط بيصير أوتوماتيكيًا لما تنشئي دفعة جديدة أو دورة جديدة، شوفي
// app/api/admin/batches/route.js و app/api/admin/courses/route.js)
export async function GET(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: links, error } = await supabase
    .from("batch_courses")
    .select("*")
    .eq("batch_id", params.id)
    .order("order_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const courseIds = (links || []).map((l) => l.course_id);
  let coursesMap = {};
  if (courseIds.length) {
    const { data: courses } = await supabase.from("courses").select("id, title, icon").in("id", courseIds);
    coursesMap = (courses || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {});
  }

  const enriched = (links || []).map((l) => ({ ...l, course: coursesMap[l.course_id] || null }));

  return NextResponse.json({ batch_courses: enriched });
}
