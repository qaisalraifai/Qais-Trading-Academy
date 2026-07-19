import "./globals.css";
import { Cairo, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import RegisterSW from "./register-sw";

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
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "QTA",
  },
  openGraph: {
    title: "Qais Trading Academy | QTA",
    description: "أكاديمية متكاملة لتعليم التداول من الأساسيات حتى الاحترافية",
    images: ["/logo.jpg"],
  },
};

export const viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body style={{ margin: 0 }}>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
