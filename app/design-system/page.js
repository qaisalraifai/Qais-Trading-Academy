import GalleryClient from "./GalleryClient";

export const metadata = {
  title: "ORBIT — نظام التصميم",
  robots: { index: false, follow: false },
};

/* معرض المكوّنات — صفحة داخلية للمراجعة. مش مربوطة بأي تنقّل ولا محتاجة
   تسجيل دخول، عشان تنفتح مباشرة على /design-system وقت العمل على الهوية. */
export default function DesignSystemPage() {
  return <GalleryClient />;
}
