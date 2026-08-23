import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { getActiveClientsCount, getCancelledClientsCount } from "@/lib/tiers";

// GET /api/affiliate/growth-stats — عدد العملاء النشطين بمرور الوقت (آخر 30 يوم من
// اللقطات اليومية) + معدل الاحتفاظ/الإلغاء الحالي.
export async function GET() {
  const supabase = await createClient();
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
    return NextResponse.json({ activeClientsSeries: [], retentionRate: 0, churnRate: 0 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const { data: snapshots } = await admin
    .from("affiliate_stats_snapshots")
    .select("snapshot_date, active_clients, cancelled_clients")
    .eq("affiliate_id", user.id)
    .gte("snapshot_date", thirtyDaysAgo)
    .order("snapshot_date", { ascending: true });

  const activeClientsSeries = (snapshots || []).map((s) => ({
    label: s.snapshot_date.slice(5),
    key: s.snapshot_date,
    total: s.active_clients,
  }));

  const [activeNow, cancelledNow] = await Promise.all([
    getActiveClientsCount(admin, user.id),
    getCancelledClientsCount(admin, user.id),
  ]);

  const everReferred = activeNow + cancelledNow;
  const retentionRate = everReferred > 0 ? Math.round((activeNow / everReferred) * 1000) / 10 : 0;
  const churnRate = everReferred > 0 ? Math.round((cancelledNow / everReferred) * 1000) / 10 : 0;

  return NextResponse.json({ activeClientsSeries, retentionRate, churnRate, activeNow, cancelledNow });
}
