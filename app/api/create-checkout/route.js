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
    // أول دفعة: $300 رسوم تسجيل فقط (تنحسب فوراً بأول فاتورة).
    // الاشتراك الشهري $100 منحطله trial_period_days: 30 حتى ستريب ما يسحبه إلا بعد شهر
    // من تاريخ التسجيل، وبهيك أول فاتورة بتصير $300 مش $400.
    session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      subscription_data: {
        trial_period_days: 30, // يأجّل أول سحب لبند الاشتراك الشهري لمدة شهر
        metadata: { user_id: user.id },
      },
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
            unit_amount: 10000, // $100 شهرياً، بيبلش السحب بعد أول شهر (trial) وبيتكرر تلقائياً بعدها
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-success?type=subscription`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment`,
    });
  }

  return NextResponse.json({ url: session.url });
}
