import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/achievements
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("achievement_definitions")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ achievements: data || [] });
}

// POST /api/admin/achievements  { code, title_ar, description_ar, icon, metric, threshold, bonus_amount, sort_order }
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { code, title_ar, description_ar, icon, metric, threshold, bonus_amount, sort_order } = body;

  if (!code || !title_ar || !metric) {
    return NextResponse.json({ error: "code و title_ar و metric مطلوبين" }, { status: 400 });
  }
  if (!["total_referrals", "total_earned", "monthly_top_rank"].includes(metric)) {
    return NextResponse.json({ error: "metric غير صحيح" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("achievement_definitions")
    .insert({
      code: code.trim().toLowerCase().replace(/\s+/g, "_"),
      title_ar,
      description_ar: description_ar || "",
      icon: icon || "trophy",
      metric,
      threshold: Number(threshold) || 0,
      bonus_amount: Number(bonus_amount) || 0,
      sort_order: Number(sort_order) || 0,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ achievement: data });
}

// PATCH /api/admin/achievements  { id, ...fields }
export async function PATCH(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const allowed = ["title_ar", "description_ar", "icon", "metric", "threshold", "bonus_amount", "sort_order", "is_active"];
  const update = {};
  for (const key of allowed) {
    if (key in fields) update[key] = fields[key];
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("achievement_definitions")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ achievement: data });
}

// DELETE /api/admin/achievements?id=...
export async function DELETE(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("achievement_definitions").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
