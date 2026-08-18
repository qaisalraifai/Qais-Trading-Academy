/* اختبارات محرك قواعد QAIS SK.

   ⚠️ الاختبارين الأهم هون هما اللي بيثبّتوا **الكتلتين المتحقَّقتين يدوياً**:
   كتلة طلب من ٤ شموع حمرا (أبريل) وكتلة عرض من ٣ شموع خضرا (يونيو).
   المستويات تطابقت مع رسمه اليدوي بالخانة العشرية على عيّنتين مستقلتين.
   لو انكسر واحد منهم، المحرك ابتعد عن المرجع البشري ولازم يوقف الشغل.
*/

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeOrderBlocksSK, blocksAsOfSK, SK_DEFAULTS } from "./rules-sk.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const Q1Q2 = JSON.parse(fs.readFileSync(path.join(HERE, "verify/fixtures/nas100-h4-2026q1q2.json"), "utf8"));
const STRUCT = JSON.parse(
  fs.readFileSync(path.join(HERE, "../structure/verify/fixtures/nas100-h4-2026.json"), "utf8")
);

const rQ = analyzeOrderBlocksSK(Q1Q2.candles, { timeframe: "h4" });
const rS = analyzeOrderBlocksSK(STRUCT.candles, { timeframe: "h4" });

test("المحرك بيشتغل على العيّنتين وبيطلّع كتل", () => {
  assert.equal(rQ.ok, true, rQ.reason);
  assert.equal(rS.ok, true, rS.reason);
  assert.ok(rQ.blocks.length > 5, `عيّنة q1q2: ${rQ.blocks.length} كتلة بس`);
  assert.ok(rS.blocks.length > 2, `عيّنة الهيكل: ${rS.blocks.length} كتلة بس`);
});

test("كتلة الطلب المتحقَّقة يدوياً — ٤ شموع حمرا (٢٠٢٦-٠٤-٢٨)", () => {
  const b = rQ.blocks.find((x) => Math.abs(x.levels.mt - 27137.49) < 0.01);
  assert.ok(b, "كتلة أبريل المتحقَّقة ما انكشفت — المحرك ابتعد عن المرجع البشري");

  assert.equal(b.side, "demand");
  assert.equal(b.candleCount, 4);
  assert.equal(+b.levels.open.toFixed(2), 27355.22);
  assert.equal(+b.levels.mt.toFixed(2), 27137.49);
  assert.equal(+b.levels.close.toFixed(2), 26919.76);
  assert.equal(+b.levels.outerWick.toFixed(2), 26875.83);

  /* R3: كل شموع الكتلة لازم تكون هابطة بسيناريو شرائي. */
  for (let i = b.groupStartIndex; i <= b.groupEndIndex; i++) {
    const c = Q1Q2.candles[i];
    assert.ok(c.close < c.open, `شمعة @${i} مش هابطة`);
  }
});

test("كتلة العرض المتحقَّقة يدوياً — ٣ شموع خضرا (٢٠٢٦-٠٦-١٦)", () => {
  const b = rS.blocks.find((x) => Math.abs(x.levels.mt - 30561.93) < 0.01);
  assert.ok(b, "كتلة يونيو المتحقَّقة ما انكشفت — المحرك ابتعد عن المرجع البشري");

  assert.equal(b.side, "supply");
  assert.equal(b.candleCount, 3);
  assert.equal(+b.levels.outerWick.toFixed(2), 30652.60);
  assert.equal(+b.levels.mt.toFixed(2), 30561.93);
  assert.equal(+b.levels.fvg.toFixed(2), 30434.20);

  /* R3 بالاتجاه المعاكس: كل شموع الكتلة صاعدة بسيناريو بيعي. */
  for (let i = b.groupStartIndex; i <= b.groupEndIndex; i++) {
    const c = STRUCT.candles[i];
    assert.ok(c.close > c.open, `شمعة @${i} مش صاعدة`);
  }
});

test("R3 — ولا كتلة فيها شمعة بنفس اتجاه حركتها", () => {
  const pairs = [[rQ, Q1Q2.candles], [rS, STRUCT.candles]];
  let checked = 0;
  for (const [r, C] of pairs) {
    for (const b of r.blocks) {
      for (let i = b.groupStartIndex; i <= b.groupEndIndex; i++) {
        const bearish = C[i].close < C[i].open;
        assert.equal(bearish, b.direction === "up", `${b.id}: شمعة @${i} بنفس اتجاه الحركة`);
        checked++;
      }
    }
  }
  assert.ok(checked > 50, `شرط مسبق: انفحصت ${checked} شمعة بس`);
});

