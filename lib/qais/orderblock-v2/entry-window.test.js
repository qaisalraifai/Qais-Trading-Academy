/* اختبارات R8 — قاعدة الثلث.

   الاختبار المرجعي: الوحدة لازم تعيد إنتاج فيبوناتشي رسمه صاحب المنهجية
   بإيده على شارته (قاع 22783.60 · قمة 30760.10 · ثلث 28103.93). الفروق
   المسموحة صغيرة وسببها معروف ومقيس: زحزحة CFI عن Dukascopy.
*/

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { analyzeStructureV2 } from "../structure/index.js";
import { impulseLegAt, entryAllowed, firstEntryIndex, blockStateAt, THIRD } from "./entry-window.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const load = (n) => JSON.parse(fs.readFileSync(path.join(HERE, "verify/fixtures", n), "utf8"));
const H4FX = load("nas100-h4-2026-context.json");
const D1FX = load("nas100-d1-2024-2026.json");
const H4 = H4FX.candles, D1 = D1FX.candles;

const swH4 = analyzeStructureV2(H4, { timeframe: "h4" }).majorSwings;
const swD1 = analyzeStructureV2(D1, { timeframe: "daily" }).majorSwings;
const at = (C, ts) => { const i = C.findIndex((c) => c.time >= ts); return i < 0 ? C.length - 1 : i; };
const ctxFor = (ts) => [
  { timeframe: "h4", majorSwings: swH4, asOfIndex: at(H4, ts) },
  { timeframe: "daily", majorSwings: swD1, asOfIndex: at(D1, ts) },
];

const TS_FORMED = Date.UTC(2026, 3, 28, 12) / 1000;
const TS_RETEST = Date.UTC(2026, 6, 29, 20) / 1000;

test("العيّنتان ما انتغيّرتا", () => {
  for (const fx of [H4FX, D1FX]) {
    assert.ok(fx.candles.length > 100, `شرط مسبق: ${fx.id} فيها شموع`);
    const sha = crypto.createHash("sha256").update(JSON.stringify(fx.candles)).digest("hex");
    assert.equal(sha, fx.sha256, `${fx.id}: البصمة اتغيّرت`);
  }
});

test("الساق اليومية بتعيد إنتاج فيبو صاحب المنهجية", () => {
  const leg = impulseLegAt(swD1, at(D1, TS_RETEST), true);
  assert.notEqual(leg.value, "INSUFFICIENT_DATA", leg.why);

  /* الفروق المقبولة مقيسة، مش اعتباطية: زحزحة CFI عن Dukascopy على
     نفس الطرفين طلعت 3.06 و0.17 نقطة. */
  assert.ok(Math.abs(leg.low.price - 22783.60) < 6, `القاع ${leg.low.price} بعيد عن 22783.60`);
  assert.ok(Math.abs(leg.high.price - 30760.10) < 6, `القمة ${leg.high.price} بعيدة عن 30760.10`);
  assert.ok(Math.abs(leg.threshold - 28103.93) < 8, `الثلث ${leg.threshold} بعيد عن 28103.93`);
});

test("«آخر قاع كبير» = آخر واحد **قبل القمة**، مش آخر واحد زمنياً", () => {
  const idx = at(D1, TS_RETEST);
  const leg = impulseLegAt(swD1, idx, true);
  assert.notEqual(leg.value, "INSUFFICIENT_DATA");

  const avail = swD1.filter((s) => Number.isFinite(s.confirmedAtIndex) && s.confirmedAtIndex <= idx);
  const lows = avail.filter((s) => s.type === "low");
  const latestLow = lows.reduce((m, s) => (s.index > m.index ? s : m));

  /* شرط مسبق: في فعلاً قاع أحدث بعد القمة — وإلا الاختبار ما بيفحص شي. */
  assert.ok(latestLow.index > leg.high.index, "شرط مسبق: ما في قاع بعد القمة — العيّنة ما بتفحص التمييز");
  assert.notEqual(leg.low.index, latestLow.index, "أخد آخر قاع زمنياً بدل آخر قاع قبل القمة");
  assert.ok(leg.low.index < leg.high.index, "القاع بعد القمة — الساق مقلوبة");
});

test("سببية: الساق ما بتنعرف قبل تأكيد طرفيها", () => {
  const legAtForm = impulseLegAt(swD1, at(D1, TS_FORMED), true);
  const legAtRetest = impulseLegAt(swD1, at(D1, TS_RETEST), true);
  assert.notEqual(legAtRetest.value, "INSUFFICIENT_DATA");

  /* وقت تكوّن الكتلة، قمة الساق (٣ يونيو) ما كانت صارت بعد. */
  assert.ok(
    legAtForm.value === "INSUFFICIENT_DATA" || legAtForm.high.price < legAtRetest.high.price,
    "الساق وقت التكوّن بتعرف قمة ما صارت بعد — نظر للمستقبل"
  );
  assert.ok(legAtRetest.knownFromIndex <= at(D1, TS_RETEST), "الساق «معروفة» بعد لحظة السؤال");
});

