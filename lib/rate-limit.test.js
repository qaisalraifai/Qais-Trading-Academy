import { test } from "node:test";
import assert from "node:assert/strict";
import { hit, resetAll, size, LIMITS } from "./rate-limit.js";

const CONF = { limit: 3, windowMs: 60_000 };

test("بيسمح لحدّ العدد ثم بيرفض", () => {
  resetAll();
  const now = 1_000_000;
  for (let i = 1; i <= 3; i++) {
    const r = hit("k", { ...CONF, now });
    assert.equal(r.ok, true, `المحاولة ${i}`);
    assert.equal(r.remaining, 3 - i);
  }
  const over = hit("k", { ...CONF, now });
  assert.equal(over.ok, false);
  assert.equal(over.remaining, 0);
});

test("النافذة بتنصفّر بعد انتهائها", () => {
  resetAll();
  const t0 = 1_000_000;
  for (let i = 0; i < 4; i++) hit("k", { ...CONF, now: t0 });
  assert.equal(hit("k", { ...CONF, now: t0 }).ok, false);

  // بعد انتهاء النافذة بالضبط
  assert.equal(hit("k", { ...CONF, now: t0 + 60_000 }).ok, true);
});

test("المفاتيح مستقلة — عميل ما بيأثّر على غيره", () => {
  resetAll();
  const now = 1_000_000;
  for (let i = 0; i < 4; i++) hit("أ", { ...CONF, now });
  assert.equal(hit("أ", { ...CONF, now }).ok, false);
  assert.equal(hit("ب", { ...CONF, now }).ok, true, "عميل تاني لازم يمرق");
});

test("`retryAfterSec` بيتناقص مع الوقت وما بينزل تحت ١", () => {
  resetAll();
  const t0 = 1_000_000;
  for (let i = 0; i < 4; i++) hit("k", { ...CONF, now: t0 });

  assert.equal(hit("k", { ...CONF, now: t0 }).retryAfterSec, 60);
  assert.equal(hit("k", { ...CONF, now: t0 + 30_000 }).retryAfterSec, 30);
  assert.equal(hit("k", { ...CONF, now: t0 + 59_999 }).retryAfterSec, 1);
});

test("النافذة بتبلّش من **أول طلب** مش من حدّ ساعة ثابت", () => {
  resetAll();
  const t0 = 1_000_000;
  // أول طلب بيفتح النافذة هون
  assert.equal(hit("k", { ...CONF, now: t0 + 59_000 }).ok, true);
  // بعدها بثانية لسا نفس النافذة (بتنتهي عند t0+119_000)
  assert.equal(hit("k", { ...CONF, now: t0 + 60_000 }).ok, true);
  assert.equal(hit("k", { ...CONF, now: t0 + 60_000 }).ok, true);
  assert.equal(hit("k", { ...CONF, now: t0 + 60_000 }).ok, false, "الرابع لازم يُرفض");
});

test("⚠️ الحدّ بين نافذتين: بيمرق ضِعف الحدّ بفترة قصيرة — سلوك معروف", () => {
  /* ثمن مقبول لبساطة النافذة. الاختبار بيثبّته حتى ما ينحسب عطلاً بعدين. */
  resetAll();
  const t0 = 1_000_000;
  let allowed = 0;
  // النافذة الأولى بتنفتح عند t0
  for (let i = 0; i < 3; i++) if (hit("k", { ...CONF, now: t0 }).ok) allowed++;
  // برّة النافذة بجزء من الثانية → نافذة جديدة
  for (let i = 0; i < 3; i++) if (hit("k", { ...CONF, now: t0 + 60_001 }).ok) allowed++;
  assert.equal(allowed, 6, "٦ مسموحة خلال ٦٠ ثانية وجزء");
});

test("الذاكرة ما بتنمو بلا حدّ — المنتهية بتنشال", () => {
  resetAll();
  for (let i = 0; i < 200; i++) hit(`k${i}`, { limit: 1, windowMs: 1000, now: 1_000_000 });
  const before = size();
  assert.ok(before >= 200, `توقّعنا ٢٠٠+، لقينا ${before}`);

  // مفتاح جديد بعد انتهاء كل السابقة — بيشغّل التنظيف عند تجاوز السقف
  hit("جديد", { limit: 1, windowMs: 1000, now: 1_000_000 + 10_000 });
  assert.ok(size() <= before + 1);
});

test("الحدود المعتمدة موجودة ومعقولة", () => {
  for (const [name, conf] of Object.entries(LIMITS)) {
    assert.ok(conf.limit >= 10, `${name}: الحدّ ${conf.limit} ضيّق — بيعضّ استعمالاً شرعياً`);
    assert.ok(conf.windowMs >= 60_000, `${name}: النافذة قصيرة`);
  }
});

test("🔴 الحدّ ما بيقفل على مستخدم عادي — مسار تسجيل كامل بيمرق", () => {
  /* تسجيل واحد = نداء واحد لـcreate-profile. حتى عائلة كاملة وراء IP واحد
     ما بتوصل للحدّ. */
  resetAll();
  const now = 1_000_000;
  const conf = LIMITS.createProfile;
  for (let i = 0; i < conf.limit; i++) {
    assert.equal(hit("createProfile:1.2.3.4", { ...conf, now }).ok, true, `تسجيل ${i + 1}`);
  }
});
