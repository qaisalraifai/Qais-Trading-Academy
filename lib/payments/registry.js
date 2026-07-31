// سجل مزوّدي الدفع (Payment Gateway Registry)
// ==============================================
// كل مزوّد هو Adapter مستقل بمجلد lib/payments/adapters، وكلهم بيلتزموا
// بنفس الواجهة (Interface) تحت. الإضافة/الحذف المستقبلي = ملف جديد هون +
// صف جديد بجدول payment_providers، بدون تعديل أي مكان تاني بالنظام.
//
// واجهة الـ Adapter (كل حقل اختياري إلا ما هو محدد "مطلوب"):
//   code               : string (مطلوب) — لازم يطابق عمود code بجدول payment_providers
//   supportsAutoRenew  : boolean (مطلوب)
//   createCheckout({ user, invoice, plan, config }) => Promise<CheckoutResult> (مطلوب)
//       CheckoutResult حسب النوع:
//         { mode: "redirect", url }                  — تحويل كامل لصفحة خارجية
//         { mode: "embed", sessionId, extra }         — عنصر مضمّن بالصفحة (متل Whop iframe)
//         { mode: "manual", wallets, instructions }   — دفع يدوي (يعرض بيانات التحويل)
//   verifyAndParseWebhook(request) => Promise<NormalizedEvent | null>  — للمزوّدات اللي عندها Webhook
//   cancelSubscription(externalRef) => Promise<void>  — اختياري

import { createAdminClient } from "@/lib/supabase-server";
import { whopAdapter } from "./adapters/whop-adapter";
import { manualUsdtAdapter } from "./adapters/manual-usdt-adapter";
import { nowPaymentsAdapter } from "./adapters/nowpayments-adapter";

// كل الـ Adapters المتوفرة بالكود (مش بالضرورة كلها مفعّلة — التفعيل من جدول
// payment_providers عبر لوحة تحكم الأدمن)
const ADAPTERS = {
  whop: whopAdapter,
  manual_usdt: manualUsdtAdapter,
  nowpayments: nowPaymentsAdapter,
};

export function getAdapter(code) {
  return ADAPTERS[code] || null;
}

/** يرجّع كل مزوّدي الدفع المفعّلين من الداتابيس، مرتبين للعرض بصفحة الدفع */
export async function listEnabledProviders(adminClient) {
  const admin = adminClient || createAdminClient();
  const { data, error } = await admin
    .from("payment_providers")
    .select("code, name, type, supports_auto_renew, sort_order, description")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("listEnabledProviders failed:", error.message);
    return [];
  }
  // نستبعد أي مزوّد مسجّل بالداتابيس بس ما إله Adapter فعلي بالكود بعد
  return (data || []).filter((p) => Boolean(ADAPTERS[p.code]));
}

/** يرجّع صف المزوّد كامل من الداتابيس (يشمل config) + يتأكد إنه مفعّل */
export async function getProviderRow(code, adminClient) {
  const admin = adminClient || createAdminClient();
  const { data, error } = await admin
    .from("payment_providers")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) {
    console.error("getProviderRow failed:", error.message);
    return null;
  }
  return data;
}
