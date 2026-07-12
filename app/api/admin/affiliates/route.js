
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/affiliates?status=pending|approved|rejected|suspended (اختياري)
export async function GET(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();
  const status = new URL(request.url).searchParams.get("status");

  let query = supabase
    .from("profiles")
    .select("id, username, affiliate_status, affiliate_code, payout_method, payout_details, affiliate_joined_at, referred_by")
    .neq("affiliate_status", "none")
    .order("affiliate_joined_at", { ascending: false });

  if (status) query = query.eq("affiliate_status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // نحسب لكل مسوّق مجموع عمولاته المعلّقة/المدفوعة بشكل سريع
  const ids = (data || []).map((p) => p.id);
  let commissionTotals = {};
  if (ids.length > 0) {
    const { data: commissions } = await supabase
      .from("commissions")
      .select("affiliate_id, status, commission_amount")
      .in("affiliate_id", ids);
    for (const c of commissions || []) {
      if (!commissionTotals[c.affiliate_id]) {
        commissionTotals[c.affiliate_id] = { pending: 0, ready: 0, paid: 0 };
      }
      const amt = Number(c.commission_amount) || 0;
      if (c.status in commissionTotals[c.affiliate_id]) {
        commissionTotals[c.affiliate_id][c.status] += amt;
      }
    }
  }

  const affiliates = (data || []).map((p) => ({
    ...p,
    totals: commissionTotals[p.id] || { pending: 0, ready: 0, paid: 0 },
  }));

  return NextResponse.json({ affiliates });
}
