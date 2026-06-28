export const metadata = {
  title: "Qais Trading Academy | QTA",
  description:
    "أكاديمية Qais Trading Academy لتعليم التداول من الأساسيات حتى الاحترافية — أساسيات التداول، التحليل الأساسي، ICT، SK، تدريب 6 أشهر على حساب ديمو، وBacktest مستمر. محاضرات لايف ومسجلة.",
  keywords: [
    "Qais Trading Academy",
    "QTA",
    "تعليم التداول",
    "أكاديمية تداول",
    "ICT",
    "تحليل فني",
    "Backtest",
  ],
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
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
