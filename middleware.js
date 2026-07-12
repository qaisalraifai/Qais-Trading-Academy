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

  const { data: { user } } = await supabase.auth.getUser();

  const protectedPaths = ["/dashboard", "/lecture", "/course", "/quiz", "/backtest", "/replay", "/discord", "/affiliate"];
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p));

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