test("الدخول ممنوع قبل اكتمال الساق ومسموح بعدها", () => {
  const px = 27137.49; // MT كتلة أبريل
  const before = entryAllowed(px, true, ctxFor(TS_FORMED));
  const after = entryAllowed(px, true, ctxFor(TS_RETEST));

  assert.ok(before.value === "INSUFFICIENT_DATA" || before.allowed === false,
    "الدخول انسمح وقت التكوّن — الساق ما كانت اكتملت");
  assert.equal(after.allowed, true, `الدخول انمنع وقت العودة: ${after.reason}`);
  assert.equal(after.perTimeframe.length, 2, "ما انفحص الفريمان");
  for (const t of after.perTimeframe) assert.equal(t.ok, true, `${t.timeframe} ما حقق الشرط`);
});

test("قراره «ج»: الفريمان مطلوبان — واحد وحده أرخى بكتير", () => {
  const idx = at(H4, TS_RETEST);
  const legH4 = impulseLegAt(swH4, idx, true);
  const legD1 = impulseLegAt(swD1, at(D1, TS_RETEST), true);
  assert.notEqual(legH4.value, "INSUFFICIENT_DATA");
  assert.notEqual(legD1.value, "INSUFFICIENT_DATA");

  /* الفرق المقيس ~٢٣٠٠ نقطة. لو صار صغير، الفريمان صاروا مترادفين
     والقرار «ج» فقد معناه — لازم ينراجع. */
  const gap = Math.abs(legH4.threshold - legD1.threshold);
  assert.ok(gap > 500, `الفرق بين الفريمين ${gap.toFixed(0)} نقطة — صاروا مترادفين، راجع القرار`);

  /* سعر بين العتبتين: مسموح بالفريم الأرخى، ممنوع بالمركّب. */
  const between = (legH4.threshold + legD1.threshold) / 2;
  const combined = entryAllowed(between, true, ctxFor(TS_RETEST));
  assert.equal(combined.allowed, false, "سعر فوق ثلث اليومي انسمح — الفريم التاني ما انفحص");
});

test("INSUFFICIENT_DATA بتنتشر ولا بتنقلب «ممنوع»", () => {
  const r = entryAllowed(27000, true, [{ timeframe: "h4", majorSwings: [], asOfIndex: 10 }]);
  assert.equal(r.value, "INSUFFICIENT_DATA", "نقص البيانات انقلب رفضاً");
  assert.ok(r.why.includes("h4"), "السبب ما بيذكر أي فريم");

  const empty = entryAllowed(27000, true, []);
  assert.equal(empty.value, "INSUFFICIENT_DATA");
});

test("أول دخول مسموح على كتلة أبريل = ٢٩ يوليو ٢٠٢٦", () => {
  const formedAt = at(H4, TS_FORMED);
  const block = {
    direction: "up", top: 27377.22, bottom: 26875.83,
    levels: { open: 27355.22, mt: 27137.49, outerWick: 26875.83 },
    confirmedAtIndex: formedAt, invalidIndex: -1,
  };
  const e = firstEntryIndex(H4, block, (i) => ctxFor(H4[i].time));
  assert.ok(e, "ما لقى دخول مسموح");
  assert.equal(new Date(e.time * 1000).toISOString().slice(0, 10), "2026-07-29");
  assert.ok(e.price > 27000 && e.price < 27400, `سعر الدخول ${e.price} برّا نطاق الكتلة`);

  /* ولازم يكون في لمسات **قبله** انرفضت — وإلا القاعدة ما فلترت شي. */
  let touchesBefore = 0;
  for (let i = formedAt; i < e.index; i++) if (H4[i].low <= block.top) touchesBefore++;
  assert.ok(touchesBefore > 0, "ما في ولا لمسة مرفوضة قبل الدخول — القاعدة ما بتفلتر");
});

test("الاتجاه الهابط معكوس تماماً", () => {
  const idx = at(D1, TS_RETEST);
  const up = impulseLegAt(swD1, idx, true);
  const down = impulseLegAt(swD1, idx, false);
  if (down.value === "INSUFFICIENT_DATA") return; // مقبول لو ما في ساق هابطة بالعيّنة
  assert.equal(down.direction, "down");
  assert.ok(down.threshold > down.low.price, "عتبة الهابط تحت القاع — الاتجاه مقلوب");
  assert.notEqual(up.threshold, down.threshold, "الاتجاهان بيعطوا نفس العتبة");
});

