import ar from "./dictionaries/ar";
import en from "./dictionaries/en";
import { DEFAULT_LOCALE, isSupportedLocale } from "./config";

const DICTIONARIES = { ar, en };

export function getDictionary(locale) {
  return DICTIONARIES[isSupportedLocale(locale) ? locale : DEFAULT_LOCALE];
}

// t("nav.dashboard") → يبحث بالقاموس المتداخل بنقطة الفصل. لو المفتاح مش
// موجود (صفحة لسا ما انترجمت)، بيرجع المفتاح نفسه كـ fallback مرئي بدل ما
// يفشل، حتى تقدر تلاحظ فوراً أي نص لسا ناقص ترجمة أثناء التطوير.
export function createTranslator(locale) {
  const dict = getDictionary(locale);
  return function t(key) {
    const parts = key.split(".");
    let node = dict;
    for (const p of parts) {
      node = node?.[p];
      if (node == null) return key;
    }
    return typeof node === "string" ? node : key;
  };
}
