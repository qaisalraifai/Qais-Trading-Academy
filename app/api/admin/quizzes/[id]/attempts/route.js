import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/quizzes/[id]/attempts — كل محاولات الطلاب لهاد الاختبار
export async function GET(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: attempts, error } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("quiz_id", params.id)
    .order("attempted_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const studentIds = (attempts || []).map((a) => a.student_id);
  let profilesMap = {};
  if (studentIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, username, email").in("id", studentIds);
    profilesMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
  }

  const withDetails = (attempts || []).map((a) => ({
    ...a,
    username: profilesMap[a.student_id]?.username || "—",
    email: profilesMap[a.student_id]?.email || "—",
    percent: a.total_questions ? Math.round((a.score / a.total_questions) * 100) : 0,
  }));

  return NextResponse.json({ attempts: withDetails });
}
