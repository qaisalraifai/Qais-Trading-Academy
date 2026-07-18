import LegalPage from "@/app/components/legal/LegalPage";

export const metadata = {
  title: "سياسة الخصوصية | Qais Trading Academy",
  description: "سياسة الخصوصية الخاصة بمنصة وعضوية Qais Trading Academy.",
};

const sectionsAr = [
  {
    heading: "1. مقدمة",
    body: [
      "نحن في Qais Trading Academy نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. توضح هذه السياسة نوع البيانات التي نجمعها، وكيفية استخدامها وحمايتها.",
    ],
  },
  {
    heading: "2. البيانات التي نجمعها",
    body: [
      "عند التسجيل واستخدام المنصة، قد نجمع: الاسم، البريد الإلكتروني، معرّف حساب Discord (عند الربط)، وبيانات الاشتراك والدفع (عبر مزود الدفع Whop، دون تخزين تفاصيل بطاقتك لدينا مباشرة).",
      "قد نجمع أيضاً بيانات استخدام عامة مثل تقدمك في المحاضرات والاختبارات لأغراض تحسين تجربتك التعليمية.",
    ],
  },
  {
    heading: "3. كيفية استخدام البيانات",
    body: [
      "نستخدم بياناتك لتفعيل وإدارة اشتراكك، منحك الوصول للمحاضرات وعضوية Discord، التواصل معك بخصوص حسابك، وتحسين جودة الخدمة المقدمة.",
      "لا نقوم ببيع أو تأجير بياناتك الشخصية لأي طرف ثالث لأغراض تسويقية.",
    ],
  },
  {
    heading: "4. مشاركة البيانات مع أطراف ثالثة",
    body: [
      "نشارك بعض بياناتك مع مزودي خدمات موثوقين ضروريين لتشغيل المنصة، مثل: Whop (معالجة المدفوعات)، Supabase (تخزين قاعدة البيانات)، وDiscord (إدارة العضوية المجتمعية). هؤلاء المزودون ملزمون بحماية بياناتك وفق سياساتهم الخاصة.",
    ],
  },
  {
    heading: "5. أمان البيانات",
    body: [
      "نتخذ إجراءات تقنية وتنظيمية معقولة لحماية بياناتك من الوصول غير المصرح به أو الفقدان أو الإفصاح غير القانوني.",
    ],
  },
  {
    heading: "6. حقوقك",
    body: [
      "يحق لك في أي وقت طلب الاطلاع على بياناتك الشخصية المخزنة لدينا، تصحيحها، أو طلب حذفها (مع مراعاة أي التزامات قانونية أو تعاقدية قد تمنع الحذف الفوري في بعض الحالات).",
    ],
  },
  {
    heading: "7. التواصل",
    body: [
      "لأي استفسار متعلق بخصوصيتك أو بياناتك، يمكنكم التواصل معنا عبر البريد الإلكتروني qaisalraifai@gmail.com أو عبر قنوات الدعم المتاحة على المنصة أو Discord.",
    ],
  },
];

const sectionsEn = [
  {
    heading: "1. Introduction",
    body: [
      "At Qais Trading Academy, we respect your privacy and are committed to protecting your personal data. This policy explains what data we collect, and how we use and protect it.",
    ],
  },
  {
    heading: "2. Data We Collect",
    body: [
      "When you register and use the Platform, we may collect: your name, email address, Discord account ID (when linked), and subscription/payment data (processed via our payment provider, Whop, without us storing your card details directly).",
      "We may also collect general usage data, such as your progress through lectures and quizzes, to improve your learning experience.",
    ],
  },
  {
    heading: "3. How We Use Your Data",
    body: [
      "We use your data to activate and manage your subscription, grant you access to lectures and the Discord community, communicate with you regarding your account, and improve the quality of the service.",
      "We do not sell or rent your personal data to any third party for marketing purposes.",
    ],
  },
  {
    heading: "4. Sharing Data with Third Parties",
    body: [
      "We share some of your data with trusted service providers necessary to operate the Platform, such as: Whop (payment processing), Supabase (database storage), and Discord (community membership management). These providers are bound to protect your data under their own policies.",
    ],
  },
  {
    heading: "5. Data Security",
    body: [
      "We take reasonable technical and organizational measures to protect your data from unauthorized access, loss, or unlawful disclosure.",
    ],
  },
  {
    heading: "6. Your Rights",
    body: [
      "You have the right at any time to request access to your personal data held by us, request corrections, or request deletion (subject to any legal or contractual obligations that may prevent immediate deletion in certain cases).",
    ],
  },
  {
    heading: "7. Contact",
    body: [
      "For any questions regarding your privacy or data, please reach out via email at qaisalraifai@gmail.com or through the support channels available on the Platform or Discord.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      titleAr="سياسة الخصوصية"
      titleEn="Privacy Policy"
      sectionsAr={sectionsAr}
      sectionsEn={sectionsEn}
      lastUpdated="July 10, 2026"
    />
  );
}
