import { createClient } from "@supabase/supabase-js";
import { kickMemberFromGuild } from "@/lib/discord";

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

  return Response.json({
    success: true,
    deactivated: data?.length || 0,
    discordKicked: kickedCount,
    timestamp: now,
  });
}
