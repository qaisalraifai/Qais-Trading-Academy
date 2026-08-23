import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

// GET /api/affiliate/achievements — كل الإنجازات المفعّلة + حالة كل وحدة للمسوّق الحالي
// (مفتوحة/غير مفتوحة + نسبة التقدّم الحالية نحوها). كل الإنجازات تراكمية (Lifetime).
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("affiliate_status")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.affiliate_status !== "approved") {
    return NextResponse.json({ achievements: [] });
  }

  const { data: definitions } = await admin
    .from("achievement_definitions")
    .select("*")
    .eq("is_active", true)
    .neq("metric", "monthly_top_rank")
    .order("sort_order", { ascending: true });

  const { data: unlocked } = await admin
    .from("achievements_unlocked")
    .select("achievement_code, unlocked_at")
    .eq("user_id", user.id);
  const unlockedByCode = Object.fromEntries((unlocked || []).map((u) => [u.achievement_code, u.unlocked_at]));

  const { count: totalReferrals } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", user.id);

  const { data: commissions } = await admin.from("commissions").select("commission_amount").eq("affiliate_id", user.id);
  const totalEarned = (commissions || []).reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);

  const metricValues = { total_referrals: totalReferrals || 0, total_earned: totalEarned };

  const achievements = (definitions || []).map((def) => {
    const currentValue = metricValues[def.metric] ?? 0;
    return {
      code: def.code,
      title: def.title_ar,
      description: def.description_ar,
      icon: def.icon,
      threshold: Number(def.threshold),
      bonusAmount: Number(def.bonus_amount),
      metric: def.metric,
      currentValue,
      progressPct: def.threshold > 0 ? Math.min(100, Math.round((currentValue / def.threshold) * 100)) : 0,
      unlocked: !!unlockedByCode[def.code],
      unlockedAt: unlockedByCode[def.code] || null,
    };
  });

  return NextResponse.json({ achievements });
}
