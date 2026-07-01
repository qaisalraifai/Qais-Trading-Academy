import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { kickMemberFromGuild } from "@/lib/discord";

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userId, status } = await request.json();
  if (!userId || !["active", "inactive"].includes(status)) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const now = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 1);

  const updateData = {
    subscription_status: status,
    subscription_start: status === "active" ? now.toISOString() : null,
    subscription_end: status === "active" ? end.toISOString() : null,
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", userId)
    .select("discord_id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status === "inactive" && data?.discord_id) {
    await kickMemberFromGuild(data.discord_id).catch((e) =>
      console.error("Discord kick error:", e)
    );
  }

  return NextResponse.json({ success: true });
}