test("دورة الحياة: forming → waiting → entry", () => {
  const formedAt = at(H4, TS_FORMED);
  const block = {
    direction: "up", top: 27377.22, bottom: 26875.83,
    levels: { open: 27355.22, mt: 27137.49, outerWick: 26875.83 },
    confirmedAtIndex: formedAt, invalidIndex: -1,
  };
  const ctxAt = (i) => [
    { timeframe: "h4", majorSwings: swH4, asOfIndex: i },
    { timeframe: "daily", majorSwings: swD1, asOfIndex: at(D1, H4[i].time) },
  ];

  assert.equal(blockStateAt(H4, block, formedAt - 1, ctxAt).state, "forming");
  assert.equal(blockStateAt(H4, block, formedAt, ctxAt).state, "waiting");

  const final = blockStateAt(H4, block, H4.length - 1, ctxAt);
  assert.equal(final.state, "entry");
  assert.equal(new Date(final.entry.time * 1000).toISOString().slice(0, 10), "2026-07-29");

  /* ⚠️ `waiting` حالة طبيعية وممكن تطول — والرقم لازم يضل ظاهر.
     كتلة أبريل ضلّت منتظرة ~٦٨ يوم. */
  const waitBars = final.entry.index - formedAt;
  assert.ok(waitBars > 200, `الانتظار ${waitBars} شمعة — أقصر من المقيس، راجع`);

  /* والحالة ما بترجع للورا: قبل الدخول لازم تكون waiting مش entry. */
  assert.equal(blockStateAt(H4, block, final.entry.index - 1, ctxAt).state, "waiting");
});

test("الإبطال بيسبق كل الحالات", () => {
  const formedAt = at(H4, TS_FORMED);
  const block = {
    direction: "up", top: 27377.22, bottom: 26875.83,
    levels: { open: 27355.22, mt: 27137.49, outerWick: 26875.83 },
    confirmedAtIndex: formedAt, invalidIndex: formedAt + 10,
  };
  const ctxAt = (i) => [
    { timeframe: "h4", majorSwings: swH4, asOfIndex: i },
    { timeframe: "daily", majorSwings: swD1, asOfIndex: at(D1, H4[i].time) },
  ];
  assert.equal(blockStateAt(H4, block, formedAt + 10, ctxAt).state, "invalid");
  assert.equal(blockStateAt(H4, block, H4.length - 1, ctxAt).state, "invalid",
    "كتلة مبطَّلة رجعت تعطي دخولاً");
});

test("THIRD = ثلث فعلي", () => {
  assert.ok(Math.abs(THIRD - 1 / 3) < 1e-12);
  /* ⚠️ صاحب المنهجية كاتب `0.333` على شارته. الفرق على ساق ٧٩٧٩ نقطة
     = ٢.٦٦ نقطة — مهمل، بس مذكور عشان ما ينحسب خطأ لاحقاً. */
  const span = 7979.38;
  assert.ok(Math.abs(THIRD * span - 0.333 * span) < 3);
});

test("⚠️ مرساة المرآة: بتصلّح الهابط وما بتلمس الصاعد المتحقَّق", () => {
  /* ============================================================================
     العطل: `impulseLegAt` بتاخد أقصى طرف بكل التاريخ بلا نافذة. بسوق صاعد
     «أعلى قمة» حديثة فالصاعد سليم، بس «أدنى قاع» سحيق فالهابط بينسحب لسنين.
     مقيس: **ولا ثلث بيعي صالح من ١٠٥ كتلة** (٤٧ INSUFFICIENT · ٤٧ عبثي).

     الحل المقيس: المرساة = الطرف المقابل العالمي، والبعيد من بعدها. بسوق
     صاعد «أعلى قمة بعد أدنى قاع» = أعلى قمة، فالصاعد ما بيتغيّر.

     الشرط الملزم: الثلثان اللي رسمهما بإيده لازم يضلوا كما هما.
     ============================================================================ */
  const ts = Date.UTC(2026, 6, 29, 12) / 1000;
  const i = at(D1, ts);
  const g = impulseLegAt(swD1, i, true);
  const m = impulseLegAt(swD1, i, true, { anchor: "mirror" });
  assert.notEqual(g.value, "INSUFFICIENT_DATA", "شرط مسبق: النسخة القائمة بتعطي ساقاً");
  assert.equal(m.threshold, g.threshold, "المرآة غيّرت الثلث الصاعد — ممنوع");
  /* ومطابق لرسمه اليدوي (28,103.93 — الفرق زحزحة CFI). */
  assert.ok(Math.abs(m.threshold - 28103.93) < 5, `الثلث ${m.threshold} بعيد عن مرجعه`);

  /* والهابط: القائم سحيق، والمرآة حقيقية. */
  const gd = impulseLegAt(swD1, i, false);
  const md = impulseLegAt(swD1, i, false, { anchor: "mirror" });
  assert.notEqual(md.value, "INSUFFICIENT_DATA", "المرآة ما أعطت ساقاً هابطة");
  const price = D1[i].close;
  assert.ok(Math.abs(md.threshold - price) < Math.abs(gd.threshold - price),
    `المرآة (${md.threshold}) مش أقرب للسعر ${price} من القائم (${gd.threshold})`);
});

test("الافتراضي `global` — السلوك ما تغيّر بلا طلب", () => {
  const ts = Date.UTC(2026, 6, 29, 12) / 1000;
  const i = at(D1, ts);
  const def = impulseLegAt(swD1, i, false);
  const exp = impulseLegAt(swD1, i, false, { anchor: "global" });
  assert.deepEqual(def, exp, "الافتراضي مش global");
});
