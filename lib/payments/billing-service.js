// طبقة الفوترة الموحّدة (Billing Service)
// ==========================================
// كل عملية شراء/تجديد/تفعيل/تعليق بتمر من هون، بغض النظر عن مزوّد الدفع.
// الـ API routes ولوحة الأدمن بتستدعي هاي الدوال فقط — ما بيلمسوا جداول
// subscriptions/invoices/payment_transactions مباشرة، حتى يضل فيه مكان
// واحد بيعرف "شو يعني دفعة ناجحة" ويطبّقه بنفس الطريقة لكل المزوّدين.

import { createAdminClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications";
import { recordSignupCommission, recordRenewalCommission } from "@/lib/referral-commissions";
import { syncAffiliateTier } from "@/lib/tiers";
import { kickMemberFromGuild } from "@/lib/discord";
import { getAdapter, getProviderRow } from "./registry";
import { getPlanDef, computePeriodEnd, GRACE_PERIOD_DAYS, RENEWAL_INVOICE_LEAD_DAYS } from "./plans";

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** يجيب تعريف الخطة من billing_plans، وبيرجع للقيم الثابتة بالكود لو الجدول فاضي */
async function resolvePlan(admin, planCode) {
  const { data } = await admin.from("billing_plans").select("*").eq("code", planCode).maybeSingle();
  return data || getPlanDef(planCode);
}

/** بيحدد الخطة المناسبة للمستخدم الحالي: أول اشتراك = signup، وإلا monthly */
async function resolveApplicablePlanCode(admin, userId) {
  const { data: profile } = await admin
    .from("profiles")
    .select("subscription_start")
    .eq("id", userId)
    .maybeSingle();
  return profile?.subscription_start ? "monthly" : "signup";
}

/** بينشئ (أو يرجّع الموجودة) اشتراك "قيد الإكمال" للمستخدم */
async function getOrCreateDraftSubscription(admin, userId) {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["incomplete", "active", "past_due", "suspended"])
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await admin
    .from("subscriptions")
    .insert({ user_id: userId, status: "incomplete" })
    .select("*")
    .single();
  if (error) throw new Error("تعذر إنشاء سجل الاشتراك: " + error.message);
  return created;
}

/**
 * نقطة الدخول الرئيسية لبدء أي عملية دفع (أول اشتراك أو تجديد يدوي)،
 * لأي مزوّد مفعّل. تُستخدم من app/api/payments/checkout.
 */
