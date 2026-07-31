import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getWhop } from "@/lib/whop";
import { kickMemberFromGuild } from "@/lib/discord";
import { logActivity } from "@/lib/activity-log";
import { recordSignupCommission, recordRenewalCommission } from "@/lib/referral-commissions";
import { syncAffiliateTier } from "@/lib/tiers";
import { markInvoicePaid } from "@/lib/payments/billing-service";

// عميل Supabase بصلاحية Service Role — بيتكوّن بس أول ما يُستخدم فعلياً (lazy)،
// مش وقت تحميل الملف. لو سويناه على مستوى الملف مباشرة، Next.js بمرحلة
// "collect page data" وقت الـ build بيستورد الملف وينفّذ هاد السطر، ولو
// NEXT_PUBLIC_SUPABASE_URL مش متوفر وقتها (env مش مفعّل لمرحلة الـ Build)
// بيطلع خطأ ERR_INVALID_URL ويفشل الـ build كامل.
let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabaseAdmin;
}

// يسجل صف بجدول payments بشكل موحّد، وبعدين يحسب عمولات المسوّقين (لو في) على هاي الدفعة
async function recordPayment(userId, payment, isFirstPayment) {
  if (!userId) return;
  const amount = typeof payment?.amount_after_fees === "number" ? payment.amount_after_fees : 0;
  const currency = (payment?.currency || "usd").toUpperCase();
  const { data: row, error } = await getSupabaseAdmin()
    .from("payments")
    .insert({
      user_id: userId,
      amount,
      currency,
      status: "paid",
      method: "whop",
      invoice_url: payment?.receipt_url || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("recordPayment insert failed:", error.message);
    return;
  }

  // عمولة الإحالة المباشرة (بدون طبقات، بدون شجرة) — راجع lib/referral-commissions.js
  if (isFirstPayment) {
    await recordSignupCommission(getSupabaseAdmin(), {
      referredUserId: userId,
      paymentId: row?.id,
      amount,
    }).catch((e) => console.error("recordSignupCommission error:", e));
  } else {
    await recordRenewalCommission(getSupabaseAdmin(), {
      referredUserId: userId,
      paymentId: row?.id,
      amount,
    }).catch((e) => console.error("recordRenewalCommission error:", e));
  }
}

function readUserId(metadata) {
  if (!metadata || typeof metadata !== "object") return null;
  return typeof metadata.user_id === "string" ? metadata.user_id : null;
}

export async function POST(request) {
  const bodyText = await request.text(); // لازم نص خام (raw) عشان التحقق من التوقيع يشتغل
  const headers = Object.fromEntries(request.headers);

  let event;
  try {
    // unwrap بيتحقق من التوقيع (Standard Webhooks) ويرجع الحدث محلل جاهز، وبيرمي خطأ لو التوقيع غلط
    event = getWhop().webhooks.unwrap(bodyText, { headers });
  } catch (err) {
    console.error("Whop webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    switch (event.type) {
      // دفعة ناجحة — أول دفعة تسجيل، أو أي تجديد شهري لاحق.
      // metadata.user_id موجودة فقط على أول دفعة (جاية من checkoutConfigurations.create
      // اللي سوينا بـ app/api/checkout/route.js). التجديدات اللاحقة ما بتحمل metadata
      // دايماً، فمنعتمد وقتها على membership.went_valid/activated (تحت) للمطابقة.
      case "payment.succeeded": {
        const payment = event.data;
        const userId = readUserId(payment.metadata);
        const invoiceId = payment.metadata?.invoice_id || null;
        const membershipId = payment.member?.id || payment.membership?.id || null;

        // مسار البنية الموحّدة الجديدة (lib/payments): كل جلسة دفع مُنشأة عبر
        // app/api/payments/checkout بتحمل invoice_id بالـ metadata. هاد بيمر
        // عبر markInvoicePaid المركزية (بتحدّث جداول subscriptions/invoices
        // الجديدة + profiles + العمولات + جدول payments القديم بخطوة وحدة).
        // أي جلسة قديمة بدون invoice_id (مُنشأة قبل هاد التحديث) بتكمل
        // بالمسار القديم تحت بدون أي تغيير بالسلوك.
        if (invoiceId) {
          try {
            await markInvoicePaid({
              invoiceId,
              providerCode: "whop",
              externalRef: membershipId || payment.id || null,
              rawPayload: payment,
            });
          } catch (e) {
            console.error("markInvoicePaid (whop) failed:", e.message);
          }
          break;
        }

        if (userId) {
          const updateData = {
            subscription_status: "active",
            whop_user_id: payment.member?.user?.id || payment.user?.id || null,
          };
          if (membershipId) updateData.whop_membership_id = membershipId;

          const { data: updated, error } = await getSupabaseAdmin()
            .from("profiles")
            .update(updateData)
            .eq("id", userId)
            .select("id");

          if (error) {
            console.error("Failed to activate subscription:", error);
          } else if (!updated || updated.length === 0) {
            console.error(
              "profiles row missing for user " + userId + " during payment — creating fallback row"
            );
            const { error: insertError } = await getSupabaseAdmin().from("profiles").insert({
              id: userId,
              username: `user_${userId.slice(0, 8)}`,
              role: "student",
              ...updateData,
            });
            if (insertError) console.error("Fallback profile insert also failed:", insertError);
          }
          await recordPayment(userId, payment, true);
          await logActivity(userId, "renew", "دفعة ناجحة — تفعيل الاشتراك", { membershipId });
        } else if (membershipId) {
          // تجديد شهري بدون metadata: نطابق بمعرف العضوية المخزّن مسبقاً
          const { data: renewed, error } = await getSupabaseAdmin()
            .from("profiles")
            .update({ subscription_status: "active" })
            .eq("whop_membership_id", membershipId)
            .select("id")
            .maybeSingle();

          if (error) {
            console.error("Failed to renew subscription:", error);
          } else if (renewed?.id) {
            await recordPayment(renewed.id, payment, false);
            await logActivity(renewed.id, "renew", "تجديد الاشتراك الشهري", { membershipId });
          } else {
            console.error("payment.succeeded with no matching profile for membership:", membershipId);
          }
        }
        break;
      }

      // العضوية أصبحت فعّالة (بديل حدث تفعيل الاشتراك الأول أو استئنافه)
      case "membership.went_valid":
      case "membership.activated": {
        const membership = event.data;
        const userId = readUserId(membership.metadata);
        const whopUserId = membership.user?.id || null;

        const matchColumn = userId ? "id" : "whop_membership_id";
        const matchValue = userId ? userId : membership.id;

        const { data: updated, error } = await getSupabaseAdmin()
          .from("profiles")
          .update({
            subscription_status: "active",
            whop_membership_id: membership.id,
            ...(whopUserId ? { whop_user_id: whopUserId } : {}),
          })
          .eq(matchColumn, matchValue)
          .select("id")
          .maybeSingle();

        if (error) console.error("Failed to mark membership active:", error);
        else if (updated?.id) {
          await logActivity(updated.id, "note", "العضوية أصبحت فعّالة", { membershipId: membership.id });
        }
        break;
      }

      // فشل الدفع أو إلغاء/انتهاء الاشتراك — عطّل الوصول واطرد من Discord
      case "membership.went_invalid":
      case "membership.deactivated": {
        const membership = event.data;
        const { data: updated, error } = await getSupabaseAdmin()
          .from("profiles")
          .update({ subscription_status: "inactive" })
          .eq("whop_membership_id", membership.id)
          .select("id, discord_id, referred_by")
          .maybeSingle();

        if (error) {
          console.error("Failed to deactivate subscription:", error);
        } else if (updated) {
          if (updated.discord_id) {
            await kickMemberFromGuild(updated.discord_id).catch((e) =>
              console.error("Discord kick error:", e)
            );
          }
          if (updated.referred_by) {
            await syncAffiliateTier(getSupabaseAdmin(), updated.referred_by).catch((e) =>
              console.error("syncAffiliateTier failed:", e.message)
            );
          }
          await logActivity(updated.id, "note", "أصبحت العضوية غير فعّالة", {
            membershipId: membership.id,
          });
        }
        break;
      }

      case "payment.failed": {
        const payment = event.data;
        const userId = readUserId(payment.metadata);
        if (userId) {
          await logActivity(userId, "payment_failed", "فشل الدفع", { paymentId: payment.id });
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
