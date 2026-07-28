import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

const BUCKET = "assignment-submissions";

// GET /api/admin/assignments/[assignmentId]/submissions — كل تسليمات هاي الواجب مع بيانات الطالب
export async function GET(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: submissions, error } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("assignment_id", params.assignmentId)
    .order("submitted_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = (submissions || []).map((s) => s.user_id);
  let profilesMap = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, username, email").in("id", userIds);
    profilesMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
  }

  const withDetails = await Promise.all(
    (submissions || []).map(async (s) => {
      let download_url = null;
      if (s.file_path) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(s.file_path, 60 * 60);
        download_url = data?.signedUrl || null;
      }
      return {
        ...s,
        username: profilesMap[s.user_id]?.username || "—",
        email: profilesMap[s.user_id]?.email || "—",
        download_url,
      };
    })
  );

  return NextResponse.json({ submissions: withDetails });
}
