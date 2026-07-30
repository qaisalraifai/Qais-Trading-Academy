import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { getAffiliateTierStatus, getCancelledClientsCount } from "@/lib/tiers";

// GET /api/affiliate/me — بيانات وإحصائيات المسوّق الحالي (الشبكة + الأرباح + الدفعات + الإحالات + السلاسل الزمنية)
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

  const { data: settingsRow } = await admin
    .from("affiliate_settings")
    .select("min_payout_usd, payout_cycle_days")
    .eq("id", 1)
    .maybeSingle();

  const settings = {
    minPayoutUsd: Number(settingsRow?.min_payout_usd) || 0,
    payoutCycleDays: Number(settingsRow?.payout_cycle_days) || 14,
  };

  const base = {
    status: profile.affiliate_status || "none",
    affiliateCode: profile.affiliate_code || null,
    payoutMethod: profile.payout_method || null,
    payoutDetails: profile.payout_details || null,
    joinedAt: profile.affiliate_joined_at || null,
    settings,
  };

  if (profile.affiliate_status !== "approved") {
    return NextResponse.json({ ...base, network: { direct: 0 }, earnings: {}, payouts: [], referrals: [], series: { daily: [], weekly: [], monthly: [] }, tier: null });
  }

  // الشبكة الآن مسطّحة: إحالات مباشرة بس (بدون مستوى 2 أو 3)
  const { data: level1Rows } = await admin
    .from("profiles")
    .select("id, username, subscription_status, created_at")
    .eq("referred_by", user.id)
    .order("created_at", { ascending: false });

  const [tierStatus, cancelledClientsCount] = await Promise.all([
    getAffiliateTierStatus(admin, user.id),
    getCancelledClientsCount(admin, user.id),
  ]);

  // عمولات المسوّق (كل السجلات، لنبني منها الإجماليات + جدول الإحالات + السلاسل الزمنية)
  const { data: commissions } = await admin
    .from("commissions")
    .select("type, status, commission_amount, created_at, source_user_id")
    .eq("affiliate_id", user.id);

  const earnings = { totalEarned: 0, pending: 0, ready: 0, paid: 0, awaitingLesson: 0, byType: { signup: 0, renewal: 0 } };
  for (const c of commissions || []) {
    const amt = Number(c.commission_amount) || 0;
    earnings.totalEarned += amt;
    if (c.status === "pending") earnings.pending += amt;
    if (c.status === "ready") earnings.ready += amt;
    if (c.status === "paid") earnings.paid += amt;
    if (c.status === "awaiting_lesson") earnings.awaitingLesson += amt;
    if (c.type === "signup" || c.type === "renewal") earnings.byType[c.type] += amt;
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

  // جدول الإحالات المباشرة (مستوى 1) — لكل واحد فيهم نجمع عمولاته الخاصة معك + آخر نشاط
  const level1Ids = (level1Rows || []).map((r) => r.id);
  const { data: paymentsRows } =
    level1Ids.length > 0
      ? await admin
          .from("payments")
          .select("user_id, amount, created_at")
          .in("user_id", level1Ids)
          .eq("status", "paid")
          .order("created_at", { ascending: false })
      : { data: [] };

  const lastPaymentByUser = {};
  for (const p of paymentsRows || []) {
    if (!lastPaymentByUser[p.user_id]) {
      lastPaymentByUser[p.user_id] = { amount: p.amount, date: p.created_at };
    }
  }

  const commissionsBySource = {};
  for (const c of commissions || []) {
    if (!c.source_user_id) continue;
    if (!commissionsBySource[c.source_user_id]) {
      commissionsBySource[c.source_user_id] = { pending: 0, ready: 0, paid: 0, awaitingLesson: 0, total: 0, lastActivity: null };
    }
    const bucket = commissionsBySource[c.source_user_id];
    const amt = Number(c.commission_amount) || 0;
    bucket.total += amt;
    if (c.status === "pending") bucket.pending += amt;
    if (c.status === "ready") bucket.ready += amt;
    if (c.status === "paid") bucket.paid += amt;
    if (c.status === "awaiting_lesson") bucket.awaitingLesson += amt;
    if (!bucket.lastActivity || new Date(c.created_at) > new Date(bucket.lastActivity)) {
      bucket.lastActivity = c.created_at;
    }
  }

  const referrals = (level1Rows || []).map((r) => {
    const bucket = commissionsBySource[r.id] || { pending: 0, ready: 0, paid: 0, awaitingLesson: 0, total: 0, lastActivity: null };
    let commissionStatus = "none";
    if (bucket.awaitingLesson > 0) commissionStatus = "awaiting_lesson";
    if (bucket.pending > 0) commissionStatus = "pending";
    else if (bucket.ready > 0) commissionStatus = "ready";
    else if (bucket.paid > 0) commissionStatus = "paid";
    return {
      id: r.id,
      username: r.username || "مستخدم",
      joinedAt: r.created_at,
      subscriptionStatus: r.subscription_status || "none",
      commissionAmount: Math.round(bucket.total * 100) / 100,
      commissionStatus,
      lastActivity: bucket.lastActivity || r.created_at,
      lastPaymentAmount: lastPaymentByUser[r.id]?.amount ?? null,
      lastPaymentDate: lastPaymentByUser[r.id]?.date ?? null,
    };
  });

  // سلاسل زمنية للأرباح (يومي 14 يوم / أسبوعي 8 أسابيع / شهري 6 أشهر)
  function buildSeries() {
    const now = new Date();
    const dayMs = 86400000;

    const daily = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * dayMs);
      const key = d.toISOString().slice(0, 10);
      daily.push({ label: key.slice(5), key, total: 0 });
    }
    const dailyIndex = Object.fromEntries(daily.map((d, i) => [d.key, i]));

    const weekly = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 7 * dayMs);
      const key = `${d.getFullYear()}-W${String(getWeekNumber(d)).padStart(2, "0")}`;
      weekly.push({ label: key, key, total: 0 });
    }
    const weeklyIndex = Object.fromEntries(weekly.map((w, i) => [w.key, i]));

    const monthly = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly.push({ label: key, key, total: 0 });
    }
    const monthlyIndex = Object.fromEntries(monthly.map((m, i) => [m.key, i]));

    for (const c of commissions || []) {
      const amt = Number(c.commission_amount) || 0;
      const d = new Date(c.created_at);
      const dayKey = d.toISOString().slice(0, 10);
      if (dailyIndex[dayKey] !== undefined) daily[dailyIndex[dayKey]].total += amt;

      const weekKey = `${d.getFullYear()}-W${String(getWeekNumber(d)).padStart(2, "0")}`;
      if (weeklyIndex[weekKey] !== undefined) weekly[weeklyIndex[weekKey]].total += amt;

      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (monthlyIndex[monthKey] !== undefined) monthly[monthlyIndex[monthKey]].total += amt;
    }

    for (const arr of [daily, weekly, monthly]) {
      for (const row of arr) row.total = Math.round(row.total * 100) / 100;
    }

    return { daily, weekly, monthly };
  }

  function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  }

  const series = buildSeries();

  return NextResponse.json({
    ...base,
    network: {
      direct: level1Rows?.length || 0,
      active: tierStatus.activeClientsCount,
      cancelled: cancelledClientsCount,
    },
    tier: {
      current: tierStatus.current,
      next: tierStatus.next,
      remaining: tierStatus.remaining,
      progressPct: tierStatus.progressPct,
      activeClientsCount: tierStatus.activeClientsCount,
      allTiers: tierStatus.tiers,
      signupDelta: tierStatus.signupDelta,
      renewalDelta: tierStatus.renewalDelta,
      projectedMonthlyIncome: tierStatus.projectedMonthlyIncome,
      projectedMonthlyIncomeAtNextTier: tierStatus.projectedMonthlyIncomeAtNextTier,
    },
    earnings,
    payouts: payouts || [],
    funnel,
    referrals,
    series,
  });
}
