import { redirect } from "next/navigation";

// صفحة /mlm صارت مدمجة داخل /affiliate (تبويب "الشبكة"). هاي الصفحة تبقى موجودة
// بس لأي رابط قديم محفوظ أو مفضّلة، وبتحوّل تلقائياً للصفحة الموحّدة.
export default function MlmPage() {
  redirect("/affiliate?tab=mlm");
}
