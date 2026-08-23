import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { assertLiveSessionAccess } from "@/lib/live-access";

// GET /api/live/chat?sessionId=... — آخر 100 رسالة (تاريخ الدردشة لمين ينضم متأخر)
export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId مطلوب" }, { status: 400 });

  const admin = createAdminClient();
  const access = await assertLiveSessionAccess(admin, user.id, sessionId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { data, error } = await admin
    .from("live_chat_messages")
    .select("id, username, role, body, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data || [] });
}

// POST /api/live/chat { sessionId, body } — يحفظ رسالة (البث الحي نفسه بيصير عبر data channel بـ LiveKit)
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const payload = await request.json().catch(() => ({}));
  const { sessionId, body } = payload;
  if (!sessionId || !body?.trim()) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  if (body.length > 1000) return NextResponse.json({ error: "الرسالة طويلة كتير" }, { status: 400 });

  const admin = createAdminClient();
  const access = await assertLiveSessionAccess(admin, user.id, sessionId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { data, error } = await admin
    .from("live_chat_messages")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      username: access.username || user.email || "مستخدم",
      role: access.role,
      body: body.trim(),
    })
    .select("id, username, role, body, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data });
}
