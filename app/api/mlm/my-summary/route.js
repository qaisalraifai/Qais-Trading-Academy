import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select(
      `id, username, sponsor_id, parent_id, leg, cv_personal, cv_left, cv_right,
       carry_left, carry_right, is_active_member, last_renewal_at,
       ranks:rank_id (id, code, name_ar, level_order, bonus_amount, min_direct_members, min_total_cv)`
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    return NextResponse.json({ error: "تعذر جلب البيانات" }, { status: 400 });
  }

  // الأولاد المباشرين بالشجرة (يسار/يمين) — للعرض البصري بالشجرة
  const { data: children } = await supabaseAdmin
    .from("profiles")
    .select("id, username, leg, is_active_member")
    .eq("parent_id", user.id);

  const leftChild = (children || []).find((c) => c.leg === "left") || null;
  const rightChild = (children || []).find((c) => c.leg === "right") || null;

  // عدد المباشرين (بالراعي، مش بالشجرة) — نفس تعريف Rank Engine
  const { count: directCount } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("sponsor_id", user.id);

  // الرتبة الجاية (لعرض "كم باقي" للترقية)
  const { data: nextRank } = profile.ranks
    ? await supabaseAdmin
        .from("ranks")
        .select("*")
        .gt("level_order", profile.ranks.level_order)
        .order("level_order", { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null };

  // المحافظ الأربع
  const { data: wallets } = await supabaseAdmin
    .from("wallets")
    .select("wallet_type, balance")
    .eq("user_id", user.id);

  const walletMap = { commission: 0, bonus: 0, cashback: 0, withdrawal: 0 };
  (wallets || []).forEach((w) => (walletMap[w.wallet_type] = Number(w.balance || 0)));

  // آخر 10 عمولات
  const { data: recentCommissions } = await supabaseAdmin
    .from("mlm_commissions")
    .select("bonus_type, amount, created_at, status")
    .eq("beneficiary_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    profile: {
      username: profile.username,
      isActiveMember: profile.is_active_member,
      lastRenewalAt: profile.last_renewal_at,
      cvPersonal: profile.cv_personal,
      cvLeft: profile.cv_left,
      cvRight: profile.cv_right,
      carryLeft: profile.carry_left,
      carryRight: profile.carry_right,
      directCount: directCount || 0,
    },
    rank: profile.ranks || null,
    nextRank: nextRank || null,
    tree: { leftChild, rightChild },
    wallets: walletMap,
    recentCommissions: recentCommissions || [],
  });
}
