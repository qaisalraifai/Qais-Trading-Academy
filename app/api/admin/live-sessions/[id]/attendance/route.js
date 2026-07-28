import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/live-sessions/[id]/attendance — تفصيل الحضور لبث معيّن:
// كل طالب مسجّل بدفعة هاد البث، وهل حضر ولا لأ (ووقت أول وآخر دخول له لو حضر)
export async function GET(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: session } = await supabase
    .from("live_sessions")
    .select("id, title, started_at, ended_at, is_active, batch_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "البث غير موجود" }, { status: 404 });

  const { data: batch } = await supabase
    .from("batches")
    .select("id, name, course_id")
    .eq("id", session.batch_id)
    .maybeSingle();

  const { data: enrollments } = await supabase
    .from("batch_enrollments")
    .select("user_id")
    .eq("batch_id", session.batch_id);

  const userIds = (enrollments || []).map((e) => e.user_id);
  let profilesMap = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, email")
      .in("id", userIds);
    profilesMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
  }

  const { data: attendance } = await supabase
    .from("live_attendance")
    .select("user_id, first_joined_at, last_seen_at, join_count")
    .eq("live_session_id", params.id);

  const attendanceMap = (attendance || []).reduce((acc, a) => ({ ...acc, [a.user_id]: a }), {});

  const students = userIds
    .map((uid) => {
      const a = attendanceMap[uid];
      return {
        user_id: uid,
        username: profilesMap[uid]?.username || "—",
        email: profilesMap[uid]?.email || "—",
        present: !!a,
        first_joined_at: a?.first_joined_at || null,
        last_seen_at: a?.last_seen_at || null,
      };
    })
    // الحاضرين أول بالترتيب
    .sort((a, b) => (a.present === b.present ? 0 : a.present ? -1 : 1));

  return NextResponse.json({ session, batch: batch || null, students });
}
