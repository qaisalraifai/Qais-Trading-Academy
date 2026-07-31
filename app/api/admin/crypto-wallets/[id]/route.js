import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// PATCH /api/admin/crypto-wallets/:id  { network?, currency?, address?, label?, is_active?, sort_order? }
export async function PATCH(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const allowed = ["network", "currency", "address", "label", "is_active", "sort_order"];
  const updates = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("crypto_wallets").update(updates).eq("id", params.id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "المحفظة غير موجودة" }, { status: 404 });

  return NextResponse.json({ wallet: data });
}

// DELETE /api/admin/crypto-wallets/:id
export async function DELETE(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { error } = await admin.from("crypto_wallets").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
