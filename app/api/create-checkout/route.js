import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase-server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = await request.json();

  let session;

  if (type === "registration") {
    session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: "تسجيل في Qais Trading Academy" },
          unit_amount: 30000,
        },
        quantity: 1,
      }],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-success?type=registration`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment`,
      metadata: { userId: user.id, type: "registration" },
    });
  } else if (type === "subscription") {
    session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: "اشتراك شهري - Qais Trading Academy" },
          unit_amount: 10000,
          recurring: { interval: "month" },
        },
        quantity: 1,
      }],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-success?type=subscription`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment`,
      metadata: { userId: user.id, type: "subscription" },
    });
  }

  return NextResponse.json({ url: session.url });
}
