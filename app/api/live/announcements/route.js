import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { assertLiveSessionAccess } from "@/lib/live-access";

// POST /api/live/announcements { sessionId, message } — يحفظ إعلان للأرشيف
// (البث الحي للتنبيه بيصير عبر data channel من الفرونت مباشرة لكل المتصلين)
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();
  const payload = await request.json().catch(() => ({}));
  const { sessionId, message } = payload;
  if (!sessionId || !message?.trim()) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const access = await assertLiveSessionAccess(admin, user.id, sessionId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (access.role === "student") return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const { error } = await admin.from("live_announcements").insert({ session_id: sessionId, message: message.trim(), created_by: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
