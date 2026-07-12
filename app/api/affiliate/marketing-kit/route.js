import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

// GET /api/affiliate/marketing-kit — قائمة الشعارات/البانرات/الفيديوهات الجاهزة للمسوّقين المفعّلين
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("affiliate_status").eq("id", user.id).maybeSingle();
  if (!profile || profile.affiliate_status !== "approved") {
    return NextResponse.json({ assets: [] });
  }

  const { data, error } = await admin.from("marketing_assets").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data || [] });
}
