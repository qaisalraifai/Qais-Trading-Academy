// Service Worker لـ Qais Trading Academy
// الاستراتيجية: network-first لكل شي (صفحات، API) — عشان بيانات
// الأسعار/الاشتراك/الصفقات تضل حديثة دايماً وما تنكاش نسخة قديمة بالغلط.
// بس الملفات الثابتة (أيقونات، صور، خطوط) بتتخزن (cache-first) لتحميل أسرع.

const CACHE_VERSION = "qta-v3"; // v3: آخر محاولة بترجّع Response بدل ما ترمي
const STATIC_CACHE = `qta-static-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/logo.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("qta-") && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/logo.jpg" ||
    url.pathname.startsWith("/_next/static/")
  );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // ما نتدخل إطلاقاً بطلبات API أو أي شي مش GET — لازم تضل مباشرة
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  if (isStaticAsset(url)) {
    // cache-first للملفات الثابتة
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
  } else {
    /* network-first لكل باقي الصفحات — لو النت مقطوع، نرجع آخر نسخة محفوظة
       إذا موجودة، وإلا منسيب الطلب يفشل بشكل طبيعي (respondWith لازم ياخد
       Response دايماً — رجوع undefined هون كان يسبب "Failed to convert
       value to 'Response'" ويكسر الصفحة بشكل إضافي فوق أي خطأ أصلي).

       🔴 **وآخر محاولة كانت `return fetch(...)` — وهي بترمي هي كمان.**
       ---------------------------------------------------------------------
       لما تفشل الشبكة وما يكون في نسخة محفوظة، كانت تعيد نفس الطلب الفاشل
       فيرجع الوعد **مرفوضاً** — فبيطلع بالكونسول:
           The FetchEvent for "…/replay" resulted in a network error response
           Uncaught (in promise) TypeError: Failed to fetch  at sw.js:73
       ومتصفّح المستخدم بيعرض صفحة مكسورة بدل خطأ نظيف. مقيس على الإنتاج
       أثناء نافذة نشر.

       الصح: `respondWith` **لازم** ياخد `Response` بكل المسارات. فبنبني
       واحدة نظيفة (503) بدل ما نرمي — المتصفّح بيعرض خطأ الشبكة العادي،
       والصفحة ما بتنكسر فوقه. */
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        try {
          return await fetch(event.request);
        } catch (err) {
          return new Response(
            "تعذّر الوصول للخادم. تأكد من الاتصال وأعد المحاولة.",
            {
              status: 503,
              statusText: "Service Unavailable",
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            }
          );
        }
      })
    );
  }
});
