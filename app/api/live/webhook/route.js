import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { getWebhookReceiver } from "@/lib/livekit-server";

// POST /api/live/webhook — نقطة الاستقبال اللي بنسجّلها بإعداد LiveKit server
// (webhook.urls) عشان نعرف تلقائيًا لما ينخلص تسجيل بث ونحفظ رابطه.
// (الحضور نفسه بينسجل عبر /api/live/attendance من الفرونت مباشرة — نفس نظام
// الحضور الموجود أصلاً بالمنصة، ما لمسناه.)
export async function POST(request) {
  const body = await request.text();
  const authHeader = request.headers.get("Authorization") || "";

  let event;
  try {
    const receiver = getWebhookReceiver();
    event = await receiver.receive(body, authHeader);
  } catch (e) {
    return NextResponse.json({ error: "توقيع غير صالح" }, { status: 401 });
  }

  if (event.event === "egress_ended") {
    const egressId = event.egressInfo?.egressId;
    if (egressId) {
      const supabase = createAdminClient();
      const fileResult = event.egressInfo?.fileResults?.[0];
      const status = event.egressInfo?.error ? "failed" : "ready";
      await supabase
        .from("live_sessions")
        .update({ recording_status: status, recording_url: fileResult?.location || null })
        .eq("egress_id", egressId)
        .catch(() => {});
    }
  }

  return NextResponse.json({ received: true });
}
