import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

// GET /api/affiliate/me — بيانات وإحصائيات المسوّق الحالي (الشبكة + الأرباح + الدفعات)
export async function GET(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, username, affiliate_status, affiliate_code, is_affiliate, payout_method, payout_details, affiliate_joined_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "الملف الشخصي غير موجود" }, { status: 400 });
  }

  const base = {
    status: profile.affiliate_status || "none",
    affiliateCode: profile.affiliate_code || null,
    payoutMethod: profile.payout_method || null,
    payoutDetails: profile.payout_details || null,
  };

  if (profile.affiliate_status !== "approved") {
    return NextResponse.json({ ...base, network: { level1: 0, level2: 0, level3: 0 }, earnings: {}, payouts: [] });
  }

  // نبني الشبكة: مستوى 1 -> 2 -> 3
  const { data: level1Rows } = await admin.from("profiles").select("id, username, subscription_status, created_at").eq("referred_by", user.id);
  const level1Ids = (level1Rows || []).map((r) => r.id);

  let level2Rows = [];
  if (level1Ids.length > 0) {
    const { data } = await admin.from("profiles").select("id, username, subscription_status, created_at").in("referred_by", level1Ids);
    level2Rows = data || [];
  }
  const level2Ids = level2Rows.map((r) => r.id);

  let level3Rows = [];
  if (level2Ids.length > 0) {
    const { data } = await admin.from("profiles").select("id, username, subscription_status, created_at").in("referred_by", level2Ids);
    level3Rows = data || [];
  }

  // عمولات المسوّق
  const { data: commissions } = await admin
    .from("commissions")
    .select("level, status, commission_amount, created_at")
    .eq("affiliate_id", user.id);

  const earnings = { totalEarned: 0, pending: 0, ready: 0, paid: 0, byLevel: { 1: 0, 2: 0, 3: 0 } };
  for (const c of commissions || []) {
    const amt = Number(c.commission_amount) || 0;
    earnings.totalEarned += amt;
    if (c.status === "pending") earnings.pending += amt;
    if (c.status === "ready") earnings.ready += amt;
    if (c.status === "paid") earnings.paid += amt;
    if (c.level >= 1 && c.level <= 3) earnings.byLevel[c.level] += amt;
  }

  const { data: payouts } = await admin
    .from("payouts")
    .select("id, amount, status, method, period_start, period_end, paid_at, reference, created_at")
    .eq("affiliate_id", user.id)
    .order("created_at", { ascending: false });

  // إحصائيات تتبّع النقرات: عدد الزيارات، معدل التحويل، وربح كل نقرة (EPC)
  const { data: clickRows } = await admin
    .from("affiliate_clicks")
    .select("id, converted_user_id")
    .eq("affiliate_id", user.id);
  const totalClicks = clickRows?.length || 0;
  const totalConversions = (clickRows || []).filter((c) => c.converted_user_id).length;
  const funnel = {
    clicks: totalClicks,
    signups: totalConversions,
    conversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
    epc: totalClicks > 0 ? earnings.totalEarned / totalClicks : 0,
  };

  return NextResponse.json({
    ...base,
    network: {
      level1: level1Rows?.length || 0,
      level2: level2Rows?.length || 0,
      level3: level3Rows?.length || 0,
    },
    earnings,
    payouts: payouts || [],
    funnel,
  });
}
