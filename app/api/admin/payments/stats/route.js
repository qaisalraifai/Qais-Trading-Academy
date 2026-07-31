import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/payments/stats
// عدد العمليات وإجمالي الإيرادات لكل وسيلة دفع (من payment_transactions
// الناجحة) — يغذّي بطاقات الإحصائيات بلوحة إدارة المدفوعات.
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { data: providers } = await admin.from("payment_providers").select("code, name").order("sort_order");
  const { data: transactions, error } = await admin
    .from("payment_transactions")
    .select("provider_code, amount, currency, status")
    .eq("status", "succeeded");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byProvider = {};
  for (const p of providers || []) {
    byProvider[p.code] = { code: p.code, name: p.name, count: 0, revenue: 0 };
  }
  for (const t of transactions || []) {
    if (!byProvider[t.provider_code]) {
      byProvider[t.provider_code] = { code: t.provider_code, name: t.provider_code, count: 0, revenue: 0 };
    }
    byProvider[t.provider_code].count += 1;
    byProvider[t.provider_code].revenue += Number(t.amount) || 0;
  }

  const stats = Object.values(byProvider);
  const totalRevenue = stats.reduce((sum, s) => sum + s.revenue, 0);
  const totalCount = stats.reduce((sum, s) => sum + s.count, 0);

  const { count: pendingCount } = await admin
    .from("payment_transactions")
    .select("id", { count: "exact", head: true })
    .eq("provider_code", "manual_usdt")
    .eq("status", "pending");

  return NextResponse.json({ byProvider: stats, totalRevenue, totalCount, pendingReview: pendingCount || 0 });
}
