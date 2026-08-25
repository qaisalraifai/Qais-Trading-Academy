import { test } from "node:test";
import assert from "node:assert/strict";
import { alignToMainAxis } from "./compare-align.js";

const bar = (time, close) => ({ time, open: close, high: close, low: close, close });
const toPoint = (c) => ({ time: c.time, value: c.close });

test("الطول = طول السلسلة الأساسية، مهما كان طول المقارنة", () => {
  const main = [bar(1, 10), bar(2, 11), bar(3, 12), bar(4, 13)];
  const cmp = [bar(3, 99)];
  assert.equal(alignToMainAxis(cmp, main, toPoint).length, 4);
});

test("🔴 الفهرس N = نفس اللحظة باللوحتين — جوهر الإصلاح", () => {
  /* الحالة المقيسة: المقارنة **أقصر** وبتبلّش متأخر. قبل الإصلاح كانت
     تنرسم من الفهرس صفر فتنزاح، وبتترك فراغاً على اليمين. */
  const main = [bar(1, 10), bar(2, 11), bar(3, 12), bar(4, 13), bar(5, 14)];
  const cmp = [bar(4, 40), bar(5, 50)]; // بتبلّش من اللحظة ٤

  const out = alignToMainAxis(cmp, main, toPoint);
  out.forEach((p, i) => assert.equal(p.time, main[i].time, `الفهرس ${i}`));
  assert.deepEqual(out[3], { time: 4, value: 40 });
  assert.deepEqual(out[4], { time: 5, value: 50 });
});

test("اللحظات الناقصة بتصير whitespace — بتحجز الموضع بلا ما ترسم", () => {
  const main = [bar(1, 10), bar(2, 11), bar(3, 12)];
  const cmp = [bar(2, 20)];
  const out = alignToMainAxis(cmp, main, toPoint);

  assert.deepEqual(out[0], { time: 1 });
  assert.deepEqual(out[1], { time: 2, value: 20 });
  assert.deepEqual(out[2], { time: 3 });
  for (const p of out) assert.ok("time" in p, "كل نقطة لازم يكون فيها time");
});

test("🔴 المقارنة **أطول** — الزيادة بتنقصّ مش بتزحزح", () => {
  /* SPX مع `duk` بيعطي ٩١١٣ شمعة مقابل ٤٥٥١ للأساسي. الزيادة برّا محور
     الأساسي وما إلها مكان تنرسم فيه. */
  const main = [bar(5, 50), bar(6, 60)];
  const cmp = [bar(1, 1), bar(2, 2), bar(3, 3), bar(4, 4), bar(5, 55), bar(6, 66)];

  const out = alignToMainAxis(cmp, main, toPoint);
  assert.equal(out.length, 2);
  assert.deepEqual(out, [{ time: 5, value: 55 }, { time: 6, value: 66 }]);
});

test("ما في تقاطع لحظات إطلاقاً → كلها فراغ، بلا انهيار", () => {
  const main = [bar(1, 10), bar(2, 11)];
  const cmp = [bar(90, 1), bar(91, 2)];
  const out = alignToMainAxis(cmp, main, toPoint);
  assert.deepEqual(out, [{ time: 1 }, { time: 2 }]);
});

test("⚠️ بلا سلسلة أساسية بترجع المقارنة كما هي — تراجع آمن", () => {
  /* بيصير قبل ما يوصل الشارت الأساسي بياناته. الرسم بيضل شغّالاً، والمحاذاة
     بتنضبط أول ما توصل شموع الأساسي. */
  const cmp = [bar(1, 10), bar(2, 11)];
  assert.deepEqual(alignToMainAxis(cmp, [], toPoint), [{ time: 1, value: 10 }, { time: 2, value: 11 }]);
  assert.deepEqual(alignToMainAxis(cmp, null, toPoint), [{ time: 1, value: 10 }, { time: 2, value: 11 }]);
});

test("مقارنة فاضية + أساسي موجود → كلها فراغ بطول الأساسي", () => {
  const main = [bar(1, 10), bar(2, 11), bar(3, 12)];
  assert.deepEqual(alignToMainAxis([], main, toPoint), [{ time: 1 }, { time: 2 }, { time: 3 }]);
  assert.deepEqual(alignToMainAxis(null, main, toPoint), [{ time: 1 }, { time: 2 }, { time: 3 }]);
});

test("شكل الشموع الكاملة بينحافظ عليه", () => {
  const main = [bar(1, 10)];
  const cmp = [{ time: 1, open: 1, high: 4, low: 0.5, close: 3 }];
  const toCandle = (c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close });
  assert.deepEqual(alignToMainAxis(cmp, main, toCandle), [{ time: 1, open: 1, high: 4, low: 0.5, close: 3 }]);
});

