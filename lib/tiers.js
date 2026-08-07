// محرك المستويات — ديناميكي بالكامل. المستوى الحالي لأي مسوّق يُحسب حيًّا
// من عدد عملائه النشطين حالياً، وما بينخزن كـ "حالة ثابتة" بأي مكان —
// هيك دايماً بيعكس الواقع (لو قلّ نشيطه بيرجع لمستوى أقل تلقائياً).
//
// كل مستوى إله عمولة فعلية بالدولار (signup_amount / renewal_amount) —
// مو نسبة موحّدة — فالترقية لمستوى أعلى بترفع دخل المسوّق فوراً على
// كل عمليات التسجيل/التجديد الجاية (مو بس الجديدة).

import { createNotification } from "@/lib/notifications";

/** عميل نشط = مُحال من هالمسوّق وحالة اشتراكه فعّالة حالياً */
export async function getActiveClientsCount(admin, affiliateId) {
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", affiliateId)
    .in("subscription_status", ["active", "vip"]);
  return count || 0;
}

/** عدد العملاء الملغيين/المنتهية اشتراكاتهم (كانوا نشطين وتوقفوا) */
export async function getCancelledClientsCount(admin, affiliateId) {
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", affiliateId)
    .in("subscription_status", ["inactive", "expired", "cancelled"]);
  return count || 0;
}

/** يجيب كل المستويات المفعّلة، مرتّبة تصاعدياً حسب الحد الأدنى */
export async function getAllTiers(admin) {
  const { data } = await admin
    .from("affiliate_tiers")
    .select("*")
    .eq("is_active", true)
    .order("min_active_clients", { ascending: true });
  return data || [];
}

/** يحدد المستوى الحالي + المستوى القادم + كم ناقص للوصول له + فرق العمولة */
export function resolveTier(activeClientsCount, tiers) {
  if (!tiers || tiers.length === 0) return { current: null, next: null, remaining: 0, progressPct: 0 };

  let current = tiers[0];
  for (const tier of tiers) {
    if (activeClientsCount >= tier.min_active_clients) current = tier;
    else break;
  }

  const currentIndex = tiers.findIndex((t) => t.id === current.id);
  const next = tiers[currentIndex + 1] || null;

  let remaining = 0;
  let progressPct = 100;
  if (next) {
    remaining = Math.max(0, next.min_active_clients - activeClientsCount);
    const span = next.min_active_clients - current.min_active_clients;
    const progressed = activeClientsCount - current.min_active_clients;
    progressPct = span > 0 ? Math.min(100, Math.max(0, Math.round((progressed / span) * 100))) : 100;
  }

  return {
    current,
    next,
    remaining,
    progressPct,
    signupDelta: next ? Number(next.signup_amount) - Number(current.signup_amount) : 0,
    renewalDelta: next ? Number(next.renewal_amount) - Number(current.renewal_amount) : 0,
  };
}

/**
 * يجيب المستوى الحالي الكامل لمسوّق معيّن + إسقاطات دخل (استعلام + حساب
 * بخطوة وحدة) — هاد المصدر الوحيد اللي بيغذّي كل من: صفحة المستويات،
 * ودجت التقدّم بالداشبورد، ومحرك احتساب العمولات نفسه.
 */
export async function getAffiliateTierStatus(admin, affiliateId) {
  const [activeClientsCount, tiers] = await Promise.all([
    getActiveClientsCount(admin, affiliateId),
    getAllTiers(admin),
  ]);
  const resolved = resolveTier(activeClientsCount, tiers);

  // الدخل المتوقع شهرياً لو استمر بنفس الأداء الحالي بالضبط (عدد العملاء
  // النشطين ثابت) = عملاء نشطين × عمولة التجديد بمستواه الحالي.
  const projectedMonthlyIncome = resolved.current ? activeClientsCount * Number(resolved.current.renewal_amount) : 0;
  const projectedMonthlyIncomeAtNextTier = resolved.next
    ? activeClientsCount * Number(resolved.next.renewal_amount)
    : projectedMonthlyIncome;

  return { activeClientsCount, tiers, ...resolved, projectedMonthlyIncome, projectedMonthlyIncomeAtNextTier };
}

/**
 * أخف نسخة — تُستخدم وقت احتساب عمولة فعلية (تسجيل/تجديد) بدون جلب كل
 * المستويات وبيانات العرض. بترجع بس المستوى الحالي وقيم عمولته.
 */
export async function getCurrentTierRates(admin, affiliateId) {
  const [activeClientsCount, tiers] = await Promise.all([
    getActiveClientsCount(admin, affiliateId),
    getAllTiers(admin),
  ]);
  const { current } = resolveTier(activeClientsCount, tiers);
  if (!current) return { tierId: null, tierCode: "bronze", signupAmount: 30, renewalAmount: 8 };
  return {
    tierId: current.id,
    tierCode: current.code,
    tierTitle: current.title_ar,
    signupAmount: Number(current.signup_amount),
    renewalAmount: Number(current.renewal_amount),
  };
}

/**
 * تُستدعى بعد أي تغيّر بحالة اشتراك عميل مُحال (تجديد/إلغاء/انتهاء) —
 * تفحص هل تغيّر مستوى راعيه عن آخر مرة انبعث فيها إشعار، وترسل إشعار
 * ترقية لو صعد لمستوى أعلى (مع فرق العمولة الجديد بالإشعار نفسه —
 * أقوى تحفيز من رقم مجرّد). ما بترسل إشعار عند التراجع.
 */
export async function syncAffiliateTier(admin, affiliateId) {
  if (!affiliateId) return;

  const { current, activeClientsCount } = await getAffiliateTierStatus(admin, affiliateId);
  if (!current) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("last_notified_tier_code")
    .eq("id", affiliateId)
    .maybeSingle();

  const lastCode = profile?.last_notified_tier_code;
  if (lastCode === current.code) return;

  // نحدّث السجل دايمًا (حتى لو تراجع) عشان ما نكرر إشعار لما يطلع وينزل بنفس النطاق
  await admin.from("profiles").update({ last_notified_tier_code: current.code }).eq("id", affiliateId);

  const { data: tiersOrdered } = await admin
    .from("affiliate_tiers")
    .select("code, sort_order, signup_amount, renewal_amount")
    .order("sort_order", { ascending: true });

  const oldTier = tiersOrdered?.find((t) => t.code === lastCode);
  const newTier = tiersOrdered?.find((t) => t.code === current.code);
  const oldRank = oldTier?.sort_order ?? -1;
  const newRank = newTier?.sort_order ?? 0;

  if (newRank > oldRank && lastCode) {
    const renewalNote = oldTier
      ? ` عمولة التجديد صارت $${Number(newTier.renewal_amount)} بدل $${Number(oldTier.renewal_amount)} — على كل عملائك.`
      : "";
    await createNotification(admin, affiliateId, {
      type: "tier_upgrade",
      title: `ترقيت لمستوى ${current.title_ar}`,
      message: `عندك حالياً ${activeClientsCount} عميل نشط.${renewalNote}`,
      link: "/affiliate/tiers",
    }).catch(() => {});
  }
}
