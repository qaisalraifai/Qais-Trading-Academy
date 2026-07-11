import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, type, message, created_at, user_id, profiles(username)")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data || []).map((a) => ({
    id: a.id,
    type: a.type,
    message: a.message,
    created_at: a.created_at,
    username: a.profiles?.username,
  }));

  return NextResponse.json({ items });
}
