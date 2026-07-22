import "./globals.css";
import { Cairo, Plus_Jakarta_Sans, JetBrains_Mono, Inter } from "next/font/google";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { getServerLocale } from "@/lib/i18n/get-server-locale";
import { dirFor } from "@/lib/i18n/config";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-arabic",
  display: "swap",
});

// خط احترافي مخصص للإنجليزية — بيحل محل Cairo تلقائياً وقت locale = "en"
// (عبر قاعدة html.lang-en بملف globals.css)، بدون أي تعديل على Tailwind أو
// أي كلاس موجود بأي صفحة.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-en",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-num",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
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
    icon: "/logo.jpg",
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
      className={`${locale === "ar" ? "lang-ar" : "lang-en"} ${cairo.variable} ${inter.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body style={{ margin: 0 }}>
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
