// منطق نظام التسويق بالعمولة (Affiliate) — 3 مستويات
// يُستخدم من: webhook الدفع (لتسجيل العمولات) وcron الصرف (لتجهيز الدفعات)

import { createNotification } from "@/lib/notifications";
import { checkAndAwardBadges } from "@/lib/badges";
import { trackReferralForWheel } from "@/lib/bonus-wheel";

// يولّد كود مسوّق فريد قصير من اسم المستخدم + رقم عشوائي
export function generateAffiliateCode(username) {
  const base = (username || "AFF")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\u0600-\u06FF]/g, "")
    .slice(0, 8) || "AFF";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

/**
 * بعد أي دفعة ناجحة، يحسب ويسجل عمولات المستويات الثلاثة (لو موجودة) بحالة "pending".
 * supabaseAdmin: عميل Service Role
 * paidUserId: id المستخدم يلي دفع
 * paymentId: id صف payments يلي انسجل
 * amount: قيمة الدفعة بالدولار
 */
export async function recordCommissionsForPayment(supabaseAdmin, { paidUserId, paymentId, amount }) {
  if (!paidUserId || !amount || amount <= 0) return;

  const { data: settings } = await supabaseAdmin
    .from("affiliate_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (!settings) return;

  const percentsByLevel = {
    1: Number(settings.level1_percent) || 0,
    2: Number(settings.level2_percent) || 0,
    3: Number(settings.level3_percent) || 0,
  };

  // نطلع من المستخدم يلي دفع، ونصعد بسلسلة referred_by لحد 3 مستويات
  let currentUserId = paidUserId;
  const rows = [];

  for (let level = 1; level <= 3; level++) {
    const { data: currentProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, referred_by")
      .eq("id", currentUserId)
      .maybeSingle();

    const uplineId = currentProfile?.referred_by;
    if (!uplineId) break;

    const { data: uplineProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, is_affiliate, affiliate_status")
      .eq("id", uplineId)
      .maybeSingle();

    if (uplineProfile && uplineProfile.is_affiliate && uplineProfile.affiliate_status === "approved") {
      const percent = percentsByLevel[level] || 0;
      if (percent > 0) {
        const commissionAmount = Math.round(((amount * percent) / 100) * 100) / 100;
        if (commissionAmount > 0) {
          rows.push({
            affiliate_id: uplineProfile.id,
            source_user_id: paidUserId,
            payment_id: paymentId || null,
            level,
            percent,
            payment_amount: amount,
            commission_amount: commissionAmount,
            status: "pending",
          });
        }
      }
    }

    currentUserId = uplineId; // نكمل نصعد للمستوى الجاي بغض النظر إذا هاد الشخص مسوّق مفعّل ولا لأ
  }

  if (rows.length > 0) {
    const { error } = await supabaseAdmin.from("commissions").insert(rows);
    if (error) console.error("recordCommissionsForPayment insert failed:", error.message);
    if (!error) {
      await notifyAndGrowAffiliates(supabaseAdmin, rows);
    }
  }
}

/**
 * بعد تسجيل العمولات بنجاح: تبعث إشعار لكل مسوّق استفاد، وتحدّث تقدّم عجلة
 * البونص الشهرية لأصحاب المستوى 1 (إحالة مباشرة دفعت)، وتفحص استحقاق شارات جديدة.
 * ما بتوقف تسجيل العمولة الأساسي لو صار خطأ هون — هاي طبقة "نمو" إضافية فقط.
 */
async function notifyAndGrowAffiliates(supabaseAdmin, commissionRows) {
  try {
    const affiliateIdsTouched = new Set();

    for (const row of commissionRows) {
      await createNotification(supabaseAdmin, row.affiliate_id, {
        type: "commission",
        title: "💰 عمولة جديدة",
        message: `حصلت على $${Number(row.commission_amount).toFixed(2)} عمولة مستوى ${row.level}`,
        link: "/affiliate",
      });

      if (row.level === 1) {
        await trackReferralForWheel(supabaseAdmin, row.affiliate_id);
      }

      affiliateIdsTouched.add(row.affiliate_id);
    }

    for (const affiliateId of affiliateIdsTouched) {
      await checkAndAwardBadges(supabaseAdmin, affiliateId);
    }
  } catch (e) {
    console.error("notifyAndGrowAffiliates failed:", e.message);
  }
}

/**
 * نقطة الربط لتحويل الفلوس فعلياً للمسوّق (PayPal Payouts / Wise API).
 * حالياً: مش موصولة بأي بوابة دفع فعلية — بترجع "manual" وبتخلي الحالة awaiting_transfer
 * حتى يحوّل الأدمن يدوياً ويأشرها "تم الدفع". لما يجهز حساب PayPal/Wise، هون بالضبط
 * مكان إضافة استدعاء الـ API الحقيقي (PayPal Payouts API أو Wise Transfers API).
 */
export async function sendPayoutTransfer(payout) {
  // TODO: ربط PayPal Payouts API أو Wise API هون لما يصير الحساب جاهز.
  // مثال مستقبلي: await paypalPayoutsClient.send({ email: payout.payout_details.email, amount: payout.amount })
  return { success: false, mode: "manual", reason: "no_payout_provider_connected" };
}
