"use client";

/* ===================== مزامنة إعدادات الطالب مع حسابه ===================== *
 * أي إعداد يخصصه الطالب (ألوان الريبلاي، القوالب، الأدوات المفضلة، إلخ) بيتخزن
 * محلياً بالـ localStorage زي ما كان دايماً (سريع، بدون انتظار شبكة)، وبنفس
 * الوقت بينحفظ نسخة بحساب الطالب بالسيرفر (عن طريق /api/user/settings) عشان
 * ما تضيع لو غيّر جهاز أو مسح الكاش.
 *
 * الفكرة: بدل ما نعدّل مئات الأسطر يلي بتنادي localStorage.getItem/setItem
 * بكل الملف، منعمل "patch" خفيف لدوال localStorage نفسها (مرة وحدة، بأول
 * صفحة بتستدعي initUserSettingsSync)، بحيث أي setItem/removeItem لمفتاح
 * مطابق (هون: أي مفتاح يبدأ بـ"qta_") بينضاف تلقائياً لطابور إرسال مؤجّل
 * (debounced) للسيرفر - بدون ما نلمس منطق الحفظ الأصلي إطلاقاً.
 *
 * وبالاتجاه المعاكس: أول ما تفتح الصفحة، منجيب النسخة المحفوظة بالحساب،
 * ولو فيها قيمة مختلفة عن الموجودة محلياً (يعني هيك جهاز جديد أو كاش
 * انمسح)، منكتبها بالـ localStorage ومنعمل reload مرة وحدة عشان كل
 * useState يلي بيقرأ الإعداد وقت التحميل الأول ياخد القيمة الصحيحة. */

const PREFIX = "qta_";
let patched = false;
let pending = {};
let flushTimer = null;
let reloadedThisSession = false;

function isSyncableKey(key) {
  return typeof key === "string" && key.startsWith(PREFIX);
}

function queuePush(key, value) {
  pending[key] = value;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 800);
}

async function flush() {
  const payload = pending;
  pending = {};
  flushTimer = null;
  if (!Object.keys(payload).length) return;
  try {
    await fetch("/api/user/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: payload }),
    });
  } catch {
    // فشل الحفظ بالسيرفر (مثلاً بدون إنترنت) - بيضل محفوظ محلياً بالـ
    // localStorage عادي، وبيتحاول يرسل تاني بأقرب تعديل جاي
  }
}

function patchLocalStorage() {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const origSetItem = window.localStorage.setItem.bind(window.localStorage);
  const origRemoveItem = window.localStorage.removeItem.bind(window.localStorage);

  window.localStorage.setItem = function (key, value) {
    origSetItem(key, value);
    if (isSyncableKey(key)) queuePush(key, value);
  };
  window.localStorage.removeItem = function (key) {
    origRemoveItem(key);
    if (isSyncableKey(key)) queuePush(key, null);
  };

  // آخر محاولة إرسال قبل ما يسكّر التاب (لو في تعديل ما زال بالطابور)
  window.addEventListener("beforeunload", () => {
    if (Object.keys(pending).length) {
      try {
        navigator.sendBeacon(
          "/api/user/settings",
          new Blob([JSON.stringify({ data: pending })], { type: "application/json" })
        );
      } catch {}
    }
  });
}

async function pullFromServer() {
  try {
    const res = await fetch("/api/user/settings");
    if (!res.ok) return;
    const { data } = await res.json();
    if (!data) return; // زائر أو ما عنده إعدادات محفوظة بعد

    let changed = false;
    for (const [key, value] of Object.entries(data)) {
      if (!isSyncableKey(key)) continue;
      const local = window.localStorage.getItem(key);
      if (local !== value) {
        // بنكتب مباشرة (قبل الـ patch) عشان ما نطلق إرسال فوري للسيرفر لنفس
        // القيمة يلي جبناها منه أصلاً
        window.localStorage.setItem(key, value);
        changed = true;
      }
    }

    if (changed && !reloadedThisSession) {
      reloadedThisSession = true;
      // إعادة تحميل مرة وحدة بس، عشان كل الإعدادات (chartSettings، القوالب،
      // إلخ) يلي بتنقرا مرة وحدة عند فتح الصفحة (useState lazy init) تاخد
      // القيم الصحيحة الجاية من الحساب
      window.location.reload();
    }
  } catch {
    // ما قدرنا نجيب من السيرفر (مثلاً بدون إنترنت) - بيضل شغال بالنسخة
    // المحلية عادي بدون أي إزعاج للمستخدم
  }
}

/* بتنادى مرة وحدة بأعلى أي صفحة فيها إعدادات قابلة للتخصيص (الريبلاي،
   الباك تست...). آمنة تماماً تتنادى أكتر من مرة (أو من أكتر من صفحة). */
export function initUserSettingsSync() {
  if (typeof window === "undefined") return;
  patchLocalStorage();
  pullFromServer();
}
