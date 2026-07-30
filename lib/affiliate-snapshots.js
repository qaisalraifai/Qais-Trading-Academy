// يسجّل "لقطة" يومية لكل مسوّق معتمد (عدد عملاء نشطين + ملغيين + إجمالي
// أرباح تاريخي) — هاي اللقطات هي يلي بتغذّي رسوم "بمرور الوقت" ومعدلات
// الاحتفاظ/الإلغاء بصفحة الإحصائيات، لأنه هاي الأرقام (خصوصاً "نشط حالياً")
// ما فيها تُحسب رجعيًا من البيانات الحالية بس — لازم نأرشفها يوميًا.
//
// تُستدعى من app/api/cron/route.js (نفس الكرون اليومي الموجود أصلاً).

import { getActiveClientsCount, getCancelledClientsCount } from "@/lib/tiers";

export async function recordDailySnapshots(admin) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: affiliates } = await admin
    .from("profiles")
    .select("id")
    .eq("affiliate_status", "approved");

  let recorded = 0;
  for (const a of affiliates || []) {
    const [activeClients, cancelledClients] = await Promise.all([
      getActiveClientsCount(admin, a.id),
      getCancelledClientsCount(admin, a.id),
    ]);

    const { data: commissions } = await admin
      .from("commissions")
      .select("commission_amount")
      .eq("affiliate_id", a.id);
    const totalEarned = (commissions || []).reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);

    const { error } = await admin.from("affiliate_stats_snapshots").upsert(
      {
        affiliate_id: a.id,
        snapshot_date: today,
        active_clients: activeClients,
        cancelled_clients: cancelledClients,
        total_earned: totalEarned,
      },
      { onConflict: "affiliate_id,snapshot_date" }
    );

    if (!error) recorded += 1;
  }

  return { recorded, total: (affiliates || []).length };
}
