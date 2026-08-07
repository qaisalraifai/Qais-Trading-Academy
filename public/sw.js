// Service Worker لـ Qais Trading Academy
// الاستراتيجية: network-first لكل شي (صفحات، API) — عشان بيانات
// الأسعار/الاشتراك/الصفقات تضل حديثة دايماً وما تنكاش نسخة قديمة بالغلط.
// بس الملفات الثابتة (أيقونات، صور، خطوط) بتتخزن (cache-first) لتحميل أسرع.

const CACHE_VERSION = "qta-v2";
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
    // network-first لكل باقي الصفحات — لو النت مقطوع، نرجع آخر نسخة محفوظة
    // إذا موجودة، وإلا منسيب الطلب يفشل بشكل طبيعي (respondWith لازم ياخد
    // Response دايماً — رجوع undefined هون كان يسبب "Failed to convert
    // value to 'Response'" ويكسر الصفحة بشكل إضافي فوق أي خطأ أصلي).
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return fetch(event.request);
      })
    );
  }
});
