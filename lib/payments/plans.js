// تعريف خطط الاشتراك — نفس القيم المخزّنة بجدول billing_plans، هون كـ fallback
// ثابت بالكود حتى تشتغل الحسابات فوراً حتى لو الجدول لسا ما تعبّى (أول تشغيل)
// أو تعذّر الوصول له لحظياً. المرجع الرسمي دايماً هو الداتابيس.

export const PLAN_DEFS = {
  signup: { code: "signup", name: "اشتراك أول (تسجيل)", amount: 300, currency: "USD", interval: "one_time" },
  monthly: { code: "monthly", name: "اشتراك شهري", amount: 100, currency: "USD", interval: "month" },
};

export function getPlanDef(code) {
  return PLAN_DEFS[code] || null;
}

/** يحسب تاريخ نهاية الفترة القادمة حسب نوع الخطة */
export function computePeriodEnd(fromDate, plan) {
  const end = new Date(fromDate);
  if (plan.interval === "month") {
    end.setMonth(end.getMonth() + 1);
  } else {
    // one_time (الاشتراك الأول): بيغطي شهر واحد لحد ما تنشأ أول فاتورة تجديد شهرية
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

// مدة فترة السماح بعد استحقاق الفاتورة قبل تعليق الوصول (بالأيام)
export const GRACE_PERIOD_DAYS = 5;

// كم يوم قبل نهاية الفترة الحالية تُنشأ فاتورة التجديد القادمة
export const RENEWAL_INVOICE_LEAD_DAYS = 7;
