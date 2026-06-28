export const metadata = {
  title: "منصة التعليم",
  description: "منصة تعليمية بمحاضرات واختبارات",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
