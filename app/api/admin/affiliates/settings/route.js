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

// POST /api/admin/affiliates/settings  { min_payout_usd, payout_cycle_days, leaderboard_show_names }
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { min_payout_usd, payout_cycle_days, leaderboard_show_names } = body;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("affiliate_settings")
    .update({
      min_payout_usd: Number(min_payout_usd),
      payout_cycle_days: Number(payout_cycle_days),
      leaderboard_show_names: Boolean(leaderboard_show_names),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
