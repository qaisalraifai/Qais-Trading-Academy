import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  // لازم نعرف مين المستخدم الحالي حتى نربط الدفعة فيه بالـ Webhook لاحقاً
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });
  }

  const { type } = await request.json();
  let session;

  if (type === "subscription") {
    // دفعة تسجيل $300 لمرة وحدة + اشتراك شهري $100 يبلش يسحب تلقائياً من نفس الشهر الجاي
    session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "رسوم التسجيل - Qais Trading Academy" },
            unit_amount: 30000, // $300، بتنحسب مرة وحدة بس بأول فاتورة
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            product_data: { name: "اشتراك شهري - Qais Trading Academy" },
            unit_amount: 10000, // $100 شهرياً، بيتكرر تلقائياً كل شهر
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment`,
    });
  }

  return NextResponse.json({ url: session.url });
}
