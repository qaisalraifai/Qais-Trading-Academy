import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

// POST /api/affiliate/payout-info  { method: "paypal" | "wise" | "bank", details: {...} }
// يخزّن بيانات استلام العمولة. التحويل الفعلي يدوي حالياً (لحد ربط PayPal/Wise API).
export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });
  }

  const { method, details } = await request.json();
  const allowed = ["paypal", "wise", "bank"];
  if (!allowed.includes(method)) {
    return NextResponse.json({ error: "طريقة استلام غير مدعومة" }, { status: 400 });
  }
  if (!details || typeof details !== "object") {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("affiliate_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.affiliate_status !== "approved") {
    return NextResponse.json({ error: "لازم تكون مسوّق مفعّل أولاً" }, { status: 403 });
  }

  const { error } = await admin
    .from("profiles")
    .update({ payout_method: method, payout_details: details })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
