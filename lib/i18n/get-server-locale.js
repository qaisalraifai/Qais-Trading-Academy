import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isSupportedLocale } from "./config";

// يُستخدم فقط جوا Server Components (مثل app/layout.js) لتحديد اللغة الأولية
// قبل أي رندر، حتى ما يصير "وميض" RTL→LTR أو العكس عند أول تحميل للصفحة.
export function getServerLocale() {
  const stored = cookies().get(LOCALE_COOKIE)?.value;
  return isSupportedLocale(stored) ? stored : DEFAULT_LOCALE;
}
