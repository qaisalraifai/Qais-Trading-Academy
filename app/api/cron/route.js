import { createClient } from "@supabase/supabase-js";
import { kickMemberFromGuild } from "@/lib/discord";
import { syncAffiliateTier } from "@/lib/tiers";
import { recordDailySnapshots } from "@/lib/affiliate-snapshots";
import { runMonthlyTopEarnerContest } from "@/lib/monthly-contest";

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
    .select("id, discord_id, referred_by");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // إعادة حساب مستوى راعي كل عميل فقد نشاطه (المستوى ديناميكي — قد ينزل)
  const affectedSponsors = new Set((data || []).map((r) => r.referred_by).filter(Boolean));
  for (const sponsorId of affectedSponsors) {
    await syncAffiliateTier(supabase, sponsorId).catch((e) => console.error("syncAffiliateTier failed:", e.message));
  }

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

  const snapshotsResult = await recordDailySnapshots(supabase).catch((e) => {
    console.error("recordDailySnapshots failed:", e.message);
    return null;
  });

  // مسابقة "أعلى مسوّق بالشهر" — تشتغل مرة وحدة بس بأول يوم من الشهر
  let monthlyContestResult = null;
  if (new Date().getDate() === 1) {
    monthlyContestResult = await runMonthlyTopEarnerContest(supabase).catch((e) => {
      console.error("runMonthlyTopEarnerContest failed:", e.message);
      return null;
    });
  }

  return Response.json({
    success: true,
    deactivated: data?.length || 0,
    discordKicked: kickedCount,
    snapshotsResult,
    monthlyContestResult,
    timestamp: now,
  });
}
