import { createAdminClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { placeNewMember } from "@/lib/binary-tree";
import { logActivity } from "@/lib/activity-log";
import { checkFraudBeforeSignup, recordSignupFingerprint } from "@/lib/fraud-checks";

// ينشئ صف profiles مباشرة بعد supabase.auth.signUp()، باستخدام Service Role
// (يتجاوز RLS تماماً) — لأنه بلحظة التسجيل المستخدم لسا ممكن يكون بدون
// session نشطة (لو تفعيل الإيميل مطلوب)، وبالتالي أي insert/upsert من
// المتصفح (anon/authenticated الوهمي) ممكن يفشل بصمت بسبب RLS.
export async function POST(request) {
  const { userId, username, ref, deviceFingerprint } = await request.json();

  if (!userId || !username) {
    return NextResponse.json(
      { error: "بيانات ناقصة" },
      { status: 400 }
    );
  }

  // خطة الشجرة الثنائية: التسجيل بدون كود دعوة (راعي) غير مسموح
  if (!ref) {
    return NextResponse.json(
      { error: "لازم كود دعوة صحيح للتسجيل" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // منع الغش (الفصل 12): بصمة جهاز مطابقة = حجب فوري. نفس الـIP فقط = علامة اشتباه بدون حجب
  const requestIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  let fraudCheck;
  try {
    fraudCheck = await checkFraudBeforeSignup(supabase, { deviceFingerprint, ip: requestIp });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  // نتأكد إنه المستخدم فعلاً موجود بجدول auth.users بهاد الـ id
  // (حماية بسيطة من إساءة استخدام هاد الـ endpoint)
  const { data: authUser, error: authError } =
    await supabase.auth.admin.getUserById(userId);

  if (authError || !authUser?.user) {
    return NextResponse.json(
      { error: "مستخدم غير صالح" },
      { status: 400 }
    );
  }

  // لازم نتحقق إنه كود الدعوة فعلاً يعود لمسوّق موجود ومفعّل — وما بنسمح
  // إنه الشخص يحيل نفسه. هاد الراعي (sponsor) هو نفسه اللي رح يُستخدم
  // بمحرك وضع الشجرة الثنائية تحت.
  const { data: affiliate } = await supabase
    .from("profiles")
    .select("id, affiliate_status")
    .eq("affiliate_code", ref.trim())
    .maybeSingle();

  if (!affiliate || affiliate.affiliate_status !== "approved" || affiliate.id === userId) {
    return NextResponse.json(
      { error: "كود الدعوة غير صحيح أو غير مفعّل" },
      { status: 400 }
    );
  }

  const referredBy = affiliate.id;

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        username: username.trim(),
        role: "student",
        subscription_status: "inactive",
        referred_by: referredBy,
      },
      { onConflict: "id", ignoreDuplicates: false }
    );

  if (profileError) {
    console.error("create-profile upsert failed:", profileError);
    return NextResponse.json(
      { error: profileError.message },
      { status: 400 }
    );
  }

  // وضع العضو الجديد بالشجرة الثنائية تحت راعيه (أقرب مكان فاضٍ بشجرته)
  try {
    await placeNewMember(supabase, userId, referredBy);
  } catch (e) {
    console.error("placeNewMember failed:", e.message);
    // ما منفشل التسجيل كله بسبب هيك — الحساب موجود ومربوط بالراعي (referred_by)،
    // بس بدون مكان بالشجرة. لازم يتحل يدوياً من الأدمن أو retry لاحقاً.
    await logActivity(userId, "note", "⚠️ فشل وضع العضو بالشجرة الثنائية", {
      error: e.message,
    }).catch(() => {});
  }

  await recordSignupFingerprint(supabase, userId, {
    deviceFingerprint,
    ip: requestIp,
    suspicious: fraudCheck.suspicious,
    reason: fraudCheck.reason,
  }).catch((e) => console.error("recordSignupFingerprint failed:", e.message));

  // لو اجى عن طريق رابط تتبّع /r/[code]، منربط النقرة الأصلية بهاد الحساب الجديد
  // (Conversion Funnel: نقرة → تسجيل) عن طريق cookie الـ click id يلي حطيناها بـ /r/[code].
  try {
    const clickId = request.cookies.get("qta_click_id")?.value;
    if (clickId) {
      await supabase
        .from("affiliate_clicks")
        .update({ converted_user_id: userId, converted_at: new Date().toISOString() })
        .eq("id", clickId)
        .is("converted_user_id", null);
    }
  } catch (e) {
    console.error("click conversion link failed:", e.message);
  }

  if (referredBy) {
    await createNotification(supabase, referredBy, {
      type: "referral_joined",
      title: "👋 عضو جديد بشبكتك",
      message: `${username.trim()} سجّل حساب عن طريق رابطك — العمولة بتتسجل تلقائياً أول ما يدفع اشتراكه`,
      link: "/affiliate",
    });
  }

  return NextResponse.json({ success: true });
}
