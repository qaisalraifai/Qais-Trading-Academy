import "./globals.css";
import { IBM_Plex_Sans_Arabic, Archivo, IBM_Plex_Mono } from "next/font/google";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { getServerLocale } from "@/lib/i18n/get-server-locale";
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

export const metadata = {
  metadataBase: new URL("https://www.qta-academy.store"),
  title: "Qais Trading Academy | QTA",
  description:
    "أكاديمية Qais Trading Academy لتعليم التداول من الأساسيات حتى الاحترافية — أساسيات التداول، التحليل الأساسي، ICT، SK، تدريب 6 أشهر على حساب ديمو، وBacktest مستمر. محاضرات مباشرة ومسجلة.",
  keywords: [
    "Qais Trading Academy",
    "QTA",
    "تعليم التداول",
    "أكاديمية تداول",
    "ICT",
    "تحليل فني",
    "Backtest",
  ],
  verification: {
    google: "y3K0SdO26agCZv7Fs_4sYw7y2pbNyZO3slIJ6MCdmCs",
  },
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "Qais Trading Academy | QTA",
    description: "أكاديمية متكاملة لتعليم التداول من الأساسيات حتى الاحترافية",
    images: ["/logo.jpg"],
  },
};

export default function RootLayout({ children }) {
  const locale = getServerLocale();

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
        <SpaceBackdrop />
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