test("R4 — ولا كتلة جسمها أصغر من ذيولها", () => {
  assert.ok(rQ.blocks.length > 0, "شرط مسبق: في كتل");
  for (const b of [...rQ.blocks, ...rS.blocks]) {
    assert.ok(
      b.blockBodyRatio > SK_DEFAULTS.minBlockBodyRatio,
      `${b.id}: جسم ${b.blockBodyRatio} — كتلة عبارة عن ذيل`
    );
  }
});

test("R1 — أول حدث هيكل بعد كل كتلة بنفس اتجاهها", () => {
  assert.ok(rQ.blocks.length > 0, "شرط مسبق: في كتل");
  for (const b of [...rQ.blocks, ...rS.blocks]) {
    assert.equal(b.structureEvent.direction, b.direction, `${b.id}: الحدث بعكس الكتلة`);
    assert.ok(["BOS", "MSS"].includes(b.structureEvent.type), `${b.id}: نوع حدث غير معروف`);
    assert.ok(b.structureEvent.index > b.groupEndIndex, `${b.id}: الحدث قبل الكتلة`);
  }
});

test("ولا رقم ATR ولا نسبة ثابتة بقاعدة الزخم", () => {
  const src = fs.readFileSync(path.join(HERE, "rules-sk.js"), "utf8");
  const body = src.split("export function analyzeOrderBlocksSK")[1] || "";
  /* بحث عن مقارنة زخم بعتبة رقمية — اللي منعها صراحةً. */
  assert.ok(!/rangeRatio|atrMult|minDisplacement|×\s*ATR\s*[<>]/.test(body),
    "تسرّبت عتبة زخم رقمية لقاعدة R1");
  assert.equal(SK_DEFAULTS.minDisplacement, undefined, "minDisplacement رجع للإعدادات");
});

test("التأكيد بعد التكوّن — ما في نظر للمستقبل", () => {
  assert.ok(rQ.blocks.length > 0, "شرط مسبق: في كتل");
  for (const b of rQ.blocks) {
    assert.ok(b.confirmedAtIndex >= b.formedAtIndex, `${b.id}: التأكيد قبل التكوّن`);
    assert.ok(b.confirmedAtIndex >= b.structureEvent.index, `${b.id}: التأكيد قبل الحدث`);
    assert.equal(b.availableFromIndex, b.confirmedAtIndex);
  }
  /* والرقم لازم ينعرض بالميتا — مش ينخبّى. */
  assert.ok(rQ.meta.barsToConfirmation, "إحصاء شموع التأكيد مفقود");
  assert.ok(rQ.meta.barsToConfirmation.max >= rQ.meta.barsToConfirmation.median);
});

test("blocksAsOfSK ما بترجّع كتلة قبل تأكيدها", () => {
  const b = rQ.blocks.find((x) => Math.abs(x.levels.mt - 27137.49) < 0.01);
  assert.ok(b, "شرط مسبق: كتلة أبريل موجودة");
  assert.ok(b.confirmedAtIndex > b.groupEndIndex, "شرط مسبق: التأكيد بعد الكتلة فعلاً");

  const before = blocksAsOfSK(rQ, Q1Q2.candles, b.confirmedAtIndex - 1);
  assert.ok(!before.some((x) => x.id === b.id), "الكتلة ظهرت قبل تأكيدها");

  const at = blocksAsOfSK(rQ, Q1Q2.candles, b.confirmedAtIndex);
  assert.ok(at.some((x) => x.id === b.id), "الكتلة ما ظهرت عند تأكيدها");
});

