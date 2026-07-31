import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { approveManualTransaction } from "@/lib/payments/billing-service";

// POST /api/admin/payments/:transactionId/approve
export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    await approveManualTransaction({ transactionId: params.transactionId, adminUserId: auth.user.id });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("approve manual payment failed:", e.message);
    return NextResponse.json({ error: e.message || "تعذرت الموافقة" }, { status: 400 });
  }
}
