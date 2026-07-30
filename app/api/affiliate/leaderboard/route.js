import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { getActiveClientsCount } from "@/lib/tiers";

// GET /api/affiliate/leaderboard — أفضل 20 مسوّق حسب (الأرباح | العملاء النشطين | معدل التحويل).
// إظهار/إخفاء الأسماء يُتحكم به بالكامل من لوحة الأدمن (affiliate_settings.leaderboard_show_names).
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: settingsRow } = await admin
    .from("affiliate_settings")
    .select("leaderboard_show_names")
    .eq("id", 1)
    .maybeSingle();
  const showNames = settingsRow?.leaderboard_show_names !== false;

  const { data: affiliates } = await admin
    .from("profiles")
    .select("id, username, affiliate_code")
    .eq("affiliate_status", "approved");

  const ids = (affiliates || []).map((a) => a.id);
  if (ids.length === 0) return NextResponse.json({ leaderboard: { earnings: [], clients: [], conversion: [] }, myRank: {}, showNames });

  const [{ data: commissions }, { data: referrals }, { data: clickRows }] = await Promise.all([
    admin.from("commissions").select("affiliate_id, commission_amount").in("affiliate_id", ids),
    admin.from("profiles").select("referred_by").in("referred_by", ids),
    admin.from("affiliate_clicks").select("affiliate_id, converted_user_id").in("affiliate_id", ids),
  ]);

  const earningsById = {};
  for (const c of commissions || []) {
    earningsById[c.affiliate_id] = (earningsById[c.affiliate_id] || 0) + (Number(c.commission_amount) || 0);
  }
  const referralsById = {};
  for (const r of referrals || []) {
    referralsById[r.referred_by] = (referralsById[r.referred_by] || 0) + 1;
  }
  const clicksById = {};
  const conversionsById = {};
  for (const c of clickRows || []) {
    clicksById[c.affiliate_id] = (clicksById[c.affiliate_id] || 0) + 1;
    if (c.converted_user_id) conversionsById[c.affiliate_id] = (conversionsById[c.affiliate_id] || 0) + 1;
  }

  const activeClientsById = {};
  await Promise.all(
    ids.map(async (id) => {
      activeClientsById[id] = await getActiveClientsCount(admin, id);
    })
  );

  function maskName(a, index) {
    if (showNames) return a.username || "مسوّق";
    return `مسوّق #${(a.affiliate_code || a.id).toString().slice(0, 4).toUpperCase()}`;
  }

  const base = (affiliates || []).map((a) => {
    const clicks = clicksById[a.id] || 0;
    const conversions = conversionsById[a.id] || 0;
    return {
      id: a.id,
      displayName: maskName(a),
      totalEarned: Math.round((earningsById[a.id] || 0) * 100) / 100,
      referrals: referralsById[a.id] || 0,
      activeClients: activeClientsById[a.id] || 0,
      clicks,
      conversions,
      conversionRate: clicks > 0 ? Math.round((conversions / clicks) * 1000) / 10 : 0,
    };
  });

  function rankBy(key) {
    return [...base]
      .sort((a, b) => b[key] - a[key])
      .slice(0, 20)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }

  const leaderboard = {
    earnings: rankBy("totalEarned"),
    clients: rankBy("activeClients"),
    conversion: rankBy("conversionRate"),
  };

  const myBase = base.find((r) => r.id === user.id);
  const myRank = myBase
    ? {
        earningsRank: [...base].sort((a, b) => b.totalEarned - a.totalEarned).findIndex((r) => r.id === user.id) + 1,
        clientsRank: [...base].sort((a, b) => b.activeClients - a.activeClients).findIndex((r) => r.id === user.id) + 1,
        ...myBase,
      }
    : null;

  return NextResponse.json({ leaderboard, myRank, showNames });
}
