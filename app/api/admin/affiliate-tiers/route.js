import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/affiliate-tiers
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("affiliate_tiers")
    .select("*")
    .order("min_active_clients", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tiers: data || [] });
}

// POST /api/admin/affiliate-tiers  { code, title_ar, badge_icon, color_hex, min_active_clients, signup_amount, renewal_amount, sort_order }
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { code, title_ar, badge_icon, color_hex, min_active_clients, signup_amount, renewal_amount, sort_order } = body;

  if (!code || !title_ar) {
    return NextResponse.json({ error: "code و title_ar مطلوبين" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("affiliate_tiers")
    .insert({
      code: code.trim().toLowerCase(),
      title_ar,
      badge_icon: badge_icon || "🏅",
      color_hex: color_hex || "#C9A860",
      min_active_clients: Number(min_active_clients) || 0,
      signup_amount: Number(signup_amount) || 0,
      renewal_amount: Number(renewal_amount) || 0,
      sort_order: Number(sort_order) || 0,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tier: data });
}

// PATCH /api/admin/affiliate-tiers  { id, ...fields }
export async function PATCH(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const allowed = ["title_ar", "badge_icon", "color_hex", "min_active_clients", "signup_amount", "renewal_amount", "sort_order", "is_active"];
  const update = {};
  for (const key of allowed) {
    if (key in fields) update[key] = fields[key];
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("affiliate_tiers").update(update).eq("id", id).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tier: data });
}

// DELETE /api/admin/affiliate-tiers?id=...
export async function DELETE(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("affiliate_tiers").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
