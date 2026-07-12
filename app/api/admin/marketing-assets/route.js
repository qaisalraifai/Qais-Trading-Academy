import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/marketing-assets
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("marketing_assets").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data || [] });
}

// POST /api/admin/marketing-assets  { title, type, file_url, thumbnail_url?, description? }
// ملاحظة: file_url لازم يكون رابط جاهز (مثلاً ملف مرفوع بـ Supabase Storage أو رابط خارجي) —
// هاد الـ endpoint ما بيرفع ملفات، بس بيسجل الرابط بالمكتبة يلي المسوّقين بيشوفوها.
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { title, type, file_url, thumbnail_url, description } = body;
  if (!title || !type || !file_url) {
    return NextResponse.json({ error: "لازم title و type و file_url" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("marketing_assets")
    .insert({ title, type, file_url, thumbnail_url: thumbnail_url || null, description: description || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data });
}

// DELETE /api/admin/marketing-assets  { id }
export async function DELETE(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("marketing_assets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
