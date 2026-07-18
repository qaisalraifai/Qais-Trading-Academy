import LegalPage from "@/app/components/legal/LegalPage";

export const metadata = {
  title: "سياسة الاسترجاع | Qais Trading Academy",
  description: "سياسة الاسترجاع الخاصة بمنصة وعضوية Qais Trading Academy.",
};

const sectionsAr = [
  {
    heading: "1. مقدمة",
    body: [
      "توضح هذه الصفحة سياسة استرجاع الأموال الخاصة باشتراكات وعضويات Qais Trading Academy (\"المنصة\"). نهدف إلى ضمان تجربة عادلة وشفافة لجميع المشتركين.",
    ],
  },
  {
    heading: "2. فترة الاسترجاع",
    body: [
      "يحق للمشترك الجديد طلب استرجاع كامل المبلغ المدفوع خلال 7 أيام من تاريخ أول عملية اشتراك، بشرط ألا يكون قد تجاوز نسبة محدودة من استهلاك المحتوى التعليمي (المحاضرات المسجلة والمباشرة) خلال هذه الفترة.",
      "بعد انقضاء مدة الـ 7 أيام، لا يحق للمشترك طلب استرجاع عن نفس دورة الفوترة، وتبقى العضوية سارية حتى نهاية الفترة المدفوعة كما هو موضح في الشروط والأحكام.",
    ],
  },
  {
    heading: "3. الاشتراك الشهري المتجدد",
    body: [
      "نظراً لطبيعة الاشتراك الشهري المتجدد تلقائياً، فإن إلغاء الاشتراك لا يعني استرجاعاً فورياً للرسوم؛ بل يوقف التجديد التلقائي للدورة القادمة فقط، ويستمر الوصول للمحتوى حتى نهاية الفترة المدفوعة الحالية.",
      "رسوم التسجيل الأولية (إن وُجدت) غير قابلة للاسترجاع بعد مرور فترة الـ 7 أيام المذكورة أعلاه.",
    ],
  },
  {
    heading: "4. الحالات المستثناة من الاسترجاع",
    body: [
      "لا يحق طلب الاسترجاع في الحالات التالية: تجاوز فترة السماح المحددة (7 أيام)، إثبات استخدام مكثف أو كامل للمحتوى التعليمي خلال فترة السماح، أو إنهاء الحساب بسبب مخالفة الشروط والأحكام (مثل مشاركة بيانات الدخول أو المحتوى مع طرف ثالث).",
    ],
  },
  {
    heading: "5. آلية تقديم طلب الاسترجاع",
    body: [
      "لتقديم طلب استرجاع، يُرجى التواصل معنا عبر البريد الإلكتروني qaisalraifai@gmail.com مرفقاً بريد الحساب المسجل وتاريخ الاشتراك وسبب الطلب.",
      "تتم مراجعة الطلبات المستوفية للشروط ومعالجتها خلال مدة أقصاها 14 يوم عمل، ويُعاد المبلغ إلى وسيلة الدفع الأصلية المستخدمة عبر مزود الدفع Paddle.",
    ],
  },
  {
    heading: "6. التعديلات على السياسة",
    body: [
      "قد نقوم بتحديث سياسة الاسترجاع من وقت لآخر. سيتم إشعار المستخدمين بأي تغييرات جوهرية عبر البريد الإلكتروني المسجل أو عبر إشعار على المنصة، ولا تسري التغييرات بأثر رجعي على اشتراكات قائمة تم الدفع عنها مسبقاً.",
    ],
  },
  {
    heading: "7. التواصل",
    body: [
      "لأي استفسار متعلق بسياسة الاسترجاع، يمكنكم التواصل معنا عبر البريد الإلكتروني qaisalraifai@gmail.com أو عبر قنوات الدعم المتاحة على المنصة أو Discord.",
    ],
  },
];

const sectionsEn = [
  {
    heading: "1. Introduction",
    body: [
      "This page explains the refund policy for Qais Trading Academy (\"the Platform\") subscriptions and memberships. We aim to ensure a fair and transparent experience for all subscribers.",
    ],
  },
  {
    heading: "2. Refund Window",
    body: [
      "New subscribers may request a full refund within 7 days of their first subscription payment, provided they have not exceeded a limited amount of consumption of the educational content (recorded and live lectures) during this period.",
      "After the 7-day window has passed, no refund can be requested for that billing cycle, and the membership remains active until the end of the paid period, as described in the Terms of Service.",
    ],
  },
  {
    heading: "3. Recurring Monthly Subscription",
    body: [
      "Because the subscription renews automatically on a monthly basis, cancelling it does not trigger an immediate refund; it only stops the automatic renewal of the next cycle, and access continues until the end of the current paid period.",
      "The initial registration fee (if applicable) is non-refundable once the 7-day window above has elapsed.",
    ],
  },
  {
    heading: "4. Exceptions to Refunds",
    body: [
      "Refunds will not be granted in the following cases: the 7-day grace period has passed, evidence of extensive or complete use of the educational content during the grace period, or account termination due to a violation of the Terms of Service (such as sharing login credentials or content with a third party).",
    ],
  },
  {
    heading: "5. How to Request a Refund",
    body: [
      "To request a refund, please contact us at qaisalraifai@gmail.com with your registered account email, subscription date, and reason for the request.",
      "Eligible requests are reviewed and processed within a maximum of 14 business days, and the amount is refunded to the original payment method via our payment provider, Paddle.",
    ],
  },
  {
    heading: "6. Changes to This Policy",
    body: [
      "We may update this refund policy from time to time. Users will be notified of any material changes via their registered email or a notice on the Platform, and changes will not apply retroactively to existing subscriptions already paid for.",
    ],
  },
  {
    heading: "7. Contact",
    body: [
      "For any questions regarding this refund policy, please reach out via email at qaisalraifai@gmail.com or through the support channels available on the Platform or Discord.",
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
      lastUpdated="July 12, 2026"
    />
  );
}
