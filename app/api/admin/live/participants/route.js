import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { getRoomServiceClient, permissionsForRole, LIVE_ROLES } from "@/lib/livekit-server";

// GET /api/admin/live/participants?sessionId=... — قائمة المشاركين الحاليين (من LiveKit مباشرة)
export async function GET(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId مطلوب" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: session } = await supabase.from("live_sessions").select("id, room_name").eq("id", sessionId).maybeSingle();
  if (!session) return NextResponse.json({ participants: [] });

  const svc = getRoomServiceClient();
  const participants = await svc.listParticipants(session.room_name).catch(() => []);
  return NextResponse.json({
    participants: participants.map((p) => ({
      identity: p.identity,
      name: p.name,
      sid: p.sid,
      metadata: p.metadata,
      tracks: p.tracks.map((t) => ({ sid: t.sid, type: t.type, muted: t.muted, source: t.source })),
      joinedAt: p.joinedAt,
    })),
  });
}

// POST /api/admin/live/participants { sessionId, action, identity, trackSid } — mute | unmute | kick | promote | demote
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const { sessionId, action, identity, trackSid } = body;
  if (!sessionId || !action || !identity) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: session } = await supabase.from("live_sessions").select("id, room_name").eq("id", sessionId).maybeSingle();
  if (!session) return NextResponse.json({ error: "البث غير موجود" }, { status: 404 });

  const svc = getRoomServiceClient();

  try {
    if (action === "mute") {
      if (!trackSid) return NextResponse.json({ error: "trackSid مطلوب" }, { status: 400 });
      await svc.mutePublishedTrack(session.room_name, identity, trackSid, true);
    } else if (action === "unmute") {
      if (!trackSid) return NextResponse.json({ error: "trackSid مطلوب" }, { status: 400 });
      await svc.mutePublishedTrack(session.room_name, identity, trackSid, false);
    } else if (action === "kick") {
      await svc.removeParticipant(session.room_name, identity);
    } else if (action === "promote") {
      await supabase.from("live_moderators").upsert({ session_id: session.id, user_id: identity, promoted_by: auth.user.id });
      await svc.updateParticipant(session.room_name, identity, {
        permission: permissionsForRole(LIVE_ROLES.moderator),
        metadata: JSON.stringify({ role: LIVE_ROLES.moderator }),
      });
    } else if (action === "demote") {
      await supabase.from("live_moderators").delete().eq("session_id", session.id).eq("user_id", identity);
      await svc.updateParticipant(session.room_name, identity, {
        permission: permissionsForRole(LIVE_ROLES.student),
        metadata: JSON.stringify({ role: LIVE_ROLES.student }),
      });
    } else {
      return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
