import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/crypto-wallets — كل المحافظ (فعّالة وغير فعّالة)
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { data, error } = await admin.from("crypto_wallets").select("*").order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ wallets: data || [] });
}

// POST /api/admin/crypto-wallets  { network, currency?, address, label?, sort_order? }
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { network, currency, address, label, sort_order } = body || {};
  if (!network || !address) {
    return NextResponse.json({ error: "الشبكة والعنوان مطلوبين" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("crypto_wallets")
    .insert({
      network,
      currency: currency || "USDT",
      address,
      label: label || null,
      sort_order: typeof sort_order === "number" ? sort_order : 100,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ wallet: data });
}
