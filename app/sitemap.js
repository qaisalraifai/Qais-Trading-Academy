import { SITE_URL } from "./layout";

/* ============================================================================
   خريطة الموقع — الصفحات العامة وبس
   ----------------------------------------------------------------------------
   🔴 **كانت تعلن النطاق القديم.** الروابط كلها كانت على
   `qais-trading-academy.vercel.app`، و`middleware.js` بيعمل منه **301** للنطاق
   القائم — يعني كنّا بنسلّم جوجل خريطة كل روابطها تحويلات، وهو بيعاملها
   كإشارة ضعيفة ويأجّل الزحف.

   🔴 **وكانت تعلن `/payment`** — وهي بـ`SESSION_PATHS` يعني بتطلب جلسة،
   فزاحف جوجل بيوصلها كتحويل لصفحة الدخول.

   القاعدة هون: **ما بينكتب إلا مسار بيفتح لزائر بلا حساب.** أي شي بـ
   `SESSION_PATHS` أو `SUBSCRIPTION_PATHS` (`lib/route-access.js`) مطروح، وهو
   نفس اللي بيمنعه `robots.js`.

   ⚠️ ولا نطاق مكتوب بالإيد — `SITE_URL` مصدر واحد مشترك مع البيانات
   الوصفية، فما بيقدروا يتناقضوا زي ما صار.
   ============================================================================ */
export default function sitemap() {
  const now = new Date();
  const pages = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/signup", priority: 0.9, changeFrequency: "monthly" },
    { path: "/login", priority: 0.6, changeFrequency: "monthly" },
    /* الصفحات القانونية: ترتيبها منخفض بس وجودها بالخريطة مقصود — جوجل
       بيعتبرها إشارة مصداقية لموقع فيه اشتراك مدفوع. */
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/refund-policy", priority: 0.3, changeFrequency: "yearly" },
  ];

  return pages.map((p) => ({
    url: `${SITE_URL}${p.path === "/" ? "" : p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
