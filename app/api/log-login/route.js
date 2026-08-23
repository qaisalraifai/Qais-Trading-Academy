import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { logActivity, getClientIp, parseDevice, lookupCountry } from "@/lib/activity-log";

/* ============================================================================
   يُستدعى من صفحة /login مباشرة بعد نجاح تسجيل الدخول (من المتصفح)
   بيسجل IP + الجهاز + يزيد عداد الدخول + يضيف سطر بالـ Timeline.

   ---------------------------------------------------------------------------
   ⚠️ **كان مكشوفاً: كتابة على بروفايل أي مستخدم بلا مصادقة.**

   الهوية كانت تُقرأ من **جسم الطلب** (`{ userId }`) وتُستعمل مع **مفتاح
   الخدمة** — يعني بلا أي فحص جلسة، وبتجاوز كامل لصلاحيات قاعدة البيانات.
   أي حدا بيعرف (أو بيخمّن) معرّف مستخدم كان يقدر يبعت طلباً واحداً ويكتب
   على صفّه:

       last_login_at · last_login_ip · last_device · login_count · country
       + سطر «تسجيل دخول» بسجل النشاط منسوب إله

   يعني تزوير سجلّ الدخول والأمان لأي حساب: IP وجهاز وبلد ووقت ما إلهم علاقة
   بصاحب الحساب — وهاد بالضبط السجلّ اللي بينبنى عليه أي تحقيق لاحق. وكمان
   تضخيم `login_count` بلا حد، وتأكيد وجود معرّفات مستخدمين.

   الإصلاح: الهوية من **الجلسة** حصراً، والجسم بينتجاهل تماماً. المنادي
   (`app/login/page.js`) بينده بعد `signInWithPassword` فالكوكي موجود أصلاً،
   فما تغيّر شي بتجربة المستخدم.

   ⚠️ ومفتاح الخدمة ضلّ مستعملاً للكتابة عن قصد — الكتابة على `login_count`
   و`last_login_ip` مش مسموحة للمستخدم نفسه بصلاحياته العادية، وهاد صح:
   ما بدنا الحساب يقدر يعدّل سجلّ أمانه بنفسه. الفرق إنه صار **مربوطاً
   بهويته المتحققة** بدل هوية بيدّعيها.
   ============================================================================ */
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const userId = user.id;
  const ip = getClientIp(request);
  const device = parseDevice(request.headers.get("user-agent"));
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("login_count, country")
    .eq("id", userId)
    .maybeSingle();

  const country = profile?.country || (await lookupCountry(ip));

  await admin
    .from("profiles")
    .update({
      last_login_at: new Date().toISOString(),
      last_login_ip: ip,
      last_device: device,
      login_count: (profile?.login_count || 0) + 1,
      ...(country ? { country } : {}),
    })
    .eq("id", userId);

  await logActivity(userId, "login", "تسجيل دخول", { ip, device });

  return NextResponse.json({ success: true });
}
