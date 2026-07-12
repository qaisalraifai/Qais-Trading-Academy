import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/affiliates/payouts?status=awaiting_transfer|paid|failed (اختياري)
export async function GET(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();
  const status = new URL(request.url).searchParams.get("status");

  let query = supabase
    .from("payouts")
    .select("id, affiliate_id, amount, method, payout_details, status, period_start, period_end, paid_at, reference, created_at")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // نجيب أسماء المسوّقين بشكل منفصل (أوضح وأضمن من الاعتماد على اسم الـ FK)
  const affiliateIds = [...new Set((data || []).map((p) => p.affiliate_id))];
  let profilesById = {};
  if (affiliateIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, affiliate_code")
      .in("id", affiliateIds);
    profilesById = Object.fromEntries((profs || []).map((p) => [p.id, p]));
  }

  const payouts = (data || []).map((p) => ({
    ...p,
    affiliate_username: profilesById[p.affiliate_id]?.username || null,
    affiliate_code: profilesById[p.affiliate_id]?.affiliate_code || null,
  }));

  return NextResponse.json({ payouts });
}
