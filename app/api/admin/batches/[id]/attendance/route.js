import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/batches/[id]/attendance — كل بثوث هاي الدفعة (المنتهية والنشطة)
// مع عدد الحاضرين من إجمالي الطلاب المسجلين حاليًا بالدفعة، لكل بث على حدة
export async function GET(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { count: totalStudents } = await supabase
    .from("batch_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", params.id);

  const { data: sessions, error } = await supabase
    .from("live_sessions")
    .select("id, title, started_at, ended_at, is_active")
    .eq("batch_id", params.id)
    .order("started_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sessionIds = (sessions || []).map((s) => s.id);
  let presentMap = {};

  if (sessionIds.length > 0) {
    const { data: attendance } = await supabase
      .from("live_attendance")
      .select("live_session_id")
      .in("live_session_id", sessionIds);

    presentMap = (attendance || []).reduce((acc, row) => {
      acc[row.live_session_id] = (acc[row.live_session_id] || 0) + 1;
      return acc;
    }, {});
  }

  const enriched = (sessions || []).map((s) => ({
    ...s,
    present_count: presentMap[s.id] || 0,
    total_students: totalStudents || 0,
  }));

  return NextResponse.json({ sessions: enriched, total_students: totalStudents || 0 });
}
