import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { creditWallet } from "@/lib/wallets";
import { logActivity } from "@/lib/activity-log";

const MIN_WITHDRAWAL = 50; // دينار، الفصل 18

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const supabaseAdmin = createAdminClient();
  const { data: withdrawals } = await supabaseAdmin
    .from("mlm_withdrawals")
    .select("*")
    .eq("user_id", user.id)
    .order("requested_at", { ascending: false });

  return NextResponse.json({ withdrawals: withdrawals || [] });
}

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { amount, method, destinationDetails } = await request.json();
  const numericAmount = Number(amount);

  if (!numericAmount || numericAmount < MIN_WITHDRAWAL) {
    return NextResponse.json({ error: `الحد الأدنى للسحب ${MIN_WITHDRAWAL} دينار` }, { status: 400 });
  }
  if (!["bank_transfer", "e_wallet", "usdt"].includes(method)) {
    return NextResponse.json({ error: "وسيلة سحب غير مدعومة" }, { status: 400 });
  }
  if (!destinationDetails) {
    return NextResponse.json({ error: "لازم تحددي وين بدك تستلمي الفلوس" }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  // الفصل 12 و18: KYC إلزامي عند السحب
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("kyc_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.kyc_status !== "verified") {
    return NextResponse.json(
      { error: "لازم تكملي التحقق من الهوية (KYC) قبل ما تقدري تسحبي" },
      { status: 403 }
    );
  }

  // التأكد إنه الرصيد كافي بمحفظة السحب
  const { data: wallet } = await supabaseAdmin
    .from("wallets")
    .select("id, balance")
    .eq("user_id", user.id)
    .eq("wallet_type", "withdrawal")
    .maybeSingle();

  const balance = Number(wallet?.balance || 0);
  if (balance < numericAmount) {
    return NextResponse.json({ error: "الرصيد غير كافي بمحفظة السحب" }, { status: 400 });
  }

  // نخصم فورًا (Hold) حتى ما يقدر يطلب سحب نفس المبلغ مرتين وهو بانتظار الموافقة
  await creditWallet(supabaseAdmin, user.id, "withdrawal", -numericAmount, "withdrawal_request", null);

  const { data: withdrawal, error } = await supabaseAdmin
    .from("mlm_withdrawals")
    .insert({
      user_id: user.id,
      amount: numericAmount,
      method,
      destination_details: destinationDetails,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    // نرجّع المبلغ لو فشل تسجيل الطلب
    await creditWallet(supabaseAdmin, user.id, "withdrawal", numericAmount, "withdrawal_request_failed_refund", null);
    return NextResponse.json({ error: "فشل تسجيل طلب السحب" }, { status: 500 });
  }

  await logActivity(user.id, "note", `طلب سحب ${numericAmount} دينار (${method})`, {
    withdrawalId: withdrawal.id,
  });

  return NextResponse.json({ success: true, withdrawalId: withdrawal.id });
}
