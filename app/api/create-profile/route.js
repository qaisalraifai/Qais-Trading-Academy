import { createAdminClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { optionalUserId } from "@/lib/api-auth";
import { signupOwnershipVerdict, SIGNUP_VERDICT } from "@/lib/signup-guard";
import { createNotification } from "@/lib/notifications";
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
  const { data: authUser, error: authError } =
    await supabase.auth.admin.getUserById(userId);

  if (authError || !authUser?.user) {
    return NextResponse.json(
      { error: "مستخدم غير صالح" },
      { status: 400 }
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     🔴 **إثبات إنّ المنادي صاحب الـ`userId` — بلا ما نشترط جلسة.**
     ---------------------------------------------------------------------
     المسار بياخد `userId` من **جسم الطلب** ويشتغل بمفتاح الخدمة. وما بيقدر
     يشترط جلسة، لأنه بينندى بعد `signUp()` مباشرة — ولما تفعيل الإيميل
     مطلوب، `signUp` بترجّع مستخدماً **بلا جلسة**. (المسار الحيّ:
     `app/signup/page.js` → signUp → هون → signInWithPassword → /payment.)

     و`getUserById` لحاله **ما بيثبت الملكية** — بيثبت إنّ المعرّف موجود وبس.
     فأي حدا بيعرف معرّف مستخدم ما إله بروفايل كان يقدر يحجزله اسماً ويربطه
     بكود إحالته (سرقة عمولة). مقيس فعلياً بالجولة الماضية.

     بوابتان، والأقوى بتسبق:

     ١) **جلسة موجودة → لازم تطابق.** لما تفعيل الإيميل مطفي، `signUp` بتعطي
        جلسة فوراً — فهاد إثبات كامل، ومجاني.

     ٢) **ما في جلسة → الحساب لازم يكون **جديد جداً**.** المعرّف UUIDv4
        عشوائي، فما بينعرف إلا لمين أنشأه. ربطه بنافذة دقائق معناها إنّ
        المهاجم لازم **يخمّن UUID عشوائياً أُنشئ قبل دقائق** — وهاد مش قابل
        للتنفيذ عملياً. أما معرّف حساب قديم (اللي كان الخطر الحقيقي) فبينرفض.

     ⚠️ `null` من `optionalUserId` معناها «ما قدرنا نتأكد» مش «مش صاحبه» —
     كوكي مكسور أو خادم ما ردّ بينزلوا لبوابة الحداثة، ما بينرفضوا مباشرة.
     ═══════════════════════════════════════════════════════════════════════ */
  const verdict = signupOwnershipVerdict({
    sessionUserId: await optionalUserId(),
    requestedUserId: userId,
    createdAt: authUser.user.created_at,
  });

  if (verdict === SIGNUP_VERDICT.SESSION_MISMATCH) {
    console.error("create-profile: جلسة بتخالف userId المطلوب");
    return NextResponse.json(
      { error: "الطلب ما بيطابق الجلسة", code: "SESSION_MISMATCH" },
      { status: 403 }
    );
  }

  if (verdict === SIGNUP_VERDICT.WINDOW_EXPIRED) {
    console.error("create-profile: حساب مش جديد وبلا جلسة — مرفوض");
    return NextResponse.json(
      { error: "انتهت مهلة إعداد الحساب — سجّل دخول وحاول من جديد", code: "SIGNUP_WINDOW_EXPIRED" },
      { status: 403 }
    );
  }

  // لازم نتحقق إنه كود الدعوة فعلاً يعود لمسوّق موجود ومفعّل — وما بنسمح
  // إنه الشخص يحيل نفسه. referred_by هاد هو الراعي المباشر يلي بتتحدد عليه
  // كل عمولات الإحالة (تسجيل/تجديد) بالنظام الجديد.
  //
  // لو ما في كود دعوة إطلاقاً (سجّل مباشرة بدون رابط)، referred_by بتضل
  // فاضية — حساب عادي بدون راعي، وما حدا ياخد عمولة عنه. هاد مختلف عن
  // النظام القديم يلي كان يفرض راعي افتراضي (كان لازم للشجرة الثنائية،
  // ما إلها داعي هلأ بعد إلغائها).
  let referredBy = null;
  if (ref) {
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

    referredBy = affiliate.id;
  } else {
    // لو فعلاً ما في ولا صف بجدول profiles إطلاقاً، هاد المستخدم بيصير
    // تلقائياً هو الأدمن الجذر (تنصيب جديد كامل للمنصة).
    const { count: totalProfiles, error: countError } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    /* 🔴 **رفع صلاحية بلا مصادقة — كان مفتوحاً من بابين.**
       -------------------------------------------------------------------
       هالفرع بيكتب `role: "admin"` وهو على مسار **بلا مصادقة**. كان:

           if (!totalProfiles || totalProfiles === 0) {
             await supabase.from("profiles").upsert({ …role:"admin" },
                                     { onConflict:"id", ignoreDuplicates:false })

       ١) `!totalProfiles` بتتحقق على **`null`** كمان — و`null` معناها
          **الاستعلام فشل**، مش «الجدول فاضي». يعني عطل لحظي بالعدّ = الفرع
          بينفتح على منصّة فيها مستخدمين.
       ٢) `upsert` بـ`ignoreDuplicates:false` **بتكتب فوق صف موجود**. وهاد
          بالضبط النمط اللي انشال من الـinsert الرئيسي تحت لنفس السبب.

       الاتنين مع بعض: أي حدا بيعرف معرّف مستخدم حقيقي، بلحظة يفشل فيها
       العدّ، بيكتب `role:"admin"` على أي صف.

       الإصلاح — **الفشل مقفول** بالاتجاهين:
       · العدّ لازم ينجح ويطلع **صفر بالضبط**. ما تأكدنا؟ ما منكمّل.
       · `insert` بدل `upsert`: الصف الموجود ما بينلمس مهما صار. */
    if (countError) {
      console.error("create-profile: فشل عدّ profiles — ما منفتح فرع الأدمن الجذر:", countError);
      return NextResponse.json(
        { error: "تعذّر إكمال التسجيل، جرّب بعد شوي", code: "PROFILE_COUNT_FAILED" },
        { status: 503 }
      );
    }

    if (totalProfiles === 0) {
      const { error: rootProfileError } = await supabase.from("profiles").insert({
        id: userId,
        username: username.trim(),
        role: "admin",
        subscription_status: "inactive",
        referred_by: null,
      });

      /* 23505 = صار في صف بين العدّ والكتابة (سباق) → ما عاد تنصيباً جديداً.
         منكمّل للمسار العادي تحت بدل ما نمنح أدمن. */
      if (rootProfileError && rootProfileError.code !== "23505") {
        console.error("create-profile root admin insert failed:", rootProfileError);
        return NextResponse.json(
          { error: "تعذّر إنشاء الحساب", code: "PROFILE_CREATE_FAILED" },
          { status: 400 }
        );
      }
      if (rootProfileError?.code === "23505") {
        return NextResponse.json({ success: true });
      }

      await recordSignupFingerprint(supabase, userId, {
        deviceFingerprint,
        ip: requestIp,
        suspicious: false,
        reason: null,
      }).catch((e) => console.error("recordSignupFingerprint failed:", e.message));

      return NextResponse.json({ success: true, isRootAdmin: true });
    }
  }

  /* ⚠️ **إنشاء فقط — ممنوع الكتابة فوق صف موجود.**
     ---------------------------------------------------------------------
     كان `upsert(..., { ignoreDuplicates: false })`، والمسار **بلا مصادقة**
     (عن قصد: وقت التسجيل ممكن ما يكون في جلسة لو تفعيل الإيميل مطلوب).
     وفحص `getUserById` بيثبت إنه المعرّف **موجود** — مش إنه المنادي صاحبه.

     فأي حدا بيعرف معرّف مستخدم كان يقدر يبعت طلباً واحداً ويدوس على صفّه:

       role → "student"                  تنزيل أدمن لطالب
       subscription_status → "inactive"  قطع اشتراك مدفوع
       referred_by → كود المهاجم         سرقة عمولات الإحالة بنظام الشبكة
       username → أي قيمة

     `insert` بدل `upsert` بتقفلها من الجذر: الصف الموجود ما بينلمس. وخطأ
     تكرار المفتاح (23505) بينعامل **نجاحاً** لأن الغاية محقَّقة أصلاً
     (البروفايل موجود) — وهيك بيضل المسار قابلاً لإعادة النداء بلا أثر
     جانبي، بلا ما نفحص-ثم-نكتب (سباق).

     ⚠️ ملاحظة مقصودة: لو الصف موجود وما فيه `referred_by`، **ما منضيفه**.
     السماح بذلك بيرجّع نفس الاختطاف من باب تاني. */
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      username: username.trim(),
      role: "student",
      subscription_status: "inactive",
      referred_by: referredBy,
    });

  /* 23505 = انتهاك قيد التفرّد = البروفايل موجود من قبل. */
  const alreadyExists = profileError?.code === "23505";
  if (profileError && !alreadyExists) {
    /* ⚠️ رسالة قاعدة البيانات الخام ما بتطلع للمنادي — كانت `profileError.message`
       فبتكشف أسماء قيود وأعمدة (`profiles_pkey`…) على مسار **بلا مصادقة**.
       التفصيل بينكتب بسجلّ الخادم، والمنادي بياخد رمزاً يقدر يشتكي فيه. */
    console.error("create-profile insert failed:", profileError);
    return NextResponse.json(
      { error: "تعذّر إنشاء الحساب", code: "PROFILE_CREATE_FAILED" },
      { status: 400 }
    );
  }

  /* ⚠️ البروفايل موجود من قبل = ما في تسجيل جديد صار هون، فبنوقف.
     -----------------------------------------------------------------------
     تحت في آثار جانبية بتفترض «حساب جديد»: تسجيل بصمة جهاز، وربط نقرة
     إحالة، و**إشعار «عضو جديد بشبكتك»**. وبما إنه المسار بلا مصادقة، تركها
     تشتغل على حساب قائم بتخلّي أي حدا يقصف صاحب أي كود إحالة بإشعارات
     كاذبة، ويلوّث بيانات مكافحة الغش بنداءات مكرّرة.

     الرجوع بنجاح مقصود: الغاية (وجود البروفايل) محقَّقة، وما بدنا نكشف
     للمنادي إذا الحساب موجود أو لأ. */
  if (alreadyExists) return NextResponse.json({ success: true });

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
      title: "عضو جديد بشبكتك",
      message: `${username.trim()} سجّل حساب عن طريق رابطك — العمولة بتتسجل تلقائياً أول ما يدفع اشتراكه`,
      link: "/affiliate",
    });
  }

  return NextResponse.json({ success: true });
}
