import { createAdminClient } from "@/lib/supabase-server";

// هاد الراوت بينشغل يومياً (حد Vercel Hobby للـ cron)، بس فعلياً بيسوي شغل حقيقي
// مرة كل payout_cycle_days (افتراضياً 14 يوم = كل أسبوعين) — بيتحقق من آخر مرة اشتغل
// فيها من جدول affiliate_cron_state. لكل مسوّق مفعّل وعنده عمولات pending وصلت
// الحد الأدنى وعنده طريقة استلام محفوظة (PayPal/Wise)، بيجهّز صف payouts بحالة
// "awaiting_transfer" — التحويل الفعلي للفلوس يدوي حالياً (لحد ربط PayPal/Wise API
// الحقيقي بـ lib/affiliate.js -> sendPayoutTransfer).
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: settings } = await supabase.from("affiliate_settings").select("*").eq("id", 1).single();
  const { data: cronState } = await supabase.from("affiliate_cron_state").select("*").eq("id", 1).single();

  const cycleDays = settings?.payout_cycle_days || 14;
  const minPayout = Number(settings?.min_payout_usd) || 0;
  const now = new Date();
  const lastRun = cronState?.last_run_at ? new Date(cronState.last_run_at) : null;

  const dueMs = cycleDays * 24 * 60 * 60 * 1000;
  const isDue = !lastRun || now.getTime() - lastRun.getTime() >= dueMs;

  if (!isDue) {
    return Response.json({ success: true, skipped: true, reason: "not_due_yet", lastRun, cycleDays });
  }

  const periodStart = lastRun || new Date(now.getTime() - dueMs);

  // نجيب كل العمولات المعلّقة، ونجمعها حسب المسوّق
  const { data: pendingCommissions, error: commErr } = await supabase
    .from("commissions")
    .select("id, affiliate_id, commission_amount")
    .eq("status", "pending");

  if (commErr) return Response.json({ error: commErr.message }, { status: 500 });

  const byAffiliate = {};
  for (const c of pendingCommissions || []) {
    if (!byAffiliate[c.affiliate_id]) byAffiliate[c.affiliate_id] = { total: 0, ids: [] };
    byAffiliate[c.affiliate_id].total += Number(c.commission_amount) || 0;
    byAffiliate[c.affiliate_id].ids.push(c.id);
  }

  const affiliateIds = Object.keys(byAffiliate);
  let createdPayouts = 0;
  let skippedBelowMin = 0;
  let skippedNoPayoutMethod = 0;

  if (affiliateIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, affiliate_status, payout_method, payout_details")
      .in("id", affiliateIds);

    const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

    for (const affiliateId of affiliateIds) {
      const { total, ids } = byAffiliate[affiliateId];
      const profile = profileById[affiliateId];

      if (!profile || profile.affiliate_status !== "approved") continue;
      if (total < minPayout) {
        skippedBelowMin++;
        continue;
      }
      if (!profile.payout_method) {
        skippedNoPayoutMethod++;
        continue;
      }

      const { data: payout, error: payoutError } = await supabase
        .from("payouts")
        .insert({
          affiliate_id: affiliateId,
          amount: Math.round(total * 100) / 100,
          method: profile.payout_method,
          payout_details: profile.payout_details || null,
          status: "awaiting_transfer",
          period_start: periodStart.toISOString(),
          period_end: now.toISOString(),
        })
        .select("id")
        .single();

      if (payoutError || !payout) {
        console.error("Failed to create payout for", affiliateId, payoutError?.message);
        continue;
      }

      await supabase.from("commissions").update({ status: "ready", payout_id: payout.id }).in("id", ids);
      createdPayouts++;
    }
  }

  await supabase.from("affiliate_cron_state").update({ last_run_at: now.toISOString() }).eq("id", 1);

  return Response.json({
    success: true,
    createdPayouts,
    skippedBelowMin,
    skippedNoPayoutMethod,
    periodStart,
    periodEnd: now,
  });
}