export async function startCheckout({ userId, providerCode }) {
  const admin = createAdminClient();

  const providerRow = await getProviderRow(providerCode, admin);
  if (!providerRow || !providerRow.enabled) {
    throw new Error("وسيلة الدفع هاي غير متاحة حالياً");
  }
  const adapter = getAdapter(providerCode);
  if (!adapter) throw new Error("مزوّد الدفع غير مدعوم");

  const { data: user } = await admin.from("profiles").select("id, username, email").eq("id", userId).maybeSingle();
  if (!user) throw new Error("المستخدم غير موجود");

  const subscription = await getOrCreateDraftSubscription(admin, userId);
  const planCode = await resolveApplicablePlanCode(admin, userId);
  const plan = await resolvePlan(admin, planCode);

  // نعيد استخدام فاتورة مفتوحة موجودة لنفس الخطة بدل تكرارها لو ضغط الطالب زر الدفع أكثر من مرة
  const { data: openInvoice } = await admin
    .from("invoices")
    .select("*")
    .eq("user_id", userId)
    .eq("plan_code", planCode)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .maybeSingle();

  let invoice = openInvoice;
  if (!invoice) {
    const { data: created, error } = await admin
      .from("invoices")
      .insert({
        user_id: userId,
        subscription_id: subscription.id,
        plan_code: plan.code,
        amount: plan.amount,
        currency: plan.currency,
        status: "open",
        provider_code: providerCode,
        due_date: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw new Error("تعذر إنشاء الفاتورة: " + error.message);
    invoice = created;
  } else {
    await admin.from("invoices").update({ provider_code: providerCode }).eq("id", invoice.id);
  }

  const { data: existingTx } = await admin
    .from("payment_transactions")
    .select("*")
    .eq("invoice_id", invoice.id)
    .eq("provider_code", providerCode)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .maybeSingle();

  let transaction = existingTx;
  if (!transaction) {
    const { data: created, error: txError } = await admin
      .from("payment_transactions")
      .insert({
        invoice_id: invoice.id,
        user_id: userId,
        provider_code: providerCode,
        amount: plan.amount,
        currency: plan.currency,
        status: "pending",
      })
      .select("*")
      .single();
    if (txError) throw new Error("تعذر إنشاء عملية الدفع: " + txError.message);
    transaction = created;
  }

  const checkout = await adapter.createCheckout({ user, invoice, plan, config: providerRow.config }, admin);

  return { invoice, transaction, plan, checkout };
}

/** يسجّل صف بجدول payments القديم (توافق مع التقارير/العمولات الحالية) */
async function recordLegacyPaymentRow(admin, { userId, amount, currency, providerCode, invoiceUrl = null, note = null }) {
  const { data: row, error } = await admin
    .from("payments")
    .insert({
      user_id: userId,
      amount: amount || 0,
      currency: (currency || "USD").toUpperCase(),
      status: "paid",
      method: providerCode,
      invoice_url: invoiceUrl,
      note,
    })
    .select("id")
    .single();
  if (error) {
    console.error("recordLegacyPaymentRow failed:", error.message);
    return null;
  }
  return row?.id || null;
}

/**
 * الدالة المركزية: تفعيل اشتراك بعد دفعة ناجحة، بغض النظر عن المزوّد.
 * كل الـ Adapters (Whop webhook، موافقة الأدمن على USDT يدوي، NOWPayments
 * لاحقاً...) بتنتهي هون بنفس النتيجة بالضبط.
 */
export async function markInvoicePaid({ invoiceId, providerCode, externalRef = null, rawPayload = null, transactionId = null }) {
  const admin = createAdminClient();

  const { data: invoice, error: invErr } = await admin.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (invErr || !invoice) throw new Error("الفاتورة غير موجودة");
  if (invoice.status === "paid") return invoice; // idempotent — لو الـ webhook انبعت أكثر من مرة

  const plan = await resolvePlan(admin, invoice.plan_code);
  const adapter = getAdapter(providerCode);
  const autoRenew = Boolean(adapter?.supportsAutoRenew);

  const now = new Date();
  const periodEnd = computePeriodEnd(now, plan);
  const graceEnd = autoRenew ? null : addDays(periodEnd, GRACE_PERIOD_DAYS);

  // 1) الفاتورة
  await admin
    .from("invoices")
    .update({ status: "paid", paid_at: now.toISOString(), provider_code: providerCode, external_ref: externalRef })
    .eq("id", invoice.id);

  // 2) عملية الدفع (لو معروفة)
  if (transactionId) {
    await admin
      .from("payment_transactions")
      .update({ status: "succeeded", external_ref: externalRef, raw_payload: rawPayload })
      .eq("id", transactionId);
  } else {
    // Webhook بدون transaction معروف مسبقاً (مثلاً تجديد Whop تلقائي) — نسجل عملية جديدة للأرشفة
    await admin.from("payment_transactions").insert({
      invoice_id: invoice.id,
      user_id: invoice.user_id,
      provider_code: providerCode,
      amount: invoice.amount,
      currency: invoice.currency,
      status: "succeeded",
      external_ref: externalRef,
      raw_payload: rawPayload,
    });
  }

  // 3) الاشتراك
  let subscriptionId = invoice.subscription_id;
  if (subscriptionId) {
    await admin
      .from("subscriptions")
      .update({
        status: "active",
        provider_code: providerCode,
        auto_renew: autoRenew,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        grace_period_end: graceEnd ? graceEnd.toISOString() : null,
        external_ref: externalRef,
        updated_at: now.toISOString(),
      })
      .eq("id", subscriptionId);
  }

  // 4) profiles — نفس الأعمدة اللي كل النظام الحالي (middleware، الداشبورد...) بيعتمد عليها.
  //    subscription_end بالنسبة لمزوّدين ما إلهم تجديد تلقائي = نهاية فترة السماح (مو نهاية
  //    الفترة المدفوعة فقط)، حتى ما ينحجب الطالب فجأة قبل ما تنعمل محاولة تجديد.
  const isFirstPayment = invoice.plan_code === "signup";
  const profileSubscriptionEnd = autoRenew ? periodEnd : graceEnd;
  const { data: updatedProfile, error: profileErr } = await admin
    .from("profiles")
    .update({
      subscription_status: "active",
      ...(isFirstPayment ? { subscription_start: now.toISOString() } : {}),
      subscription_end: profileSubscriptionEnd.toISOString(),
      auto_renew: autoRenew,
      preferred_payment_provider: providerCode,
    })
    .eq("id", invoice.user_id)
    .select("id, referred_by")
    .maybeSingle();

  if (profileErr) console.error("markInvoicePaid: profile update failed:", profileErr.message);

  // 5) توافق مع جدول payments القديم (تقارير الأدمن، عمولات المسوّقين، لوحة القيادة)
  const legacyPaymentId = await recordLegacyPaymentRow(admin, {
    userId: invoice.user_id,
    amount: invoice.amount,
    currency: invoice.currency,
    providerCode,
  });

  // 6) عمولات الإحالة (نفس منطق webhook Whop القديم بالضبط)
  if (isFirstPayment) {
    await recordSignupCommission(admin, { referredUserId: invoice.user_id, paymentId: legacyPaymentId, amount: invoice.amount }).catch(
      (e) => console.error("recordSignupCommission error:", e)
    );
  } else {
    await recordRenewalCommission(admin, { referredUserId: invoice.user_id, paymentId: legacyPaymentId, amount: invoice.amount }).catch(
      (e) => console.error("recordRenewalCommission error:", e)
    );
  }

  await logActivity(invoice.user_id, "renew", "دفعة ناجحة — تفعيل الاشتراك", {
    provider: providerCode,
    invoiceId: invoice.id,
    planCode: invoice.plan_code,
  });

  await createNotification(admin, invoice.user_id, {
    type: "payment_activated",
    title: "تم تفعيل اشتراكك 🎉",
    message: "استلمنا دفعتك وتم تفعيل/تجديد اشتراكك بنجاح.",
    link: "/dashboard",
  });

  return { ...invoice, status: "paid" };
}

/** يسجّل بيانات التحويل اليدوي (TXID + صورة الإثبات) على عملية دفع قيد الانتظار */
export async function submitManualPayment({ userId, transactionId, walletId, network, txid, proofImagePath }) {
  const admin = createAdminClient();

  const { data: tx, error } = await admin
    .from("payment_transactions")
    .select("*, invoices(*)")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !tx) throw new Error("عملية الدفع غير موجودة");
  if (tx.provider_code !== "manual_usdt") throw new Error("هاي العملية مش دفع يدوي USDT");
  if (tx.status === "succeeded") throw new Error("هاي العملية موافق عليها مسبقاً");

  const { error: submissionError } = await admin.from("manual_payment_submissions").insert({
    transaction_id: tx.id,
    wallet_id: walletId || null,
    network,
    txid: txid || null,
    proof_image_path: proofImagePath || null,
  });
  if (submissionError) {
    throw new Error("تعذر حفظ إثبات الدفع: " + submissionError.message);
  }

  // نرجّع حالة العملية "pending" صراحة (بحال كانت rejected سابقاً وأعاد الطالب المحاولة)
  await admin
    .from("payment_transactions")
    .update({ status: "pending", rejection_reason: null, reviewed_by: null, reviewed_at: null })
    .eq("id", tx.id);

  await logActivity(userId, "note", "رفع إثبات تحويل USDT — بانتظار مراجعة الأدمن", { transactionId: tx.id, network });

  return { success: true };
}

/**
 * بعد ما الطالب يختار عملة كريبتو بواجهتنا (NOWPayments)، هاي بتنشئ عملية
 * الدفع الفعلية وترجع عنوان محفظة + مبلغ لعرضهم داخل موقعنا مباشرة —
 * بدون أي تحويل لصفحة خارجية.
 */
export async function selectCryptoCurrency({ userId, transactionId, payCurrency }) {
  const admin = createAdminClient();
  const { data: tx, error } = await admin
    .from("payment_transactions")
    .select("*, invoices(*)")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !tx) throw new Error("عملية الدفع غير موجودة");
  if (tx.provider_code !== "nowpayments") throw new Error("هاي العملية مش كريبتو تلقائي");
  if (tx.status !== "pending") throw new Error("هاي العملية ما عادت قابلة للدفع");

  const plan = await resolvePlan(admin, tx.invoices.plan_code);
  const adapter = getAdapter("nowpayments");

  const payment = await adapter.createPaymentForCurrency({ invoice: tx.invoices, plan, payCurrency });

  await admin
    .from("payment_transactions")
    .update({ external_ref: payment.paymentId, raw_payload: payment })
    .eq("id", tx.id);

  return payment;
}


