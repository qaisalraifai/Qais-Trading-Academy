/* غلاف بيانات وصفية وبس — `page.js` هون `"use client"` فما بيقدر يصدّر
   `metadata`، وهاي الطريقة الموثَّقة بـNext لصفحة عميل.
   ⚠️ ما بيلفّ ولا شي ولا بيغيّر أي مسار: بيرجّع أولاده كما هم. */
export const metadata = {
  title: "إنشاء حساب",
  description:
    "سجّل في Qais Trading Academy — وصول لجميع المحاضرات المسجّلة والمباشرة، تدريب 6 أشهر على حساب ديمو، ودعم مباشر من المدرّب.",
  alternates: { canonical: "/signup" },
};

export default function SignupLayout({ children }) {
  return children;
}
