import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const OLD_HOST = "qais-trading-academy.vercel.app";
const CANONICAL_ORIGIN = "https://www.qta-academy.store";

export async function middleware(request) {
  // 1) لو الطلب جاي من الدومين القديم (vercel.app)، منحوّله بشكل دائم (308)
  //    للدومين الجديد — هيك Google بمرور الوقت بيشيل الرابط القديم من نتائج
  //    البحث ويعرض بس الدومين الجديد.
  const host = request.headers.get("host") || "";
  if (host === OLD_HOST) {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, CANONICAL_ORIGIN);
    return NextResponse.redirect(target, 301);
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value; },
        set(name, value, options) { response.cookies.set({ name, value, ...options }); },
        remove(name, options) { response.cookies.set({ name, value: "", ...options }); },
      },
    }
  );

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

     ⚠️ **وتجديد الجلسة ما بيتأثر.** الكوكي المجدَّد بينحفظ من هون وبس
     (بالصفحات `cookieStore.set` بتفشل بصمت — شوفي `lib/supabase-server.js`)،
     بس كل **انتقال صفحة** لسا بيمرّ من هون ويجدّد. نداءات API ما بتصير
     لحالها بمعزل عن تصفّح، فالإيقاع محفوظ.

     ⚠️ ما انشال الفحص من الصفحات غير المحمية عمداً — قائمة `protectedPaths`
     ناقصة صفحات منصّة فعلية (/trading-radar · /settings · /reports …)،
     وشيل التجديد عنهن بيعني إنه مستخدم يشتغل ساعة عليهن ما بينجدد توكنه
     أبداً → بينتهي → بينطلع برّا. الحل الصح إكمال القائمة أول، وهو شغل
     الجولة الأمنية. */
  const isApi = request.nextUrl.pathname.startsWith("/api");

  const protectedPaths = ["/dashboard", "/lecture", "/course", "/quiz", "/backtest", "/replay", "/discord", "/affiliate"];
  const isProtected = !isApi && protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p));

  if (isApi) return response;

  const { data: { user } } = await supabase.auth.getUser();

  // لو مش مسجل دخول
  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // لو مسجل دخول، تحقق من الاشتراك
  if (isProtected && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, role")
      .eq("id", user.id)
      .single();

    // الأدمن يمر بدون فحص
    if (profile?.role === "admin") return response;

    // لو الاشتراك منتهي، وجّهه لصفحة الدفع
    if (!profile || profile.subscription_status !== "active") {
      return NextResponse.redirect(new URL("/payment", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.jpg).*)",
  ],
};
