import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    { count: totalUsers },
    { count: activeNow },
    { count: vipCount },
    { count: activeSubs },
    { count: autoRenewCount },
    { count: expiringSoon },
    { count: expiredCount },
    { data: allPayments },
    { data: monthPayments },
    { data: trendProfiles },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).gte("last_login_at", fifteenMinAgo.toISOString()),
    supabase.from("profiles").select("*", { count: "exact", head: true }).in("plan", ["vip", "elite"]),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("subscription_status", "active"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("subscription_status", "active").eq("auto_renew", true),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("subscription_status", "active").gte("subscription_end", now.toISOString()).lte("subscription_end", in7Days.toISOString()),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("subscription_status", "inactive"),
    supabase.from("payments").select("amount, status, created_at").eq("status", "paid"),
    supabase.from("payments").select("amount").eq("status", "paid").gte("created_at", startOfMonth.toISOString()),
    supabase.from("profiles").select("created_at, subscription_start").gte("created_at", thirtyDaysAgo.toISOString()),
  ]);

  const totalRevenue = (allPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const monthlyRevenue = (monthPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const renewalRate = activeSubs ? Math.round(((autoRenewCount || 0) / activeSubs) * 100) : 0;
  const retention = totalUsers ? Math.round(((activeSubs || 0) / totalUsers) * 100) : 0;

  // متوسط مدة الاشتراك (بالأشهر) لكل من عنده بداية ونهاية
  const { data: durUsers } = await supabase
    .from("profiles")
    .select("subscription_start, subscription_end")
    .not("subscription_start", "is", null)
    .not("subscription_end", "is", null);
  let avgSubMonths = 0;
  if (durUsers?.length) {
    const totalMonths = durUsers.reduce((sum, u) => {
      const months = (new Date(u.subscription_end) - new Date(u.subscription_start)) / (1000 * 60 * 60 * 24 * 30);
      return sum + Math.max(0, months);
    }, 0);
    avgSubMonths = Math.round((totalMonths / durUsers.length) * 10) / 10;
  }

  // 30-يوم: عدد تسجيلات جديدة/يوم (لرسم Sparkline بسيط)
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const signupsByDay = Object.fromEntries(days.map((d) => [d, 0]));
  (trendProfiles || []).forEach((p) => {
    const d = p.created_at?.slice(0, 10);
    if (d && signupsByDay[d] !== undefined) signupsByDay[d]++;
  });

  // آخر 6 أشهر: الإيرادات شهرياً
  const monthLabels = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("ar", { month: "short" }) };
  });
  const revenueByMonth = Object.fromEntries(monthLabels.map((m) => [m.key, 0]));
  (allPayments || []).forEach((p) => {
    const d = new Date(p.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (revenueByMonth[key] !== undefined) revenueByMonth[key] += Number(p.amount || 0);
  });

  return NextResponse.json({
    cards: {
      totalUsers: totalUsers || 0,
      activeNow: activeNow || 0,
      vipCount: vipCount || 0,
      renewalRate,
      monthlyRevenue,
      totalRevenue,
      expiringSoon: expiringSoon || 0,
      expiredCount: expiredCount || 0,
    },
    kpis: {
      revenue: totalRevenue,
      retention,
      renewalRate,
      avgSubMonths,
    },
    charts: {
      signupsTrend: days.map((d) => ({ date: d, value: signupsByDay[d] })),
      revenueByMonth: monthLabels.map((m) => ({ label: m.label, value: Math.round(revenueByMonth[m.key]) })),
    },
  });
}
