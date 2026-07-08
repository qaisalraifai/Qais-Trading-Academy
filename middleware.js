import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(request) {
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

  const protectedPaths = ["/dashboard", "/lecture", "/quiz", "/backtest", "/replay", "/discord"];
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
  matcher: ["/dashboard/:path*", "/lecture/:path*", "/quiz/:path*", "/backtest/:path*", "/replay/:path*", "/discord/:path*"],
};