test("الأداء: ٥٠٠٠ × ١٠٠٠٠ بتخلص بسرعة (خريطة مش بحث خطّي)", () => {
  const main = Array.from({ length: 5000 }, (_, i) => bar(i * 60, i));
  const cmp = Array.from({ length: 10000 }, (_, i) => bar(i * 60, i * 2));
  const t0 = performance.now();
  const out = alignToMainAxis(cmp, main, toPoint);
  const ms = performance.now() - t0;
  assert.equal(out.length, 5000);
  assert.ok(ms < 200, `أخذت ${ms.toFixed(0)}ms — يبدو إنها صارت O(n²)`);
});

/* ══════════════ الارتداد اللي بلّغ عنه: الفريم اليومي ══════════════ */

test("🔴 اليومي بساعة فتح مختلفة — كان بيطلّع شمعة وحدة", () => {
  /* الأساسي من Dukascopy (يفتح ٠٠:٠٠) والمقارنة من يوهو (تفتح ١٦:٠٠).
     التساوي التام ما بيطابق ولا وحدة؛ المطابقة بالقرب بتطابقهن كلهن. */
  const DAY = 86400;
  const main = Array.from({ length: 5 }, (_, i) => bar(i * DAY, 100 + i));
  const cmp = Array.from({ length: 5 }, (_, i) => bar(i * DAY + 16 * 3600, 50 + i));

  const out = alignToMainAxis(cmp, main, toPoint);
  assert.equal(out.length, 5);
  const drawn = out.filter((p) => "value" in p);
  assert.equal(drawn.length, 5, `انطابق ${drawn.length} من ٥ — التسامح مش شغّال`);
  assert.deepEqual(out.map((p) => p.value), [50, 51, 52, 53, 54]);
});

test("أي طور جلسة بينطابق — حتى ٢٠ ساعة", () => {
  /* ⚠️ هالاختبار كان مكتوباً على منطق «تسامح نصف شمعة» اللي انستبدل.
     بمطابقة رقم الشمعة، إزاحة ٢٠ ساعة هي **طور جلسة** — ولازم تطابق، لأن
     يوم د بالسلسلتين هو نفس اليوم مهما كانت ساعة الفتح. */
  const DAY = 86400;
  const main = Array.from({ length: 4 }, (_, i) => bar(i * DAY, 100 + i));
  const cmp = Array.from({ length: 4 }, (_, i) => bar(i * DAY + 20 * 3600, 50 + i));
  const out = alignToMainAxis(cmp, main, toPoint);
  assert.deepEqual(out.map((p) => p.value), [50, 51, 52, 53]);
});

test("🔴 أيام ناقصة بالمقارنة (عطلة مختلفة) → فراغ بمكانها بالضبط", () => {
  /* اللي **لازم** يُرفض: يوم ما إله نظير — مش يوم موجود بساعة مختلفة. */
  const DAY = 86400;
  const main = Array.from({ length: 5 }, (_, i) => bar(i * DAY, 100 + i));
  const cmp = [0, 1, 3, 4].map((i) => bar(i * DAY + 8 * 3600, 50 + i)); // اليوم ٢ ناقص

  const out = alignToMainAxis(cmp, main, toPoint);
  assert.equal(out.length, 5);
  assert.deepEqual(out[2], { time: 2 * DAY }, "اليوم الناقص لازم يصير فراغ");
  assert.deepEqual(out.map((p) => p.value), [50, 51, undefined, 53, 54]);
});

test("⚠️ كل شمعة مقارنة بتنستعمل مرة وحدة — بلا سحب نفس القيمة", () => {
  /* لو المقارنة أندر (مثلاً يومي مقابل ٤ ساعات)، ممنوع نفس الشمعة تتكرّر
     على عدة أعمدة — بتعطي خطاً مسطّحاً كاذباً. */
  const H4 = 4 * 3600;
  const main = Array.from({ length: 6 }, (_, i) => bar(i * H4, i));
  const cmp = [bar(0, 900)];
  const out = alignToMainAxis(cmp, main, toPoint);
  const drawn = out.filter((p) => "value" in p);
  assert.equal(drawn.length, 1, "انسحبت أكتر من مرة");
});

test("ترتيب الوقت بيضل تصاعدياً — شرط lightweight-charts", () => {
  const DAY = 86400;
  const main = Array.from({ length: 20 }, (_, i) => bar(i * DAY, i));
  const cmp = Array.from({ length: 20 }, (_, i) => bar(i * DAY + 3600, i * 2));
  const out = alignToMainAxis(cmp, main, toPoint);
  for (let i = 1; i < out.length; i++) {
    assert.ok(out[i].time > out[i - 1].time, `تراجع بالفهرس ${i}`);
  }
});
