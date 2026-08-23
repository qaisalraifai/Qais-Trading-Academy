import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

async function requireApprovedAffiliate(admin, userId) {
  const { data: profile } = await admin
    .from("profiles")
    .select("affiliate_status, affiliate_code")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || profile.affiliate_status !== "approved") return null;
  return profile;
}

// GET /api/affiliate/campaign-links — يرجّع كل روابط الحملات تبعي مع إحصائياتها
// (نقرات + تحويلات محسوبة حيًّا من affiliate_clicks، بدون تخزين مكرر)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();
  const profile = await requireApprovedAffiliate(admin, user.id);
  if (!profile) return NextResponse.json({ error: "لازم تكون مسوّق مفعّل أولاً" }, { status: 403 });

  const { data: links } = await admin
    .from("campaign_links")
    .select("id, slug, label, is_active, created_at")
    .eq("affiliate_id", user.id)
    .order("created_at", { ascending: false });

  const { data: clicks } = await admin
    .from("affiliate_clicks")
    .select("campaign_slug, converted_user_id")
    .eq("affiliate_id", user.id)
    .not("campaign_slug", "is", null);

  const statsBySlug = {};
  for (const c of clicks || []) {
    if (!statsBySlug[c.campaign_slug]) statsBySlug[c.campaign_slug] = { clicks: 0, conversions: 0 };
    statsBySlug[c.campaign_slug].clicks += 1;
    if (c.converted_user_id) statsBySlug[c.campaign_slug].conversions += 1;
  }

  const result = (links || []).map((l) => ({
    ...l,
    clicks: statsBySlug[l.slug]?.clicks || 0,
    conversions: statsBySlug[l.slug]?.conversions || 0,
  }));

  return NextResponse.json({ links: result, affiliateCode: profile.affiliate_code });
}

// POST /api/affiliate/campaign-links  { slug, label }
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();
  const profile = await requireApprovedAffiliate(admin, user.id);
  if (!profile) return NextResponse.json({ error: "لازم تكون مسوّق مفعّل أولاً" }, { status: 403 });

  const { slug, label } = await request.json();
  const cleanSlug = (slug || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);

  if (!cleanSlug) {
    return NextResponse.json({ error: "اسم الحملة لازم يحتوي أحرف/أرقام إنجليزية" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("campaign_links")
    .insert({ affiliate_id: user.id, slug: cleanSlug, label: (label || "").trim().slice(0, 80) })
    .select("id, slug, label, is_active, created_at")
    .single();

  if (error) {
    const message = error.code === "23505" ? "هاد الاسم مستخدم مسبقاً — جرّب اسم تاني" : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ link: { ...data, clicks: 0, conversions: 0 } });
}

// DELETE /api/affiliate/campaign-links?id=...
export async function DELETE(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("campaign_links").delete().eq("id", id).eq("affiliate_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
