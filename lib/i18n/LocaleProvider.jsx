"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_STORAGE_KEY, LOCALE_META, isSupportedLocale, dirFor } from "./config";
import { createTranslator, lookupRaw } from "./index";

const LocaleContext = createContext(null);

function applyDocumentLocale(locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = dirFor(locale);
  document.documentElement.classList.toggle("lang-ar", locale === "ar");
  document.documentElement.classList.toggle("lang-en", locale === "en");
}

// ============================================================================
// LocaleProvider — يغلّف كل التطبيق (app/layout.js). initialLocale جاي من
// السيرفر (كوكي qta_locale) لتفادي "وميض" اتجاه/لغة خاطئة أول تحميل. بعد
// أول رندر، منقارن مع localStorage (ولو المستخدم مسجّل دخول ومحفوظ إله لغة
// بالبروفايل، هاي بتوصل بنفس initialLocale لأنه login flow بيزامنها بالكوكي).
// ============================================================================
export function LocaleProvider({ initialLocale, initialGender = null, children }) {
  /* صيغة المخاطبة بتجي جاهزة من الخادم (كوكي) — ما بتتغيّر بالجلسة إلا لما
     يعدّلها المستخدم من الإعدادات، وهناك بينعاد تحميل الصفحة. فما إلها حالة. */
  const [locale, setLocaleState] = useState(isSupportedLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE);

  // مزامنة أول تحميل مع localStorage (تغطي حالة كوكي غير موجود بعد، مثلاً أول
  // زيارة من متصفح جديد سبق واختار فيه المستخدم لغة بجهاز/جلسة تانية بنفس المتصفح)
  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isSupportedLocale(stored)) {
      if (stored !== locale) {
        setLocaleState(stored);
        applyDocumentLocale(stored);
      } else {
        applyDocumentLocale(locale);
      }
      return;
    }

    // ما في تفضيل محلي بعد بهاد المتصفح — جهاز/متصفح جديد. منجرّب نجيب اللغة
    // المحفوظة بحساب المستخدم (لو مسجّل دخول) حتى تنتقل معه لأي جهاز.
    applyDocumentLocale(locale);
    fetch("/api/user/locale")
      .then((r) => r.json())
      .then((data) => {
        if (data.locale && isSupportedLocale(data.locale) && data.locale !== locale) {
          setLocaleState(data.locale);
          applyDocumentLocale(data.locale);
          window.localStorage.setItem(LOCALE_STORAGE_KEY, data.locale);
        }
      })
      .catch(() => {
        /* غير مسجل دخول أو فشل الطلب — بنبقى على اللغة الافتراضية/الكوكي */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next) => {
    if (!isSupportedLocale(next)) return;
    setLocaleState(next);
    applyDocumentLocale(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      /* localStorage/cookies معطّلة بالمتصفح — بنكمل بدون تخزين محلي */
    }
    // حفظ باتجاه حساب المستخدم (لو مسجّل دخول) — حتى تنتقل اللغة معه لأي جهاز
    fetch("/api/user/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    }).catch(() => {
      /* المستخدم مش مسجل دخول أو فشل الحفظ بالسيرفر — التخزين المحلي كافي مؤقتاً */
    });
  }, []);

  const value = useMemo(
    () => ({
      locale,
      dir: dirFor(locale),
      meta: LOCALE_META[locale],
      t: createTranslator(locale, initialGender),
      gender: initialGender,
      raw: (key) => lookupRaw(locale, key),
      setLocale,
    }),
    [locale, setLocale, initialGender]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale لازم يُستخدم جوا LocaleProvider");
  return ctx;
}