export async function approveManualTransaction({ transactionId, adminUserId }) {
  const admin = createAdminClient();
  const { data: tx, error } = await admin.from("payment_transactions").select("*").eq("id", transactionId).maybeSingle();
  if (error || !tx) throw new Error("العملية غير موجودة");
  if (tx.provider_code !== "manual_usdt") throw new Error("هاي العملية مش دفع يدوي USDT");

  await admin
    .from("payment_transactions")
    .update({ reviewed_by: adminUserId, reviewed_at: new Date().toISOString() })
    .eq("id", tx.id);

  const invoice = await markInvoicePaid({
    invoiceId: tx.invoice_id,
    providerCode: "manual_usdt",
    externalRef: tx.external_ref,
    transactionId: tx.id,
  });

  return invoice;
}

/** الأدمن بيرفض دفعة USDT يدوية — بيرجع سبب الرفض للطالب */
export async function rejectManualTransaction({ transactionId, adminUserId, reason }) {
  const admin = createAdminClient();
  const { data: tx, error } = await admin.from("payment_transactions").select("*").eq("id", transactionId).maybeSingle();
  if (error || !tx) throw new Error("العملية غير موجودة");

  await admin
    .from("payment_transactions")
    .update({
      status: "rejected",
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason || null,
    })
    .eq("id", tx.id);

  await createNotification(admin, tx.user_id, {
    type: "payment_rejected",
    title: "تعذّرت مراجعة إثبات الدفع",
    message: reason ? `السبب: ${reason}` : "راجع بيانات التحويل وحاول مرة ثانية.",
    link: "/payment",
  });

  await logActivity(tx.user_id, "payment_failed", "رفض دفعة USDT يدوية", { transactionId: tx.id, reason });

  return { success: true };
}

