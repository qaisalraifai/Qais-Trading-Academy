/* ============================================================================
   lib/http-json.js — قراءة رد JSON بحيث الفشل بيحكي سببه.

   ---------------------------------------------------------------------------
   ⚠️ المشكلة اللي بتحلّها:

   `await res.json()` بترمي `Unexpected token '<', "<!DOCTYPE "...` لما الرد
   يكون HTML. وهاي الرسالة بتوصل للمستخدم كما هي — وهي **ما بتقول ولا إشي**:
   لا رقم الحالة، ولا أي مسار، ولا مين ردّ.

   وهاد بالضبط اللي صار بصفحة الدفع بالـUSDT: المستخدم شاف رسالة مُحلِّل JSON،
   وإحنا ما قدرنا نعرف إذا كان ٤٠٤ ولا ٥٠٠ ولا ٥٠٤ — مع إنّ الفرق بينهن هو
   **كل** التشخيص.

   ليش بيصير رد HTML أصلاً رغم إنّ الهاندلر بيرجّع JSON بكل فرع: لأنّ الرد
   ممكن ما يكون من الهاندلر. صفحة خطأ المنصّة (انهيار قبل الهاندلر، مهلة
   تنفيذ، مسار مش موجود بالنسخة المنشورة) كلها HTML.

   ---------------------------------------------------------------------------
   السلوك:
   · رد JSON سليم  → بيرجّع الكائن، سواء `ok` أو لأ (الاستدعاء بيقرر).
   · رد مش JSON    → بيرمي خطأ فيه **رقم الحالة** ومقتطف من النص.

   ما بيرمي على `!res.ok` — كتير مسارات بترجّع `{ error }` مع ٤٠٠/٤٠١، وهاي
   رسائل مكتوبة للمستخدم ولازم توصله كما هي.
   ============================================================================ */

/** أول سطر ذي معنى من نص HTML/نص خام — للتشخيص مش للعرض الطويل. */
function snippet(text) {
  const stripped = text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 120);
}

/**
 * بيقرا الرد كـJSON، وبيرمي خطأ مفهوم لو ما كان JSON.
 * @param {Response} res
 * @returns {Promise<any>} جسم الرد بعد التحليل
 */
export async function readJson(res) {
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    const detail = snippet(text);
    const err = new Error(
      detail
        ? `الخادم ردّ بصفحة مش JSON (رمز ${res.status}): ${detail}`
        : `الخادم ردّ بصفحة مش JSON (رمز ${res.status})`
    );
    err.status = res.status;
    err.rawBody = text.slice(0, 2000);
    throw err;
  }
}

/**
 * `fetch` بجسم JSON + قراءة آمنة للرد. بيرجّع `{ res, data }`.
 * الاستدعاء بيفحص `res.ok` بنفسه ويقرر رسالته.
 */
export async function postJson(url, body, init = {}) {
  const res = await fetch(url, {
    method: "POST",
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  return { res, data };
}
