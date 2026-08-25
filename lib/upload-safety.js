/* ============================================================================
   lib/upload-safety.js — نوع الملف المرفوع. وحدة **نقيّة** بلا أي تبعية.

   ---------------------------------------------------------------------------
   ⚠️ المشكلة: مسارات الرفع الأربعة كلها كانت بتخزّن `contentType: file.type` —
   و`file.type` **قيمة بيبعتها العميل**، مش شي متحقَّق منه.

   الخطر: ملف بيتخزّن كـ`text/html` أو `image/svg+xml` وبينفتح برابط موقَّع
   بيتنفّذ كصفحة بالمتصفّح. البكتات **خاصة** (`public: false`) والروابط موقَّعة،
   فالتنفيذ بيصير على نطاق Supabase مش على `qta-academy.store` — يعني ما بيوصل
   لكوكيز الجلسة. بس بيضل: توزيع محتوى ضار من روابط المنصّة، وSVG بسكربت.

   ---------------------------------------------------------------------------
   قاعدتان:

   ١) **`isAllowedDocument`** — للمسارات اللي واجهتها بتعلن `accept="image/*,.pdf"`
      (توثيق KYC · إثبات الدفع). الخادم كان ما بيفرض اللي الواجهة بتعلنه،
      فأي حدا بيبعت طلباً مباشرة كان بيمرق. **مش تضييق جديد** — هو فرض
      خادمي لعقد قائم بالواجهة.

   ٢) **`safeContentType`** — لكل المسارات. بيرجّع نوع العميل **بس** لو كان من
      الأنواع الآمنة للعرض، وإلا `application/octet-stream` (المتصفّح بينزّله
      بدل ما ينفّذه).

      ⚠️ SVG **مستثنى عمداً** من الآمنة رغم إنه صورة — بيقبل سكربت جوّاه.

   ⚠️ ما في تضييق على تسليم الواجبات وملفات الدفعات: واجهتهن بلا `accept`
   يعني مفتوحة بالتصميم (الطالب بيسلّم صيغ مختلفة، والأدمن بيرفع مواد). اللي
   بينطبق عليهن هو تثبيت نوع المحتوى وبس.

   ⚠️ ولا معاينة بتنكسر: كل الملفات بتنعرض بالواجهة كروابط
   `<a target="_blank">` — ما في `iframe` ولا `embed` لمحتوى مرفوع (مفحوص).
   ============================================================================ */

/** صيغ يقبلها المتصفّح للعرض بلا خطر تنفيذ. */
const RENDER_SAFE = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "application/pdf",
]);

/** اللي بتعلنه واجهات KYC وإثبات الدفع: `accept="image/*,.pdf"`. */
const ALLOWED_DOCUMENTS = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export const ALLOWED_DOCUMENT_LABEL = "صورة (JPG · PNG · GIF · WEBP · HEIC) أو ملف PDF";

/** بينظّف نوع MIME من البارامترات ويوحّد حالة الأحرف. */
function normalize(type) {
  return String(type || "").split(";")[0].trim().toLowerCase();
}

/** هل الملف من الأنواع المسموحة للتوثيق (صور + PDF)؟ */
export function isAllowedDocument(type) {
  return ALLOWED_DOCUMENTS.has(normalize(type));
}

/**
 * نوع المحتوى اللي بينخزَّن فعلياً.
 *
 * ⚠️ **ما بيثق بالعميل**: أي شي برّا الآمنة بينخزَّن `application/octet-stream`
 * فبينزّل بدل ما ينفّذ. هاي هي الحماية الفعلية — لأن حتى مع قائمة مسموحة،
 * العميل بيقدر يدّعي `image/png` لملف HTML.
 */
export function safeContentType(type) {
  const t = normalize(type);
  return RENDER_SAFE.has(t) ? t : "application/octet-stream";
}

/** الامتداد المشتق من النوع المتحقَّق — مش من اسم الملف اللي بيبعته العميل. */
const EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

/**
 * امتداد آمن للمسار المخزَّن.
 * ⚠️ اسم الملف من العميل ما بينستعمل لاشتقاق الامتداد — كان `file.name.split(".").pop()`
 * وهاد بيسمح باسم زي `x.html` يتخزّن بامتداد `.html`.
 */
export function safeExtension(type, fallback = "bin") {
  return EXT_BY_TYPE[normalize(type)] || fallback;
}
