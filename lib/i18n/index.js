import ar from "./dictionaries/ar";
import en from "./dictionaries/en";
import { DEFAULT_LOCALE, isSupportedLocale } from "./config";

const DICTIONARIES = { ar, en };

export function getDictionary(locale) {
  return DICTIONARIES[isSupportedLocale(locale) ? locale : DEFAULT_LOCALE];
}

// t("dashboard.streakText", { days: 5 }) → يبحث بالقاموس المتداخل بنقطة
// الفصل، وبعدين يستبدل أي {placeholder} بالقيمة المقابلة من vars. لو المفتاح
// مش موجود (صفحة لسا ما انترجمت)، بيرجع المفتاح نفسه كـ fallback مرئي بدل ما
// يفشل، حتى تقدر تلاحظ فوراً أي نص لسا ناقص ترجمة أثناء التطوير.
export function createTranslator(locale) {
  const dict = getDictionary(locale);
  return function t(key, vars) {
    const parts = key.split(".");
    let node = dict;
    for (const p of parts) {
      node = node?.[p];
      if (node == null) return key;
    }
    if (typeof node !== "string") return key;
    if (!vars) return node;
    return node.replace(/\{(\w+)\}/g, (_, name) => (vars[name] != null ? String(vars[name]) : `{${name}}`));
  };
}

// يستخدمها raw() بالـ LocaleProvider لما القيمة مش نص (array/object) — متل
// قوائم النصائح أو معلومات العملات. createTranslator/t() فوق مخصص للنصوص فقط.
export function lookupRaw(locale, key) {
  const dict = getDictionary(locale);
  const parts = key.split(".");
  let node = dict;
  for (const p of parts) {
    node = node?.[p];
    if (node == null) return undefined;
  }
  return node;
}
