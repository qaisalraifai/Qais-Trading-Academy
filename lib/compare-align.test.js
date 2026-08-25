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
