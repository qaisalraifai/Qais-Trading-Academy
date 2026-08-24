import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { SESSION_PATHS, SUBSCRIPTION_PATHS, matchesPath } from "@/lib/route-access";

const OLD_HOST = "qais-trading-academy.vercel.app";
const CANONICAL_ORIGIN = "https://www.qta-academy.store";

/* ═══════════════════════════════════════════════════════════════════════════
   ⚠️ **الترويسة الداخلية للهوية — كل حمايتها مسحة واحدة غير مشروطة.**
   ---------------------------------------------------------------------------
   منمرّر هوية المستخدم المتحقَّقة للصفحات بترويسة داخلية، عشان الصفحة ما تعيد
   `auth.getUser()` — وهي **رحلة شبكية** لخادم Supabase كانت تنفّذ مرتين بكل
   انتقال (مرة هون ومرة بالصفحة) لنفس الفحص بالضبط.

   بس Next.js **بيمرّر ترويسات الطلب الداخلة كما هي**. يعني أي حدا بيقدر يبعت
   `x-qta-uid` بنفسه ويدّعي أي هوية. المسح غير المشروط تحت هو **كل** الحماية:
   بينمسح أول شي، قبل أي فرع أو رجوع مبكر، وما بينكتب إلا من نتيجة
   `auth.getUser()` المتحقَّقة.

   🔴 **ممنوع** يتحرّك المسح تحت أي شرط أو بعد أي `return`، وإلا بيصير انتحال
   هوية كامل. وأي قارئ للترويسة لازم يتعامل مع غيابها بالرجوع لـ`getUser()`
   — مش باعتبارها ثقة ضمنية (شوفي `lib/auth-context.js`).
   ═══════════════════════════════════════════════════════════════════════════ */
export const AUTH_HEADER = "x-qta-uid";

/* طبقتا الحماية معرَّفتان بـ`lib/route-access.js` — وحدة نقيّة مفحوصة.
   الـmiddleware ما بيعرّف ولا مسار عنده، فما بيقدروا يتناقضوا. */

