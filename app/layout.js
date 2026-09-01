import "./globals.css";
import { IBM_Plex_Sans_Arabic, Archivo, IBM_Plex_Mono } from "next/font/google";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { getServerLocale } from "@/lib/i18n/get-server-locale";
import { getServerGender } from "@/lib/get-server-gender";
import { dirFor } from "@/lib/i18n/config";
import SpaceBackdrop from "./components/brand/SpaceBackdrop";

/* ============================================================================
   ORBIT — نظام الخطوط
   ----------------------------------------------------------------------------
   عائلة واحدة للواجهة بتغطّي العربي واللاتيني (IBM Plex Sans Arabic) — يعني
   ما في "خط عربي" و"خط إنجليزي" منفصلين ولا تبديل بينهم، نفس البنية الحرفية
   ونفس الأوزان بالحالتين. Archivo للعناوين والأرقام الكبيرة (أرقام جدولية
   ممتازة + عرض صناعي بيعطي إحساس أجهزة قياس). IBM Plex Mono لرموز الأزواج
   والتوقيتات والمعرّفات.
   ============================================================================ */

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

/* ============================================================================
   الهوية على محرّكات البحث والمشاركة
   ----------------------------------------------------------------------------
   ⚠️ **النطاق مصدره واحد.** `middleware.js` بيعمل 301 من نطاق Vercel القديم
   لهاد، فأي رابط ننشره على النطاق التاني بيوصل جوجل كتحويل. كان `sitemap.js`
   بيعلن النطاق القديم حرفياً — يعني خريطة موقع كل روابطها redirects.

   ⚠️ **أيقونة نتائج البحث بدها مضاعف ٤٨.** جوجل بيتجاهل أي أقل، وكان الوحيد
   المعلَن `favicon-32.png` (٣٢px) — فما كان في أيقونة تظهر أصلاً. والأيقونات
   كلها كانت الشعار **الذهبي القديم** بينما `logo.svg` بالتبويب هو الجديد؛
   انولّدت من `logo.svg` نفسه فما بيقدروا يفترقوا. القديمة محفوظة بـ
   `public/icons/legacy-gold/`.

   ⚠️ **صورة المشاركة كانت `logo.jpg`** — مربّعة ٦٤٠×٦٤٠ وبالشعار القديم،
   فبتنقصّ من الطرفين بكل المنصّات. صارت ١٢٠٠×٦٣٠ (النسبة المعيارية 1.91:1).
   ============================================================================ */
export const SITE_URL = "https://www.qta-academy.store";
const SITE_NAME = "Qais Trading Academy";
/* ═══════════════════════════════════════════════════════════════════════════
   وصف المنصّة — **انعاد بعد ما صارت أدوات مش محاضرات وبس**
   ---------------------------------------------------------------------------
   الوصف القديم كان: «أساسيات · تحليل أساسي · ICT · SK · تدريب ديمو ·
   Backtest · محاضرات». يعني بيوصف **منهجاً تعليمياً** — وما بيذكر ولا وحدة
   من الأدوات اللي انبنت بعده: الاستعراض التاريخي، رادار الفرص، سجل الصفقات،
   تقارير الأداء، بصمة المتداول، التقويم الاقتصادي.

   ⚠️ **وكان أطول من اللازم**: ٢١٦ حرفاً، وجوجل بيقصّ حوالي ١٦٠ — فآخر ثلثه
   ما كان يوصل القارئ أصلاً.

   ⚠️ **وما فيه ولا ادّعاء ذكاء اصطناعي.** المنصّة فيها اسم منتج «صفقات QAIS
   AI»، بس المحرّك تحته **حتمي** بالكامل ولا تكامل LLM بالمشروع (موثّق
   بـ`CLAUDE.md`). فالوصف بيقول «محرّك يطبّق منهجية SK» — وهاد اللي موجود
   فعلاً، وأقوى من ادّعاء ما بينسند.
   ═══════════════════════════════════════════════════════════════════════════ */
