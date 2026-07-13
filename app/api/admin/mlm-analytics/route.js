import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const supabaseAdmin = createAdminClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  const [
    { count: totalMembers },
    { count: activeMembers },
    { data: monthPayments },
    { data: yearPayments },
    { data: monthCommissions },
    { count: pendingWithdrawalsCount },
    { data: pendingWithdrawalsSum },
    { count: pendingKycCount },
    { data: topLeaders },
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("is_active_member", true),
    supabaseAdmin.from("payments").select("amount").eq("status", "paid").gte("created_at", monthStart),
    supabaseAdmin.from("payments").select("amount").eq("status", "paid").gte("created_at", yearStart),
    supabaseAdmin.from("mlm_commissions").select("amount, bonus_type").eq("status", "approved").gte("created_at", monthStart),
    supabaseAdmin.from("mlm_withdrawals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabaseAdmin.from("mlm_withdrawals").select("amount").eq("status", "pending"),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("kyc_status", "pending"),
    supabaseAdmin
      .from("profiles")
      .select("username, cv_left, cv_right, ranks:rank_id (name_ar, level_order)")
      .not("rank_id", "is", null)
      .order("cv_left", { ascending: false })
      .limit(10),
  ]);

  const monthRevenue = (monthPayments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const yearRevenue = (yearPayments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const monthCommissionsTotal = (monthCommissions || []).reduce((s, c) => s + Number(c.amount || 0), 0);
  const pendingWithdrawalsAmount = (pendingWithdrawalsSum || []).reduce((s, w) => s + Number(w.amount || 0), 0);

  const commissionsByType = {};
  (monthCommissions || []).forEach((c) => {
    commissionsByType[c.bonus_type] = (commissionsByType[c.bonus_type] || 0) + Number(c.amount || 0);
  });

  const leaders = (topLeaders || [])
    .map((l) => ({
      username: l.username,
      rankName: l.ranks?.name_ar || "—",
      levelOrder: l.ranks?.level_order || 0,
      totalCv: Number(l.cv_left || 0) + Number(l.cv_right || 0),
    }))
    .sort((a, b) => b.totalCv - a.totalCv)
    .slice(0, 10);

  return NextResponse.json({
    totalMembers: totalMembers || 0,
    activeMembers: activeMembers || 0,
    monthRevenue,
    yearRevenue,
    monthCommissionsTotal,
    commissionsByType,
    pendingWithdrawalsCount: pendingWithdrawalsCount || 0,
    pendingWithdrawalsAmount,
    pendingKycCount: pendingKycCount || 0,
    topLeaders: leaders,
  });
}
