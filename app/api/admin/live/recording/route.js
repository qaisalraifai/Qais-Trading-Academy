import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { getEgressClient } from "@/lib/livekit-server";
import { EncodedFileType, EncodedFileOutput, S3Upload } from "livekit-server-sdk";

// POST /api/admin/live/recording { sessionId } — يبدأ تسجيل بث معيّن (Room Composite Egress)
// التسجيل بينكتب على تخزين متوافق مع S3 (فيه تستخدمي Supabase Storage S3 endpoint
// أو أي مزوّد S3 — راجعي LIVEKIT_SETUP.md لتفاصيل متغيرات البيئة).
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const sessionId = body?.sessionId;
  if (!sessionId) return NextResponse.json({ error: "sessionId مطلوب" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("live_sessions")
    .select("id, room_name, egress_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "البث غير موجود" }, { status: 404 });
  if (session.egress_id) return NextResponse.json({ error: "التسجيل شغال أصلاً" }, { status: 400 });

  const bucket = process.env.LIVE_RECORDINGS_S3_BUCKET;
  if (!bucket) {
    return NextResponse.json(
      { error: "تخزين التسجيلات غير معدّ (LIVE_RECORDINGS_S3_BUCKET) — راجعي LIVEKIT_SETUP.md" },
      { status: 500 }
    );
  }

  const filepath = `live-recordings/${session.room_name}-${Date.now()}.mp4`;

  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath,
    output: {
      case: "s3",
      value: new S3Upload({
        accessKey: process.env.LIVE_RECORDINGS_S3_ACCESS_KEY,
        secret: process.env.LIVE_RECORDINGS_S3_SECRET,
        bucket,
        region: process.env.LIVE_RECORDINGS_S3_REGION || "us-east-1",
        endpoint: process.env.LIVE_RECORDINGS_S3_ENDPOINT,
      }),
    },
  });

  try {
    const egress = getEgressClient();
    const info = await egress.startRoomCompositeEgress(session.room_name, { file: output }, { layout: "speaker" });

    await supabase.from("live_sessions").update({ egress_id: info.egressId, recording_status: "recording" }).eq("id", session.id);

    return NextResponse.json({ egressId: info.egressId });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/admin/live/recording { sessionId } — يوقف تسجيل بث معيّن
export async function DELETE(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const sessionId = body?.sessionId;
  if (!sessionId) return NextResponse.json({ error: "sessionId مطلوب" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: session } = await supabase.from("live_sessions").select("id, egress_id").eq("id", sessionId).maybeSingle();
  if (!session?.egress_id) return NextResponse.json({ error: "ما في تسجيل شغال" }, { status: 400 });

  try {
    const egress = getEgressClient();
    await egress.stopEgress(session.egress_id);
    await supabase.from("live_sessions").update({ recording_status: "processing" }).eq("id", session.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
