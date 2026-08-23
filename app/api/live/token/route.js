import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { createLiveAccessToken } from "@/lib/livekit-server";
import { assertLiveSessionAccess } from "@/lib/live-access";

// POST /api/live/token { sessionId } — بتصدر Access Token لأي مستخدم مسموحله
// (مسجّل بدفعة البث أو مدرب/أدمن) عشان ينضم لغرفة LiveKit. الدور بيتحدد سيرفر-سايد فقط.
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const sessionId = body?.sessionId;
  if (!sessionId) return NextResponse.json({ error: "sessionId مطلوب" }, { status: 400 });

  const admin = createAdminClient();
  const access = await assertLiveSessionAccess(admin, user.id, sessionId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!access.session.is_active) return NextResponse.json({ error: "البث انتهى" }, { status: 410 });

  const { data: profile } = await admin.from("profiles").select("username").eq("id", user.id).maybeSingle();
  const displayName = profile?.username || access.username || user.email || "مستخدم";

  const token = await createLiveAccessToken({
    identity: user.id,
    name: displayName,
    roomName: access.session.room_name,
    role: access.role,
    metadata: { role: access.role, username: displayName },
  });

  return NextResponse.json({
    token,
    wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_WS_URL,
    role: access.role,
    sessionId: access.session.id,
    roomName: access.session.room_name,
    identity: user.id,
    username: displayName,
  });
}
