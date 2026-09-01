import ar from "./dictionaries/ar.js";
import en from "./dictionaries/en.js";
import { DEFAULT_LOCALE, isSupportedLocale } from "./config.js";
import { pickForm } from "../gender.js";

const DICTIONARIES = { ar, en };

export function getDictionary(locale) {
  return DICTIONARIES[isSupportedLocale(locale) ? locale : DEFAULT_LOCALE];
}

// t("dashboard.streakText", { days: 5 }) → يبحث بالقاموس المتداخل بنقطة
// الفصل، وبعدين يستبدل أي {placeholder} بالقيمة المقابلة من vars. لو المفتاح
// مش موجود (صفحة لسا ما انترجمت)، بيرجع المفتاح نفسه كـ fallback مرئي بدل ما
// يفشل، حتى تقدر تلاحظ فوراً أي نص لسا ناقص ترجمة أثناء التطوير.
/* ⚠️ **الصيغة بتنطبّق قبل استبدال المتغيّرات.** لو انعكس الترتيب، أي اسم فيه
   `|` (بيانات مستخدم) كان بينقصّ كأنه فاصل صيغة — يعني نص المستخدم بيتحكّم
   بمنطق العرض. الفاصل ملك **القاموس** وبس. */
export function createTranslator(locale, gender = null) {
  const dict = getDictionary(locale);
  return function t(key, vars) {
    const parts = key.split(".");
    let node = dict;
    for (const p of parts) {
      node = node?.[p];
      if (node == null) return key;
    }
    if (typeof node !== "string") return key;
    const form = pickForm(node, gender);
    if (!vars) return form;
    return form.replace(/\{(\w+)\}/g, (_, name) => (vars[name] != null ? String(vars[name]) : `{${name}}`));
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
