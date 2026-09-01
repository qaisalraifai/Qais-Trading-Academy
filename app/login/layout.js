/* غلاف بيانات وصفية وبس — نفس سبب `signup/layout.js`.
   ⚠️ **مفهرسة عمداً**: صفحة الدخول هي اللي بيدوّر عليها العضو القائم لما
   يكتب اسم الأكاديمية بجوجل، فمنعها بيرمي أكتر بحث متكرر على لا شي. */
export const metadata = {
  title: "تسجيل الدخول",
  description: "سجّل دخولك إلى منصّة Qais Trading Academy للوصول إلى محاضراتك وأدوات التحليل.",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }) {
  return children;
}
