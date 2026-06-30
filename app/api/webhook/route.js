import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// عميل Supabase بصلاحية Service Role (يتجاوز RLS) لأنه هاد كود سيرفر-لسيرفر موثوق من Stripe
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  const body = await request.text(); // لازم نص خام (raw) عشان التحقق من التوقيع يشتغل
  const signature = request.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ✅ أول دفعة ناجحة (تسجيل لمرة وحدة، أو أول دورة اشتراك شهري)
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.user_id;

        if (!userId) {
          console.error("No user_id found on checkout session:", session.id);
          break;
        }

        const updateData = {
          subscription_status: "active",
        };

        // لو اشتراك شهري متكرر، خزّني معرّفات Stripe وتاريخ الانتهاء (نهاية الدورة الحالية)
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription
          );
          updateData.stripe_customer_id = session.customer;
          updateData.stripe_subscription_id = session.subscription;
          updateData.subscription_end = new Date(
            subscription.current_period_end * 1000
          ).toISOString();
        } else {
          // دفعة لمرة وحدة (تسجيل) — بلا تاريخ انتهاء، الكرون ما رح يلغيها لأنها subscription_end فاضية
          updateData.subscription_end = null;
        }

        const { error } = await supabaseAdmin
          .from("profiles")
          .update(updateData)
          .eq("id", userId);

        if (error) console.error("Failed to activate subscription:", error);
        break;
      }

      // 🔄 تجديد الاشتراك الشهري بنجاح — مدّ تاريخ الانتهاء
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription
          );
          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              subscription_status: "active",
              subscription_end: new Date(
                subscription.current_period_end * 1000
              ).toISOString(),
            })
            .eq("stripe_subscription_id", invoice.subscription);

          if (error) console.error("Failed to renew subscription:", error);
        }
        break;
      }

      // ❌ فشل الدفع أو إلغاء الاشتراك — عطّل الوصول
      case "invoice.payment_failed":
      case "customer.subscription.deleted": {
        const obj = event.data.object;
        const subscriptionId = obj.subscription || obj.id;
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ subscription_status: "inactive" })
          .eq("stripe_subscription_id", subscriptionId);

        if (error) console.error("Failed to deactivate subscription:", error);
        break;
      }

      default:
        // أحداث تانية ما إلها داعي نتعامل معها
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
