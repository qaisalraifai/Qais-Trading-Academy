import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { checkAndAwardBadges } from "@/lib/badges";

// GET /api/affiliate/badges — شارات المسوّق (ممنوحة + الباقية)، بتفحص وتمنح أي شارة مستحقّة لسا ما انمنحت
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin.from("profiles").select("affiliate_status").eq("id", user.id).maybeSingle();
  if (!profile || profile.affiliate_status !== "approved") {
    return NextResponse.json({ badges: [] });
  }

  await checkAndAwardBadges(admin, user.id);

  const { data: allBadges } = await admin.from("badges").select("*").order("code");
  const { data: earned } = await admin
    .from("affiliate_badges")
    .select("badge_code, earned_at")
    .eq("affiliate_id", user.id);

  const earnedByCode = Object.fromEntries((earned || []).map((e) => [e.badge_code, e.earned_at]));

  const badges = (allBadges || []).map((b) => ({
    ...b,
    earned: !!earnedByCode[b.code],
    earned_at: earnedByCode[b.code] || null,
  }));

  return NextResponse.json({ badges });
}
