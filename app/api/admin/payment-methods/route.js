import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/payment-methods — كل وسائل الدفع (مفعّلة أو لأ) لعرضها بلوحة التحكم
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { data, error } = await admin.from("payment_providers").select("*").order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ providers: data || [] });
}

// PATCH /api/admin/payment-methods  { code, enabled?, description?, sort_order?, config? }
// تفعيل/تعطيل وسيلة دفع أو تعديل وصفها المعروض للطالب — بدون لمس الكود.
export async function PATCH(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { code, enabled, description, sort_order, config } = body || {};
  if (!code) return NextResponse.json({ error: "code مطلوب" }, { status: 400 });

  const updates = { updated_at: new Date().toISOString() };
  if (typeof enabled === "boolean") updates.enabled = enabled;
  if (typeof description === "string") updates.description = description;
  if (typeof sort_order === "number") updates.sort_order = sort_order;
  if (config && typeof config === "object") updates.config = config;

  const admin = createAdminClient();
  const { data, error } = await admin.from("payment_providers").update(updates).eq("code", code).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "مزوّد الدفع غير موجود" }, { status: 404 });

  return NextResponse.json({ provider: data });
}