const SITE_DESCRIPTION =
  "منهج تداول كامل من الأساسيات حتى ICT وSK، محاضرات مباشرة ومسجّلة، وأدوات تطبّق مفاهيم المنهج نفسها على السوق الحقيقي: استعراض تاريخي، رادار فرص، وسجل أداء.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Qais Trading Academy | QTA",
    /* الصفحات الداخلية بتعطي اسمها وبس، واللاحقة بتنضاف — بدل ما كل صفحة
       تعيد كتابة اسم الموقع بعنوانها. */
    template: "%s | Qais Trading Academy",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Qais Trading Academy",
    "QTA",
    "تعليم التداول",
    "أكاديمية تداول",
    "ICT",
    "تحليل فني",
    "Backtest",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  /* بلا هاد بيقدر يوصل نفس المحتوى بأكتر من رابط (نطاق قديم · `?` زايدة)
     وينقسم ترتيبه بينهن. */
  alternates: { canonical: "/" },
  verification: {
    google: "y3K0SdO26agCZv7Fs_4sYw7y2pbNyZO3slIJ6MCdmCs",
  },
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      /* ٤٨ و٩٦ هن اللي بيقراهن جوجل — مضاعفات ٤٨. و٣٢ للتبويب بالمتصفّحات
         القديمة اللي ما بتقرا SVG. */
      { url: "/icons/favicon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    /* الأردن مصدرها نموذج التسجيل نفسه (`+962` بخانة الهاتف) — مش افتراض. */
    locale: "ar_JO",
    url: SITE_URL,
    title: "Qais Trading Academy | QTA",
    description: SITE_DESCRIPTION,
    images: [
      {
        /* ⚠️ **مطلق صراحةً مش نسبي.** المسار النسبي بينحلّ على أصل الطلب،
           فبالتطوير طلع `http://localhost:3000/brand/og-cover.png` (مقيس).
           والزاحف اللي بيقرا الوسم بيجلب الصورة من الرابط كما هو — فأي أصل
           غير عام بيعني صورة ما بتوصل. */
        url: `${SITE_URL}/brand/og-cover.png`,
        width: 1200,
        height: 630,
        alt: "Qais Trading Academy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Qais Trading Academy | QTA",
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/brand/og-cover.png`],
  },
};

/* ============================================================================
   بيانات منظَّمة (JSON-LD) — كيف بيعرف جوجل «مين هالموقع»
   ----------------------------------------------------------------------------
   البيانات الوصفية فوق بتوصف **الصفحة**؛ هاي بتوصف **الجهة**. وهي المسار
   الموثَّق اللي بياخد منه جوجل اسم المنظّمة وشعارها للوحة المعرفة ونتائج
   البحث — بلاها بيخمّن الاسم من العنوان ويطلّع الشعار من الفافيكون وبس.

   ⚠️ **ولا معلومة مخترعة هون.** الوصف نفس وصف الصفحة الأولى حرفياً، والبريد
   هو المنشور بصفحة الشروط، والمواد الستّة من بطاقات الصفحة الأولى نفسها.
   أي حقل ما إله مصدر بالمنصّة (هاتف · عنوان · حسابات تواصل) **مش مكتوب** —
   بيانات منظَّمة مش مطابقة للواقع بتضرّ أكتر من غيابها.

   `EducationalOrganization` أدقّ من `Organization` وبيرثه، فرِچ النتائج
   الخاصة بالشعار بتشتغل عليه زي ما بتشتغل على الأب.
   ============================================================================ */
function StructuredData() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOrganization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: "QTA",
        url: SITE_URL,
        /* الشعار: PNG مربّع ٥١٢ — جوجل بيطلبه نقطياً وقابلاً للزحف. */
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/icons/icon-512.png`,
          width: 512,
          height: 512,
        },
        image: `${SITE_URL}/brand/og-cover.png`,
        description: SITE_DESCRIPTION,
        email: "qaisalraifai@gmail.com",
        inLanguage: "ar",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "ar",
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      /* ⚠️ المحتوى ثابت مكتوب هون — ولا حرف منه جاي من مستخدم ولا من قاعدة
         البيانات، فما في مدخل حقن. */
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}

export default function RootLayout({ children }) {
  const locale = getServerLocale();
  const gender = getServerGender();

  return (
    <html
      lang={locale}
      dir={dirFor(locale)}
      className={`${locale === "ar" ? "lang-ar" : "lang-en"} ${plexArabic.variable} ${archivo.variable} ${plexMono.variable}`}
    >
      {/* ⚠️ `isolation: isolate` **ممنوعة** على الجسم هون: `SpaceBackdrop`
         بتقعد على `z-index: -10`، وهي بترسم فوق خلفية الجسم لأنّ الأبناء
         سالبي الترتيب بينرسموا **بعد** خلفية أبيهم — بس هاد بيصير بس لو
         الجسم ما عامل سياق تراص. أي `isolate` أو `transform` هون بتخفي
         الطبقة كلياً. */}
      <body style={{ margin: 0 }}>
        <StructuredData />
        <SpaceBackdrop />
        <LocaleProvider initialLocale={locale} initialGender={gender}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
