// سقوف العمولات اليومية/الشهرية (الفصل 30 من الخطة)
// بتحمي من كارثة مالية لو صار خلل بمحرك العمولات (حلقة لا نهائية، خطأ
// حسابي...) — الحد الأقصى بيجي من جدول ranks (daily_commission_cap /
// monthly_commission_cap) حسب رتبة المستفيد. لو مفيش حد محدد لرتبته، ما في سقف.

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * تتأكد إنه دفع مبلغ "amount" ما بيتخطى سقف اليوم/الشهر لصاحب هالرتبة.
 * ترجع المبلغ الفعلي المسموح دفعه (ممكن يكون أقل من المطلوب أو صفر).
 * وبتحدّث commission_caps_usage بنفس العملية.
 */
export async function applyCommissionCap(supabaseAdmin, beneficiaryId, requestedAmount) {
  if (!requestedAmount || requestedAmount <= 0) return 0;

  const { data: member } = await supabaseAdmin
    .from("profiles")
    .select("ranks:rank_id (daily_commission_cap, monthly_commission_cap)")
    .eq("id", beneficiaryId)
    .maybeSingle();

  const dailyCap = member?.ranks?.daily_commission_cap;
  const monthlyCap = member?.ranks?.monthly_commission_cap;

  // ما في سقف محدد لرتبته — بيمر المبلغ كامل
  if (!dailyCap && !monthlyCap) return requestedAmount;

  const today = todayKey();
  const monthStart = today.slice(0, 7) + "-01";

  const { data: usageRow } = await supabaseAdmin
    .from("commission_caps_usage")
    .select("daily_total, monthly_total")
    .eq("user_id", beneficiaryId)
    .eq("usage_date", today)
    .maybeSingle();

  // مجموع الشهر الحالي (كل صفوف الشهر لهاد المستخدم)
  const { data: monthRows } = await supabaseAdmin
    .from("commission_caps_usage")
    .select("monthly_total")
    .eq("user_id", beneficiaryId)
    .gte("usage_date", monthStart);

  const currentDaily = Number(usageRow?.daily_total || 0);
  // monthly_total بكل صف يومي مخزّن تراكميًا لنفس اليوم بس؛ الأصح نجمع كل الأيام
  const currentMonthly = (monthRows || []).reduce((sum, r) => sum + Number(r.monthly_total || 0), 0);

  let allowedAmount = requestedAmount;
  if (dailyCap) allowedAmount = Math.min(allowedAmount, Math.max(0, dailyCap - currentDaily));
  if (monthlyCap) allowedAmount = Math.min(allowedAmount, Math.max(0, monthlyCap - currentMonthly));

  allowedAmount = Math.round(allowedAmount * 100) / 100;
  if (allowedAmount <= 0) return 0;

  // كل صف بالجدول يمثّل يوم واحد — monthly_total بنفس الصف لازم يعكس مجموع
  // اليوم نفسه (زي daily_total بالظبط)، لأنه مجموع الشهر = مجموع كل الأيام
  const newDaily = currentDaily + allowedAmount;
  await supabaseAdmin
    .from("commission_caps_usage")
    .upsert(
      { user_id: beneficiaryId, usage_date: today, daily_total: newDaily, monthly_total: newDaily },
      { onConflict: "user_id,usage_date" }
    );

  return allowedAmount;
}
