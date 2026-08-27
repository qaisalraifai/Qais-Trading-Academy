import { test } from "node:test";
import assert from "node:assert/strict";
import { safeProvider, withTimeout } from "./provider-guard.js";

/* ══════════════ 🔴 العطل المقيس على الإنتاج ══════════════ */

test("🔴 رمية المزوّد ما بتسقّط الطلب — بترجع كفشل مزوّد", async () => {
  /* `Promise.race` بتمرّر الرفض، ومسار الشموع كان بلا try/catch — فرمية من
     Dukascopy كانت تطلّع **500 عارية** وتتخطّى سلسلة التراجع كلها.
     مقيس على الإنتاج ٢٠٢٦-٠٨-٢٧: 5× 500 على duk=xauusd و duk=usatechidxusd. */
  const out = await withTimeout(Promise.reject(new Error("انفجار بالأرشيف")), 50, { error: "مهلة" });
  assert.ok(out && typeof out === "object", "لازم يرجّع غرض مش يرمي");
  assert.match(out.error, /انفجار بالأرشيف/, "سبب الرمية لازم يوصل للمخرج");
  assert.doesNotMatch(out.error, /مهلة/, "مش نتيجة المهلة — رمية");
});

test("الرمية المتزامنة جوّا دالة async كمان بتنمسك", async () => {
  const boom = (async () => {
    throw new TypeError("undefined مش دالة");
  })();
  const out = await withTimeout(boom, 50, { error: "مهلة" });
  assert.match(out.error, /undefined مش دالة/);
});

test("المرمي مش Error — بيضل مقروء", async () => {
  assert.match((await safeProvider(Promise.reject("نص خام"))).error, /نص خام/);
  assert.match((await safeProvider(Promise.reject({ status: 429 }))).error, /429/);
  assert.match((await safeProvider(Promise.reject(undefined))).error, /رمية من المزوّد/);
});

/* ══════════════ السلوك القائم ما بيتغيّر ══════════════ */

test("النجاح بيمرق كما هو", async () => {
  const payload = { candles: [1, 2, 3] };
  assert.equal(await withTimeout(Promise.resolve(payload), 50, { error: "مهلة" }), payload);
});

test("المهلة بترجّع قيمة المهلة", async () => {
  const never = new Promise(() => {});
  const out = await withTimeout(never, 20, { error: "انتهت المهلة" });
  assert.equal(out.error, "انتهت المهلة");
});

test("الأسرع بيغلب — رد قبل المهلة", async () => {
  const quick = new Promise((r) => setTimeout(() => r({ candles: [1] }), 5));
  const out = await withTimeout(quick, 200, { error: "مهلة" });
  assert.deepEqual(out.candles, [1]);
});

test("المؤقّت بينضف حتى لما يرمي المزوّد", async () => {
  /* لو ضل المؤقّت شغّال، الدالة بتضل حيّة على Vercel لحد المهلة كاملة. */
  const before = process._getActiveHandles?.().length ?? 0;
  await withTimeout(Promise.reject(new Error("x")), 30000, { error: "مهلة" });
  await new Promise((r) => setTimeout(r, 10));
  const after = process._getActiveHandles?.().length ?? 0;
  assert.ok(after <= before + 1, `مؤقّت معلّق: ${before} → ${after}`);
});
