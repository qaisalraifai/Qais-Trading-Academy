import { createAdminClient } from "@/lib/supabase-server";

/**
 * يسجل إشعار لمستخدم معيّن. نفس الجدول بيغذّي مركز الإشعارات (Bell)
 * وقسم "آخر النشاطات" بصفحة المسوّق — مصدر واحد بدل تكرار المنطق.
 * type أمثلة: commission | badge | wheel_spin | wheel_credit | referral_joined |
 *             application_approved | application_rejected | payout
 */
export async function createNotification(adminClient, userId, { type, title, message = "", link = null }) {
  if (!userId || !type || !title) return;
  const supabase = adminClient || createAdminClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message,
    link,
  });
  if (error) console.error("createNotification failed:", error.message);
}