test("ولا كتلة سكّر السعر خلفها قبل تأكيدها", () => {
  /* قاعدة صاحب المنهجية: «ما لازم بعد ما يتكون ينزل السعر ويسكّر تحته
     بحال كان سيناريو شرائي، والعكس بالبيعي».
     الخرق اللي بيحرسه: فحص الإبطال كان بيبلّش من `i+1` فبيتخطّى شمعة
     الحركة — وشمعة صاعدة بفجوة هابطة قدرت تسكّر تحت كتلة طلب وتضل تنعدّ. */
  const pairs = [[rQ, Q1Q2.candles], [rS, STRUCT.candles]];
  let checked = 0;
  for (const [r, C] of pairs) {
    assert.ok(r.blocks.length > 0, "شرط مسبق: في كتل");
    for (const b of r.blocks) {
      const up = b.direction === "up";
      /* من شمعة الحركة نفسها — مش من اللي بعدها. */
      for (let k = b.formedAtIndex; k <= b.confirmedAtIndex; k++) {
        const c = C[k];
        const beyond = up ? c.close < b.levels.outerWick : c.close > b.levels.outerWick;
        assert.ok(!beyond, `${b.id}: سكّر خلف الحد @${k} (${c.close}) وضلّ يتأكد @${b.confirmedAtIndex}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 100, `شرط مسبق: انفحصت ${checked} شمعة بس`);
});

test("شمعة الحركة نفسها داخلة بفحص الإبطال", () => {
  const pairs = [[rQ, Q1Q2.candles], [rS, STRUCT.candles]];
  for (const [r, C] of pairs) {
    for (const b of r.blocks) {
      const up = b.direction === "up";
      const c = C[b.formedAtIndex];
      const beyond = up ? c.close < b.levels.outerWick : c.close > b.levels.outerWick;
      assert.ok(!beyond, `${b.id}: شمعة الحركة سكّرت خلف الحد — الكتلة ولدت ميتة`);
    }
  }
});

test("R6 — كل كتلة اكتملت: السعر سكّر خلف مستوى Open", () => {
  /* «أول شمعة من سلسلة الشموع الهابطة، أعلاهم سعراً، بس يغلق السعر فوقها
     — هذا آخر شرط من شروط تكوّن الـOB.» */
  const pairs = [[rQ, Q1Q2.candles], [rS, STRUCT.candles]];
  let checked = 0;
  for (const [r, C] of pairs) {
    assert.ok(r.blocks.length > 0, "شرط مسبق: في كتل");
    for (const b of r.blocks) {
      const up = b.direction === "up";
      const k = b.completedAtIndex;
      assert.ok(Number.isInteger(k), `${b.id}: بلا فهرس اكتمال`);
      assert.ok(k >= b.formedAtIndex, `${b.id}: اكتملت قبل ما تتكوّن`);
      const c = C[k];
      assert.ok(
        up ? c.close > b.levels.open : c.close < b.levels.open,
        `${b.id}: فهرس الاكتمال ما بيسكّر خلف Open (${b.levels.open})`
      );
      /* وما في إغلاق أبكر بيحقق الشرط — الاكتمال **أول** مرة. */
      for (let j = b.formedAtIndex; j < k; j++) {
        const e = C[j];
        assert.ok(
          !(up ? e.close > b.levels.open : e.close < b.levels.open),
          `${b.id}: في اكتمال أبكر @${j}`
        );
      }
      checked++;
    }
  }
  assert.ok(checked > 10, `شرط مسبق: انفحصت ${checked} كتلة بس`);
});

test("التأكيد ما بيسبق الاكتمال", () => {
  for (const b of [...rQ.blocks, ...rS.blocks]) {
    assert.ok(b.confirmedAtIndex >= b.completedAtIndex, `${b.id}: تأكّدت قبل ما تكتمل`);
  }
});

test("R2 مسجَّل ومعطَّل صراحةً — مش منسي", () => {
  assert.equal(SK_DEFAULTS.requireLiquidity, false);
  assert.match(rQ.meta.pendingRules.R2, /معطَّل/);
  for (const b of rQ.blocks) assert.ok("liquidityContext" in b, `${b.id}: سياق السيولة مش مسجَّل`);
});

test("الكتلة بتنلغى بإغلاق خلف الذيل الطرفي", () => {
  const withInval = rQ.blocks.filter((b) => b.invalidIndex !== -1);
  assert.ok(withInval.length > 0, "شرط مسبق: في كتل انكسرت فعلاً");
  for (const b of withInval) {
    const c = Q1Q2.candles[b.invalidIndex];
    const beyond = b.direction === "up" ? c.close < b.levels.outerWick : c.close > b.levels.outerWick;
    assert.ok(beyond, `${b.id}: فهرس الإبطال ما بيسكّر خلف الذيل الطرفي`);
  }
});
