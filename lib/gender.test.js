import { test } from "node:test";
import assert from "node:assert/strict";
import { GENDERS, isValidGender, byGender, pickForm } from "./gender.js";
import { createTranslator } from "./i18n/index.js";

/* ═══════════════════════════════════════════════════════════════════════════
   صيغة المخاطبة — الاختبارات بتحرس **الغياب** أكتر من الحضور
   ---------------------------------------------------------------------------
   أخطر حالة مش «مؤنّث بيطلع مذكّر» — هي **حساب قديم بلا قيمة**. أكتر من ٢٦٠
   حساب قائم بهالحالة، وأي مسار بيعاملها كعطل بيكسرهن كلهن دفعة وحدة.
   ═══════════════════════════════════════════════════════════════════════════ */

test("القيم المقبولة اتنتان وبس — نفس قيد CHECK بالترحيل", () => {
  assert.deepEqual(GENDERS, ["male", "female"]);
});

test("isValidGender بترفض الغياب — الفرض عند التسجيل بيعتمد عليها", () => {
  assert.equal(isValidGender("male"), true);
  assert.equal(isValidGender("female"), true);
  for (const bad of [null, undefined, "", "other", "MALE", "ذكر", 0, {}]) {
    assert.equal(isValidGender(bad), false, `لازم ترفض: ${String(bad)}`);
  }
});

test("⚠️ الغياب بيقع على المذكّر — الحسابات القديمة ما بتشوف تغيير", () => {
  assert.equal(byGender(null, "أهلاً بك", "أهلاً بكِ"), "أهلاً بك");
  assert.equal(byGender(undefined, "أهلاً بك", "أهلاً بكِ"), "أهلاً بك");
  /* قيمة فاسدة بقاعدة البيانات ما بتفضّي الواجهة — بترجع نصاً سليماً. */
  assert.equal(byGender("nonsense", "أهلاً بك", "أهلاً بكِ"), "أهلاً بك");
});

test("byGender بترجّع المؤنّث للمؤنّث وبس", () => {
  assert.equal(byGender("female", "أهلاً بك", "أهلاً بكِ"), "أهلاً بكِ");
  assert.equal(byGender("male", "أهلاً بك", "أهلاً بكِ"), "أهلاً بك");
});

test("⚠️ نص بلا فاصل بيرجع كما هو — فالتعريب بيصير على دفعات بلا كسر", () => {
  assert.equal(pickForm("نص ما إله صيغة تانية", "female"), "نص ما إله صيغة تانية");
  assert.equal(pickForm("نص ما إله صيغة تانية", null), "نص ما إله صيغة تانية");
});

test("pickForm بتقصّ على أول فاصل وبس", () => {
  assert.equal(pickForm("مرحباً بك|مرحباً بكِ", "female"), "مرحباً بكِ");
  assert.equal(pickForm("مرحباً بك|مرحباً بكِ", "male"), "مرحباً بك");
  /* فاصل تاني بيضل جزءاً من صيغة المؤنّث — ما بيكسر ولا بيبلع نصاً. */
  assert.equal(pickForm("أ|ب|ج", "female"), "ب|ج");
});

test("pickForm بتتحمّل اللي مش نص", () => {
  for (const v of [null, undefined, 42, {}]) {
    assert.equal(pickForm(v, "female"), v);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   التكامل مع المترجم — هون بتظهر أخطر حالة
   ═══════════════════════════════════════════════════════════════════════════ */

test("المترجم بيطبّق الصيغة على مفتاح فيه فاصل", () => {
  assert.equal(createTranslator("ar", "female")("dashboard.greeting", { name: "سارة" }), "مرحباً بكِ سارة");
  assert.equal(createTranslator("ar", "male")("dashboard.greeting", { name: "قيس" }), "مرحباً بك قيس");
});

test("⚠️ بلا صيغة = سلوك اليوم بالضبط", () => {
  assert.equal(createTranslator("ar")("dashboard.greeting", { name: "قيس" }), "مرحباً بك قيس");
});

test("🔴 حارس: اسم فيه `|` ما بيقصّ النص — الفاصل ملك القاموس مش المستخدم", () => {
  /* لو انطبّقت الصيغة **بعد** استبدال المتغيّرات، اسم زي «أبو|سيف» كان
     بيتحوّل لفاصل صيغة، فنص المستخدم بيتحكّم بمنطق العرض. */
  const t = createTranslator("ar", "female");
  assert.equal(t("dashboard.greeting", { name: "أبو|سيف" }), "مرحباً بكِ أبو|سيف");
});

test("الإنجليزي ما بيتأثر — ما فيه فواصل صيغة", () => {
  const en = createTranslator("en", "female");
  assert.equal(en("dashboard.greeting", { name: "Sara" }), "Welcome back, Sara");
});

/* ═══════════════════════════════════════════════════════════════════════════
   🔴 حارسان على القاموسين — الصنف اللي ما بيمسكه أي اختبار وحدة
   ═══════════════════════════════════════════════════════════════════════════ */

test("🔴 حارس: ولا نص إنجليزي فيه `|` — الفاصل بيقصّه لنص ناقص", async () => {
  /* الإنجليزية ما إلها صيغتان، فأي `|` هناك **مش فاصل صيغة** — هو نص فعلي
     (اختصار، أو خيارات) وبينقصّ بصمت لما تكون الصيغة مؤنّث. */
  const { default: en } = await import("./i18n/dictionaries/en.js");
  const flat = (o, p = "") =>
    Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === "object" ? flat(v, p + k + ".") : [[p + k, String(v)]]
    );
  const offenders = flat(en).filter(([, v]) => v.includes("|")).map(([k]) => k);
  assert.deepEqual(offenders, [], `مفاتيح إنجليزية فيها فاصل: ${offenders.join(", ")}`);
});

test("🔴 حارس: ولا صيغة عربية فاضية على طرفَي الفاصل", async () => {
  /* `"نص|"` بيعطي المؤنّث **سلسلة فاضية** — يعني الواجهة بتفضى عند نص
     المؤنّث وبس، وهاي حالة ما بتظهر إلا لمستخدمة. */
  const { default: ar } = await import("./i18n/dictionaries/ar.js");
  const flat = (o, p = "") =>
    Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === "object" ? flat(v, p + k + ".") : [[p + k, String(v)]]
    );
  const bad = flat(ar)
    .filter(([, v]) => v.includes("|"))
    .filter(([, v]) => {
      const i = v.indexOf("|");
      return v.slice(0, i).trim() === "" || v.slice(i + 1).trim() === "";
    })
    .map(([k]) => k);
  assert.deepEqual(bad, [], `صيغة فاضية بـ: ${bad.join(", ")}`);
});
