import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { getAccessibleActiveSessions } from "@/lib/live-access";

// GET /api/live — كل البثوث النشطة هلأ اللي المستخدم مسموحله ينضم إلها
// (طالب: بس بثوث دفعاته — أدمن/مدرب دفعة: بثوث دفعته أو كل البثوث لو أدمن عام)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();
  const sessions = await getAccessibleActiveSessions(admin, user.id);
  return NextResponse.json({ sessions });
}