// =====================================================================
// دورة الفوترة (Billing Cycle) — تُستدعى من app/api/cron/billing يومياً
// =====================================================================

/** ينشئ فاتورة تجديد قادمة لكل اشتراك نشط بدون تجديد تلقائي، قبل موعد الاستحقاق بأيام محددة */
async function generateUpcomingRenewalInvoices(admin) {
  const now = new Date();
  const leadEdge = addDays(now, RENEWAL_INVOICE_LEAD_DAYS);

  const { data: dueSoon } = await admin
    .from("subscriptions")
    .select("*")
    .in("status", ["active", "past_due"])
    .eq("auto_renew", false)
    .lte("current_period_end", leadEdge.toISOString());

  let created = 0;
  for (const sub of dueSoon || []) {
    const { data: existingOpen } = await admin
      .from("invoices")
      .select("id")
      .eq("subscription_id", sub.id)
      .eq("status", "open")
      .eq("plan_code", "monthly")
      .gte("created_at", sub.current_period_start || sub.created_at)
      .maybeSingle();
    if (existingOpen) continue;

    const plan = await resolvePlan(admin, "monthly");
    await admin.from("invoices").insert({
      user_id: sub.user_id,
      subscription_id: sub.id,
      plan_code: "monthly",
      amount: plan.amount,
      currency: plan.currency,
      status: "open",
      provider_code: sub.provider_code,
      due_date: sub.current_period_end,
    });
    created += 1;
  }
  return created;
}

