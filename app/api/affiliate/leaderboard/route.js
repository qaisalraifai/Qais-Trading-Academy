import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

// GET /api/affiliate/leaderboard — أفضل 20 مسوّق بحسب إجمالي الأرباح (اسم كامل، حسب قرار الخصوصية).
// متاح لأي مستخدم مسجّل دخول (تحفيزي)، وبيرجع ترتيب المستخدم الحالي لو هو مسوّق مفعّل.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: affiliates } = await admin
    .from("profiles")
    .select("id, username")
    .eq("affiliate_status", "approved");

  const ids = (affiliates || []).map((a) => a.id);
  if (ids.length === 0) return NextResponse.json({ leaderboard: [], myRank: null });

  const { data: commissions } = await admin
    .from("commissions")
    .select("affiliate_id, commission_amount")
    .in("affiliate_id", ids);

  const { data: referrals } = await admin.from("profiles").select("referred_by").in("referred_by", ids);

  const earningsById = {};
  for (const c of commissions || []) {
    earningsById[c.affiliate_id] = (earningsById[c.affiliate_id] || 0) + (Number(c.commission_amount) || 0);
  }
  const referralsById = {};
  for (const r of referrals || []) {
    referralsById[r.referred_by] = (referralsById[r.referred_by] || 0) + 1;
  }

  const ranked = (affiliates || [])
    .map((a) => ({
      id: a.id,
      username: a.username,
      totalEarned: earningsById[a.id] || 0,
      referrals: referralsById[a.id] || 0,
    }))
    .sort((a, b) => b.totalEarned - a.totalEarned)
    .map((a, i) => ({ ...a, rank: i + 1 }));

  const myEntry = ranked.find((r) => r.id === user.id);

  return NextResponse.json({
    leaderboard: ranked.slice(0, 20),
    myRank: myEntry ? { rank: myEntry.rank, totalEarned: myEntry.totalEarned } : null,
  });
}