async function middlewareImpl(request) {
  // 1) لو الطلب جاي من الدومين القديم (vercel.app)، منحوّله بشكل دائم (308)
  //    للدومين الجديد — هيك Google بمرور الوقت بيشيل الرابط القديم من نتائج
  //    البحث ويعرض بس الدومين الجديد.
  const host = request.headers.get("host") || "";
  if (host === OLD_HOST) {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, CANONICAL_ORIGIN);
    return NextResponse.redirect(target, 301);
  }

  const cleanHeaders = new Headers(request.headers);
  cleanHeaders.delete(AUTH_HEADER);

  /* ═══ مسارات API ما بتمرّ على فحص المصادقة هون ═══
     ---------------------------------------------------------------------
     ⚠️ `auth.getUser()` **رحلة شبكية** لخادم Supabase، وكانت تنفّذ على
     **كل** طلب — بما فيه كل نداء `/api/*`. ونتيجتها ما بتنقرا إلا جوّا
     `isProtected`، و`/api` **مش** بقائمة الحماية أصلاً. يعني كانت رحلة
     كاملة بتروح وبترجع بلا ما حدا يستعملها.

     الكلفة مش نظرية: بالمنصّة استطلاعات دورية شغّالة بالخلفية — السعر
     اللحظي بالريبلاي كل ٥ ثواني، وتلات لوحات كل ١٥، وتلاتة كل ٢٠،
     وأربعة كل ٦٠ — وكل وحدة منهن كانت تدفع هالرحلة.

     ⚠️ **ولا قرار مصادقة بيتغيّر.** انفحصت الـ١٣٩ مسار API: ١٣٥ منهن
     بيفحصوا بنفسهم (`auth.getUser` أو `requireAdmin`)، والأربعة الباقية
     بيانات سوق عامة (الشموع · التسعيرات · طرق الدفع · تحليل السوق) وما
     كانت محمية هون أصلاً.

     ⚠️ **وتجديد الجلسة ما بيتأثر.** كل **انتقال صفحة** لسا بيمرّ من هون
     ويجدّد. نداءات API ما بتصير لحالها بمعزل عن تصفّح، فالإيقاع محفوظ.

     ⚠️ ما انشال الفحص من الصفحات غير المحمية عمداً — قائمة `protectedPaths`
     ناقصة صفحات منصّة فعلية (/trading-radar · /settings · /reports …)،
     وشيل التجديد عنهن بيعني إنه مستخدم يشتغل ساعة عليهن ما بينجدد توكنه
     أبداً → بينتهي → بينطلع برّا. الحل الصح إكمال القائمة أول.

     ⚠️ **والخروج بيصير قبل `createServerClient` عن قصد.** كان تحته، يعني
     كل نداء API بيبني عميل Supabase بلا ما يستعمله — وأهم من الكلفة: لو
     البناء رمى (متغيّر بيئة ناقص مثلاً)، الـmiddleware بينهار وNext بيردّ
     **صفحة HTML** على نداء API. والواجهة بتناديها بـ`res.json()` فبتطلع
     `Unexpected token '<'` بدل السبب. هلّق `/api` ما بيلمس Supabase هون.
     */
  const isApi = request.nextUrl.pathname.startsWith("/api");

  const pathname = request.nextUrl.pathname;
  const needsSubscription = !isApi && matchesPath(pathname, SUBSCRIPTION_PATHS);
  const needsSession = needsSubscription || (!isApi && matchesPath(pathname, SESSION_PATHS));

  if (isApi) return NextResponse.next({ request: { headers: cleanHeaders } });

  /* ⚠️ كوكيز تجديد الجلسة بتنجمع بمصفوفة مش على `response` مباشرة.
     -------------------------------------------------------------------------
     `auth.getUser()` بتجدّد التوكن وبتكتب الكوكي عبر `set` تحت، و**هون هو
     المكان الوحيد اللي بينحفظ فيه فعلاً** (بالصفحات `cookieStore.set` بتفشل
     بصمت — شوفي `lib/supabase-server.js`).

     لو ربطناها بكائن `response` واحد، أي مسار بيبني رداً جديداً بعدها (تحويل،
     أو إعادة بناء الرد بعد إضافة ترويسة الهوية) بيرمي الكوكي المجدَّد —
     فبتنتهي جلسة المستخدم فجأة. الجمع بمصفوفة وتطبيقها على **أي** رد بنرجّعه
     بيقفل هالباب. */
  const pendingCookies = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value; },
        set(name, value, options) { pendingCookies.push({ name, value, ...options }); },
        remove(name, options) { pendingCookies.push({ name, value: "", ...options }); },
      },
    }
  );

  /** بيبني الرد النهائي وبيطبّق عليه كل كوكي تجديد اتجمّع. */
  const withCookies = (res) => {
    for (const c of pendingCookies) res.cookies.set(c);
    return res;
  };

  const { data: { user } } = await supabase.auth.getUser();

  // الهوية المتحقَّقة بتنمرّر للصفحة — الترويسة انمسحت فوق، فما بينكتب فيها
  // إلا اللي تحقّقنا منه هون.
  if (user) cleanHeaders.set(AUTH_HEADER, user.id);

  // لو مش مسجل دخول — بينطبق على الطبقتين
  if (needsSession && !user) {
    return withCookies(NextResponse.redirect(new URL("/login", request.url)));
  }

  /* تحقّق الاشتراك — **ما تغيّر منه ولا سطر**: نفس الاستعلام، نفس تجاوز
     الأدمن، نفس المقارنة `!== "active"`. اللي تغيّر بس **مين بيوصله**. */
  if (needsSubscription && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, role")
      .eq("id", user.id)
      .single();

    // الأدمن يمر بدون فحص
    if (profile?.role === "admin") {
      return withCookies(NextResponse.next({ request: { headers: cleanHeaders } }));
    }

    // لو الاشتراك منتهي، وجّهه لصفحة الدفع
    if (!profile || profile.subscription_status !== "active") {
      return withCookies(NextResponse.redirect(new URL("/payment", request.url)));
    }
  }

  return withCookies(NextResponse.next({ request: { headers: cleanHeaders } }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   ⚠️ **الحارس — الـmiddleware ما بيرمي أبداً.**
   ---------------------------------------------------------------------------
   الـmiddleware بيمرق عليه **كل** طلب بالمنصّة. ولما يرمي، Next بيردّ صفحة
   خطأ HTML — يعني رمية وحدة = المنصّة كلها واقفة، ونداءات API بترجّع HTML
   بدل JSON فالواجهة بتطلّع `Unexpected token '<'` بدل أي سبب مفهوم.

   وكان **بلا أي try/catch**: بناء عميل Supabase، و`auth.getUser()` (رحلة
   شبكية لخادم خارجي) — كلهن مكشوفين.

   ---------------------------------------------------------------------------
   🔴 **الفشل مقفول على المحمي، مفتوح على غيره.**

   لو انهار الفحص، ممنوع نمرّق طلباً لصفحة محمية — هاد بيصير **تجاوز مصادقة**
   بالضبط لما يكون النظام مهزوز. فالمحمي بينحوّل لـ`/login`.

   وغير المحمي بيمرق: ما في قرار مصادقة بينبنى عليه أصلاً، وقفله بيوقّف صفحات
   عامة بلا فايدة أمنية.

   ⚠️ وبكل الحالات الترويسة الداخلية بتنمسح — نفس المسحة غير المشروطة، عشان
   ما ينفتح باب انتحال هوية من طريق مسار الفشل.
   ═══════════════════════════════════════════════════════════════════════════ */
export async function middleware(request) {
  try {
    return await middlewareImpl(request);
  } catch (e) {
    console.error("[middleware] انهيار غير متوقَّع:", e);

    const path = request.nextUrl.pathname;
    const clean = new Headers(request.headers);
    clean.delete(AUTH_HEADER);

    // الفشل مقفول على **الطبقتين** — أي مسار بيتطلب جلسة ما بيمرق بلا فحص.
    if (!path.startsWith("/api") && (matchesPath(path, SUBSCRIPTION_PATHS) || matchesPath(path, SESSION_PATHS))) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request: { headers: clean } });
  }
}


export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.jpg).*)",
  ],
};
