// محرك المستويات — ديناميكي بالكامل. المستوى الحالي لأي مسوّق يُحسب حيًّا
// من عدد عملائه النشطين حالياً، وما بينخزن كـ "حالة ثابتة" بأي مكان —
// هيك دايماً بيعكس الواقع (لو قلّ نشيطه بيرجع لمستوى أقل تلقائياً).

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

/** يحدد المستوى الحالي + المستوى القادم + كم ناقص للوصول له */
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

  return { current, next, remaining, progressPct };
}

/** يجيب المستوى الحالي الكامل لمسوّق معيّن (استعلام + حساب بخطوة وحدة) */
export async function getAffiliateTierStatus(admin, affiliateId) {
  const [activeClientsCount, tiers] = await Promise.all([
    getActiveClientsCount(admin, affiliateId),
    getAllTiers(admin),
  ]);
  return { activeClientsCount, tiers, ...resolveTier(activeClientsCount, tiers) };
}

/**
 * تُستدعى بعد أي تغيّر بحالة اشتراك عميل مُحال (تجديد/إلغاء/انتهاء) —
 * تفحص هل تغيّر مستوى راعيه عن آخر مرة انبعث فيها إشعار، وترسل إشعار
 * ترقية لو صعد لمستوى أعلى. ما بترسل إشعار عند التراجع (تفادي إحباط
 * غير ضروري) — بس المستوى المعروض بالواجهة بيضل حقيقي دايمًا.
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

  // نبعث إشعار ترقية بس لو المستوى الجديد أعلى من القديم (أو أول مستوى)
  const { data: tiersOrdered } = await admin
    .from("affiliate_tiers")
    .select("code, sort_order")
    .order("sort_order", { ascending: true });

  const oldRank = tiersOrdered?.find((t) => t.code === lastCode)?.sort_order ?? -1;
  const newRank = tiersOrdered?.find((t) => t.code === current.code)?.sort_order ?? 0;

  if (newRank > oldRank && lastCode) {
    await createNotification(admin, affiliateId, {
      type: "tier_upgrade",
      title: `${current.badge_icon} ترقيت لمستوى ${current.title_ar}!`,
      message: `عندك حالياً ${activeClientsCount} عميل نشط — استمر هيك 🚀`,
      link: "/affiliate",
    }).catch(() => {});
  }
}
