import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/batches/[id]/students — الطلاب المسجلين بدفعة معينة
export async function GET(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: enrollments, error } = await supabase
    .from("batch_enrollments")
    .select("id, user_id, enrolled_at")
    .eq("batch_id", params.id)
    .order("enrolled_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = (enrollments || []).map((e) => e.user_id);
  let profilesMap = {};

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, email")
      .in("id", userIds);
    profilesMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
  }

  const students = (enrollments || []).map((e) => ({
    enrollment_id: e.id,
    user_id: e.user_id,
    enrolled_at: e.enrolled_at,
    username: profilesMap[e.user_id]?.username || "—",
    email: profilesMap[e.user_id]?.email || "—",
  }));

  return NextResponse.json({ students });
}
