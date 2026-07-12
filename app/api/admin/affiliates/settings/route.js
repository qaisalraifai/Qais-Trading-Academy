import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/affiliates/settings
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("affiliate_settings").select("*").eq("id", 1).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

// POST /api/admin/affiliates/settings  { level1_percent, level2_percent, level3_percent, min_payout_usd, payout_cycle_days }
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { level1_percent, level2_percent, level3_percent, min_payout_usd, payout_cycle_days } = body;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("affiliate_settings")
    .update({
      level1_percent: Number(level1_percent),
      level2_percent: Number(level2_percent),
      level3_percent: Number(level3_percent),
      min_payout_usd: Number(min_payout_usd),
      payout_cycle_days: Number(payout_cycle_days),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
