import { NextResponse } from "next/server";
import { Paddle, Environment } from "@paddle/paddle-node-sdk";
import { createClient } from "@supabase/supabase-js";
import { kickMemberFromGuild } from "@/lib/discord";

// مفاتيح الـ sandbox بتبلش بـ pdl_sdbx_ — لازم نحدد الـ environment صح
// وإلا Paddle بيرفض الطلب بخطأ "forbidden"
const isSandbox = process.env.PADDLE_API_KEY?.startsWith("pdl_sdbx_");
const paddle = new Paddle(process.env.PADDLE_API_KEY, {
  environment: isSandbox ? Environment.sandbox : Environment.production,
});
// عميل Supabase بصلاحية Service Role (يتجاوز RLS) لأنه هاد كود سيرفر-لسيرفر موثوق من Paddle
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  const body = await request.text(); // لازم نص خام (raw) عشان التحقق من التوقيع يشتغل
  const signature = request.headers.get("paddle-signature") || "";

  let event;
  try {
    // unmarshal بيتحقق من التوقيع ويرجع الحدث محلل جاهز، وبيرمي خطأ لو التوقيع غلط
    event = await paddle.webhooks.unmarshal(
      body,
      process.env.PADDLE_WEBHOOK_SECRET,
      signature
    );
  } catch (err) {
    console.error("Paddle webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.eventType) {
      // ✅ أي دفعة ناجحة — أول دفعة تسجيل، أو أي تجديد شهري لاحق
      case "transaction.completed": {
        const txn = event.data;
        const userId = txn.customData?.user_id;
        const subscriptionId = txn.subscriptionId;

        if (userId) {
          // أول دفعة: عندنا user_id مباشرة من الـ checkout (customData)
          const updateData = {
            subscription_status: "active",
            paddle_customer_id: txn.customerId,
          };

          if (subscriptionId) {
            updateData.paddle_subscription_id = subscriptionId;
            // منجيب تاريخ الفاتورة الجاية حتى نعرف امتى ينتهي الوصول لو ما تجدد
            const subscription = await paddle.subscriptions.get(subscriptionId);
            updateData.subscription_end = subscription.nextBilledAt
              ? new Date(subscription.nextBilledAt).toISOString()
              : null;
          } else {
            updateData.subscription_end = null;
          }

          const { error } = await supabaseAdmin
            .from("profiles")
            .update(updateData)
            .eq("id", userId);

          if (error) console.error("Failed to activate subscription:", error);
        } else if (subscriptionId) {
          // تجديد شهري لاحق: ما رح يكون فيه customData، فمنربطه بمعرف الاشتراك المخزن مسبقاً
          const subscription = await paddle.subscriptions.get(subscriptionId);
          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              subscription_status: "active",
              subscription_end: subscription.nextBilledAt
                ? new Date(subscription.nextBilledAt).toISOString()
                : null,
            })
            .eq("paddle_subscription_id", subscriptionId);

          if (error) console.error("Failed to renew subscription:", error);
        }
        break;
      }

      // ❌ فشل الدفع أو إلغاء الاشتراك — عطّل الوصول واطرد من Discord
      case "subscription.past_due":
      case "subscription.canceled": {
        const subscriptionId = event.data.id;
        const { data: updated, error } = await supabaseAdmin
          .from("profiles")
          .update({ subscription_status: "inactive" })
          .eq("paddle_subscription_id", subscriptionId)
          .select("discord_id")
          .maybeSingle();

        if (error) {
          console.error("Failed to deactivate subscription:", error);
        } else if (updated?.discord_id) {
          await kickMemberFromGuild(updated.discord_id).catch((e) =>
            console.error("Discord kick error:", e)
          );
        }
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
