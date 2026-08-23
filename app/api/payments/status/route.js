import { NextResponse } from "next/server";
import { jsonHandler } from "@/lib/api-guard";
import { createClient, createAdminClient } from "@/lib/supabase-server";

// GET /api/payments/status?transactionId=...
// بيرجع حالة عملية دفع معيّنة تخص المستخدم الحالي فقط — تستخدمه صفحة
// "بانتظار المراجعة" بالدفع اليدوي حتى تعرف لما الأدمن يوافق أو يرفض.
async function GETImpl(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const transactionId = searchParams.get("transactionId");
  if (!transactionId) return NextResponse.json({ error: "transactionId مطلوب" }, { status: 400 });

  const admin = createAdminClient();
  const { data: tx, error } = await admin
    .from("payment_transactions")
    .select("id, status, rejection_reason, provider_code")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !tx) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json({ transaction: tx });
}

export const GET = jsonHandler(GETImpl);
