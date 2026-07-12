import LegalPage from "@/app/components/legal/LegalPage";

export const metadata = {
  title: "الشروط والأحكام | Qais Trading Academy",
  description: "الشروط والأحكام الخاصة باستخدام منصة وعضوية Qais Trading Academy.",
};

const sectionsAr = [
  {
    heading: "1. مقدمة",
    body: [
      "توضح هذه الصفحة الشروط والأحكام التي تحكم استخدامك لموقع ومنصة Qais Trading Academy (\"المنصة\"، \"نحن\"، \"لنا\"). بتسجيلك أو شرائك لعضوية عبر المنصة، فإنك توافق على الالتزام بهذه الشروط بالكامل.",
    ],
  },
  {
    heading: "2. طبيعة الخدمة",
    body: [
      "Qais Trading Academy عبارة عن منصة تعليمية رقمية تقدم محاضرات مسجلة ومباشرة، عضوية في مجتمع Discord خاص، اختبارات تفاعلية، وشروحات تعليمية للتحليل الفني وأساسيات أسواق التداول المالي.",
      "جميع المحتويات المقدمة هي لأغراض تعليمية بحتة، ولا تُعتبر نصيحة استثمارية أو مالية مُلزمة. المنصة لا تقدم أي توصيات شراء أو بيع، ولا إشارات تداول مباشرة (Trading Signals)، ولا تدير أموال أو حسابات المستخدمين بأي شكل. القرارات الاستثمارية والمالية هي مسؤولية المستخدم وحده، ولا تتحمل المنصة أو القائمون عليها أي مسؤولية عن أي خسائر مالية ناتجة عن استخدام المحتوى التعليمي.",
    ],
  },
  {
    heading: "3. الاشتراك والدفع",
    body: [
      "الاشتراك بالعضوية يتم عبر رسوم تسجيل أولية، يتبعها اشتراك شهري متجدد يُخصم تلقائياً من وسيلة الدفع المسجلة، ويستمر إلى أن يقوم المستخدم بإلغاء الاشتراك.",
      "تتم معالجة جميع المدفوعات عبر مزود دفع خارجي معتمد (Paddle)، ونحن لا نقوم بتخزين بيانات بطاقتك الائتمانية على خوادمنا.",
    ],
  },
  {
    heading: "4. إلغاء الاشتراك",
    body: [
      "يمكنك إلغاء اشتراكك في أي وقت من خلال إعدادات حسابك أو عبر التواصل معنا مباشرة. عند الإلغاء، يستمر وصولك للمحتوى حتى نهاية فترة الفوترة الحالية المدفوعة، ولن يتم خصم أي رسوم إضافية بعدها.",
    ],
  },
  {
    heading: "5. سلوك المستخدم",
    body: [
      "يُمنع مشاركة بيانات الدخول أو المحتوى التعليمي أو المحاضرات مع أي طرف ثالث غير مشترك. نحتفظ بالحق في تعليق أو إنهاء أي حساب يخالف هذه الشروط دون استرجاع للرسوم المدفوعة.",
    ],
  },
  {
    heading: "6. التعديلات على الشروط",
    body: [
      "قد نقوم بتحديث هذه الشروط من وقت لآخر. سيتم إشعار المستخدمين بأي تغييرات جوهرية عبر البريد الإلكتروني المسجل أو عبر إشعار على المنصة.",
    ],
  },
  {
    heading: "7. التواصل",
    body: [
      "لأي استفسار متعلق بهذه الشروط، يمكنكم التواصل معنا عبر البريد الإلكتروني qaisalraifai@gmail.com أو عبر قنوات الدعم المتاحة على المنصة أو Discord.",
    ],
  },
];

const sectionsEn = [
  {
    heading: "1. Introduction",
    body: [
      'These Terms and Conditions govern your use of the Qais Trading Academy website and platform ("the Platform", "we", "us"). By registering or purchasing a membership through the Platform, you agree to be bound by these Terms in full.',
    ],
  },
  {
    heading: "2. Nature of the Service",
    body: [
      "Qais Trading Academy is a digital education platform offering recorded and live lectures, access to a private Discord community, interactive quizzes, and educational analysis and insights related to financial trading markets.",
      "All content provided is for educational purposes only and does not constitute financial or investment advice. The Platform does not provide buy/sell recommendations, trading signals, or portfolio/fund management of any kind. Investment and financial decisions are the sole responsibility of the user, and the Platform and its operators bear no liability for any financial losses resulting from the use of the educational content.",
    ],
  },
  {
    heading: "3. Subscription and Payment",
    body: [
      "Membership requires an initial sign-up fee followed by a recurring monthly subscription, automatically charged to the registered payment method, which continues until the user cancels the subscription.",
      "All payments are processed through an authorized third-party payment provider (Paddle). We do not store your credit card details on our servers.",
    ],
  },
  {
    heading: "4. Cancellation",
    body: [
      "You may cancel your subscription at any time through your account settings or by contacting us directly. Upon cancellation, your access will continue until the end of the current paid billing period, after which no further charges will be made.",
    ],
  },
  {
    heading: "5. User Conduct",
    body: [
      "Sharing login credentials, educational content, or lectures with any non-subscribed third party is strictly prohibited. We reserve the right to suspend or terminate any account that violates these Terms without any refund of fees paid.",
    ],
  },
  {
    heading: "6. Changes to These Terms",
    body: [
      "We may update these Terms from time to time. Users will be notified of any material changes via their registered email or through a notice on the Platform.",
    ],
  },
  {
    heading: "7. Contact",
    body: [
      "For any questions regarding these Terms, please reach out via email at qaisalraifai@gmail.com or through the support channels available on the Platform or Discord.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      titleAr="الشروط والأحكام"
      titleEn="Terms of Service"
      sectionsAr={sectionsAr}
      sectionsEn={sectionsEn}
      lastUpdated="July 10, 2026"
    />
  );
}
