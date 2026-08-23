import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { LOCALE_COOKIE, isSupportedLocale } from "@/lib/i18n/config";

// GET /api/user/locale — يجيب اللغة المحفوظة بحساب المستخدم (تُستخدم لما
// يفتح المنصة من جهاز/متصفح جديد ما فيه لغة محفوظة محلياً بعد)
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ locale: null });

  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("locale").eq("id", user.id).single();

  return NextResponse.json({ locale: data?.locale && isSupportedLocale(data.locale) ? data.locale : null });
}

// POST /api/user/locale — يحفظ اللغة المختارة بحساب المستخدم (لو مسجّل دخول)
// ويثبّت الكوكي من طرف السيرفر كمان (احتياطي لو تعطيل الكوكي من JS)
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { locale } = body;
  if (!isSupportedLocale(locale)) {
    return NextResponse.json({ error: "لغة غير مدعومة" }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const admin = createAdminClient();
    await admin.from("profiles").update({ locale }).eq("id", user.id);
  }

  const res = NextResponse.json({ locale, saved: !!user });
  res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
  return res;
}
