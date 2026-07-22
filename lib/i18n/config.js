export const DEFAULT_LOCALE = "ar";
export const SUPPORTED_LOCALES = ["ar", "en"];
export const LOCALE_COOKIE = "qta_locale";
export const LOCALE_STORAGE_KEY = "qta_locale";

// ميتاداتا كل لغة — أضف لغة جديدة مستقبلاً بس بإضافة سطر هون + ملف قاموس مطابق
// تحت lib/i18n/dictionaries/<code>.js
export const LOCALE_META = {
  ar: { code: "ar", nativeName: "العربية", flag: "🇸🇦", dir: "rtl" },
  en: { code: "en", nativeName: "English", flag: "🇺🇸", dir: "ltr" },
};

export function isSupportedLocale(value) {
  return SUPPORTED_LOCALES.includes(value);
}

export function dirFor(locale) {
  return LOCALE_META[locale]?.dir || "ltr";
}
