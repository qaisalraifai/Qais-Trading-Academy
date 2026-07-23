import "./globals.css";
import { Cairo, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-arabic",
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
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
