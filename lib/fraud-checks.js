// منع الغش (الفصل 12 و23 من الخطة)
// قاعدة: بصمة الجهاز (Device Fingerprint) مطابقة = حجب فوري (شبه مستحيل
// يصير بالصدفة). نفس الـIP بس = ما بنحجب (ممكن عيلة / شبكة جامعة / VPN
// شركة)، بس منعلّم الحساب "مشبوه" حتى الأدمن يراجعه يدويًا (متل ما يطلب
// الفصل 12: "مراجعة يدوية للحسابات المشبوهة").

/**
 * تتحقق قبل إنشاء أي حساب جديد. ترمي Error لو في تطابق بصمة جهاز (حجب حقيقي).
 * ترجع { suspicious: boolean, reason } لو بس نفس الـIP (بدون حجب).
 */
export async function checkFraudBeforeSignup(supabaseAdmin, { deviceFingerprint, ip }) {
  if (deviceFingerprint) {
    const { data: sameDevice } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("device_fingerprint", deviceFingerprint)
      .limit(1)
      .maybeSingle();

    if (sameDevice) {
      throw new Error("تم رصد حساب سابق بنفس الجهاز. تواصل مع الدعم لو هاد خطأ.");
    }
  }

  if (ip) {
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("registration_ip", ip);

    if ((count || 0) >= 2) {
      return { suspicious: true, reason: `أكثر من حسابين اتسجلوا من نفس الـIP (${ip})` };
    }
  }

  return { suspicious: false, reason: null };
}

/** تُستدعى بعد إنشاء الحساب لتسجيل بصمة الجهاز والـIP + علامة الاشتباه لو في */
export async function recordSignupFingerprint(supabaseAdmin, userId, { deviceFingerprint, ip, suspicious, reason }) {
  await supabaseAdmin
    .from("profiles")
    .update({
      device_fingerprint: deviceFingerprint || null,
      registration_ip: ip || null,
      is_flagged_suspicious: !!suspicious,
      flagged_reason: reason || null,
    })
    .eq("id", userId);
}
