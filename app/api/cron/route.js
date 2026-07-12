import { createClient } from "@supabase/supabase-js";
import { kickMemberFromGuild } from "@/lib/discord";
import { runMonthlyMatchingBonus } from "@/lib/matching-engine";
import { runMonthlyLeadershipPool } from "@/lib/leadership-engine";

export async function GET(request) {
  // تحقق من Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const now = new Date().toISOString();

  // حجب كل من انتهى اشتراكه، وجيب discord_id تبعهم حتى نطردهم
  const { data, error } = await supabase
    .from("profiles")
    .update({ subscription_status: "inactive" })
    .eq("subscription_status", "active")
    .lt("subscription_end", now)
    .select("id, discord_id");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  let kickedCount = 0;
  for (const row of data || []) {
    if (row.discord_id) {
      const result = await kickMemberFromGuild(row.discord_id).catch((e) => {
        console.error("Discord kick error:", e);
        return { success: false };
      });
      if (result.success) kickedCount += 1;
    }
  }

  // ============= إضافات خطة Qais Trading Academy (لا تؤثر على المنطق فوق) =============

  // الفصل 8 و29: عضو ما جدد خلال 30 يوم يفقد استحقاق Binary/Matching/Leadership
  // (منطق منفصل عن subscription_status الخاص بباديل — is_active_member خاص بالخطة)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: deactivatedMlm, error: mlmDeactivateError } = await supabase
    .from("profiles")
    .update({ is_active_member: false })
    .eq("is_active_member", true)
    .lt("last_renewal_at", thirtyDaysAgo)
    .select("id");

  if (mlmDeactivateError) {
    console.error("MLM inactivity sweep failed:", mlmDeactivateError.message);
  }

  // الفصل 5 و25 و52: Matching وLeadership شهريان — نشغّلهم بس أول يوم بالشهر
  // (الكرون هذا حسب الإعداد الحالي شغال يوميًا أو ساعي — هاد الشرط يمنع تكرار الدفع)
  let matchingResult = null;
  let leadershipResult = null;
  const today = new Date();
  if (today.getDate() === 1) {
    matchingResult = await runMonthlyMatchingBonus(supabase).catch((e) => {
      console.error("runMonthlyMatchingBonus failed:", e.message);
      return null;
    });
    leadershipResult = await runMonthlyLeadershipPool(supabase).catch((e) => {
      console.error("runMonthlyLeadershipPool failed:", e.message);
      return null;
    });
  }

  // ============================================================================

  return Response.json({
    success: true,
    deactivated: data?.length || 0,
    discordKicked: kickedCount,
    mlmDeactivated: deactivatedMlm?.length || 0,
    matchingResult,
    leadershipResult,
    timestamp: now,
  });
}
