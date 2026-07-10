import LegalPage from "@/app/components/legal/LegalPage";

export const metadata = {
  title: "سياسة الاسترجاع | Qais Trading Academy",
  description: "سياسة استرجاع الأموال الخاصة بعضوية Qais Trading Academy.",
};

const sectionsAr = [
  {
    heading: "1. نظرة عامة",
    body: [
      "نسعى في Qais Trading Academy لتقديم تجربة تعليمية عالية الجودة. توضح هذه الصفحة متى وكيف يمكنك طلب استرجاع المبلغ المدفوع.",
    ],
  },
  {
    heading: "2. رسوم التسجيل الأولية",
    body: [
      "يحق لك طلب استرجاع كامل رسوم التسجيل الأولية (300$) خلال 7 أيام تقويمية من تاريخ الدفع الأول، بشرط تقديم طلب الاسترجاع عبر قنوات الدعم المتاحة خلال هذه المدة.",
      "بعد مرور 7 أيام من تاريخ الدفع الأول، تصبح رسوم التسجيل غير قابلة للاسترجاع.",
    ],
  },
  {
    heading: "3. الاشتراك الشهري المتجدد",
    body: [
      "الدفعات الشهرية المتجددة ($100 شهرياً) غير قابلة للاسترجاع بمجرد تحصيلها، سواء كانت أول تجديد أو أي تجديد لاحق.",
      "يمكنك إلغاء الاشتراك في أي وقت لمنع أي تجديد مستقبلي، وسيستمر وصولك للمحتوى حتى نهاية فترة الفوترة الحالية المدفوعة مسبقاً دون استرجاع للمبلغ عن الفترة المتبقية.",
    ],
  },
  {
    heading: "4. كيفية طلب الاسترجاع",
    body: [
      "لتقديم طلب استرجاع (خلال فترة الـ 7 أيام لرسوم التسجيل فقط)، يرجى التواصل معنا عبر قنوات الدعم المتاحة على المنصة أو عبر Discord، مع ذكر بريدك الإلكتروني المسجل وتاريخ الدفع.",
      "سيتم مراجعة الطلب ومعالجته خلال مدة معقولة، وإعادة المبلغ إلى وسيلة الدفع الأصلية عبر مزود الدفع Paddle.",
    ],
  },
  {
    heading: "5. حالات استثنائية",
    body: [
      "نحتفظ بالحق في تقييم أي حالة استرجاع خارج هذه السياسة على أساس فردي، خصوصاً في حالات وجود مشكلة تقنية أثرت على وصولك للخدمة.",
    ],
  },
];

const sectionsEn = [
  {
    heading: "1. Overview",
    body: [
      "At Qais Trading Academy, we strive to provide a high-quality educational experience. This page explains when and how you can request a refund.",
    ],
  },
  {
    heading: "2. Initial Sign-Up Fee",
    body: [
      "You are entitled to a full refund of the initial sign-up fee ($300) within 7 calendar days of your first payment date, provided the refund request is submitted through our available support channels within this period.",
      "After 7 days from the initial payment date, the sign-up fee becomes non-refundable.",
    ],
  },
  {
    heading: "3. Recurring Monthly Subscription",
    body: [
      "Recurring monthly charges ($100/month) are non-refundable once collected, whether it is the first renewal or any subsequent renewal.",
      "You may cancel your subscription at any time to prevent future renewals. Your access will continue until the end of the current, already-paid billing period, with no refund for the remaining time in that period.",
    ],
  },
  {
    heading: "4. How to Request a Refund",
    body: [
      "To submit a refund request (within the 7-day window for the sign-up fee only), please contact us through the support channels available on the Platform or via Discord, including your registered email address and payment date.",
      "Requests will be reviewed and processed within a reasonable timeframe, with the amount refunded to the original payment method via our payment provider, Paddle.",
    ],
  },
  {
    heading: "5. Exceptional Cases",
    body: [
      "We reserve the right to evaluate any refund request outside this policy on a case-by-case basis, particularly in cases involving a technical issue that affected your access to the service.",
    ],
  },
];

export default function RefundPolicyPage() {
  return (
    <LegalPage
      titleAr="سياسة الاسترجاع"
      titleEn="Refund Policy"
      sectionsAr={sectionsAr}
      sectionsEn={sectionsEn}
      lastUpdated="July 10, 2026"
    />
  );
}