async function sendBillingNotification(admin, { userId, invoiceId, kind, title, message }) {
  // idempotent بفضل الـ unique index على (invoice_id, kind)
  const { error } = await admin.from("billing_notifications_log").insert({ user_id: userId, invoice_id: invoiceId, kind });
  if (error) return false; // موجودة مسبقاً أو خطأ — ما منرسل تكرار
  await createNotification(admin, userId, { type: "billing", title, message, link: "/settings" });
  return true;
}

/** إشعارات 7 أيام / 3 أيام / يوم الاستحقاق لكل فاتورة مفتوحة إلها due_date */
async function sendRenewalReminders(admin) {
  const now = new Date();
  const { data: openInvoices } = await admin
    .from("invoices")
    .select("id, user_id, due_date, amount, currency")
    .eq("status", "open")
    .not("due_date", "is", null);

  let sent = 0;
  for (const inv of openInvoices || []) {
    const due = new Date(inv.due_date);
    const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

    if (daysLeft === 7) {
      if (await sendBillingNotification(admin, {
        userId: inv.user_id, invoiceId: inv.id, kind: "upcoming_7d",
        title: "تذكير: موعد التجديد بعد 7 أيام",
        message: `فاتورتك القادمة بقيمة ${inv.amount} ${inv.currency} مستحقة خلال أسبوع.`,
      })) sent++;
    } else if (daysLeft === 3) {
      if (await sendBillingNotification(admin, {
        userId: inv.user_id, invoiceId: inv.id, kind: "upcoming_3d",
        title: "تذكير: موعد التجديد بعد 3 أيام",
        message: `فاتورتك القادمة بقيمة ${inv.amount} ${inv.currency} مستحقة خلال 3 أيام.`,
      })) sent++;
    } else if (daysLeft <= 0) {
      if (await sendBillingNotification(admin, {
        userId: inv.user_id, invoiceId: inv.id, kind: "due_today",
        title: "فاتورتك مستحقة الآن",
        message: `الرجاء سداد ${inv.amount} ${inv.currency} لتجنّب تعليق الاشتراك.`,
      })) sent++;
    }
  }
  return sent;
}

/** تعليق الاشتراكات اللي خلصت فترة السماح تبعها بدون دفع */
async function suspendOverdueSubscriptions(admin) {
  const now = new Date().toISOString();
  const { data: overdue, error } = await admin
    .from("subscriptions")
    .update({ status: "suspended" })
    .in("status", ["active", "past_due"])
    .not("grace_period_end", "is", null)
    .lt("grace_period_end", now)
    .select("id, user_id");

  if (error) {
    console.error("suspendOverdueSubscriptions failed:", error.message);
    return 0;
  }

  for (const row of overdue || []) {
    const { data: profile } = await admin
      .from("profiles")
      .update({ subscription_status: "inactive" })
      .eq("id", row.user_id)
      .select("id, discord_id, referred_by")
      .maybeSingle();

    if (profile?.discord_id) await kickMemberFromGuild(profile.discord_id).catch(() => {});
    if (profile?.referred_by) await syncAffiliateTier(admin, profile.referred_by).catch(() => {});

    await sendBillingNotification(admin, {
      userId: row.user_id,
      invoiceId: null,
      kind: "suspended",
      title: "تم تعليق اشتراكك",
      message: "انتهت فترة السماح بدون سداد الفاتورة. جدّد اشتراكك لاستعادة الوصول فوراً.",
    });
    await logActivity(row.user_id, "suspended", "تعليق تلقائي بعد انتهاء فترة السماح (دفع بدون تجديد تلقائي)");
  }

  return overdue?.length || 0;
}

/** الدالة اللي يستدعيها app/api/cron/billing يومياً — تشغّل دورة الفوترة كاملة */
export async function runBillingCycle() {
  const admin = createAdminClient();
  const invoicesCreated = await generateUpcomingRenewalInvoices(admin);
  const remindersSent = await sendRenewalReminders(admin);
  const suspended = await suspendOverdueSubscriptions(admin);
  return { invoicesCreated, remindersSent, suspended, timestamp: new Date().toISOString() };
}
