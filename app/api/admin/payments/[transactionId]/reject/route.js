import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rejectManualTransaction } from "@/lib/payments/billing-service";

// POST /api/admin/payments/:transactionId/reject  { reason }
export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));

  try {
    await rejectManualTransaction({
      transactionId: params.transactionId,
      adminUserId: auth.user.id,
      reason: body?.reason || "",
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("reject manual payment failed:", e.message);
    return NextResponse.json({ error: e.message || "تعذر الرفض" }, { status: 400 });
  }
}
