import ShellPreview from "./ShellPreview";

export const metadata = {
  title: "ORBIT — الغلاف والتنقّل",
  robots: { index: false, follow: false },
};

/* معاينة الغلاف — بيانات وهمية، بدون تسجيل دخول. الغرض مراجعة التنقّل
   والشريط العلوي والرِيل المداري بالعربي والإنجليزي. */
export default function ShellPreviewPage() {
  return <ShellPreview />;
}
