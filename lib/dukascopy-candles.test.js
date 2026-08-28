import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchDukascopyCandles } from "./dukascopy-candles.js";

/* ══════════════════════════════════════════════════════════════════════
   🔴 العطل المقيس — «قاصص الذهب من ٢٠٠٦ وبفتح ربع ساعة، ما بيفتح»

   الفريمات تحت الساعة بتنبني من ملفات أرشيف أدقّ بكتير، فنفس عدد الأيام
   بيكلّف أضعافاً. مقيس على ذهب بمرساة ٢٠٠٦-٠١-١٦ و`count=20000`:

       ١ دقيقة   ١٧ يوم    ✗ 429      ساعة     ١٠٤٢ يوم  ✓ 8957
       ٥ دقايق   ٨٧ يوم    ✗ 429      ٤ ساعات  ٤١٦٧ يوم  ✓ 2570
       ١٥ دقيقة  ٢٦٠ يوم   ✗ 429      يومي    ٢٥٠٠٠ يوم  ✓ 1186

   المدى الأصغر بيفشل والأكبر بينجح — فالمتغيّر مش الزمن.

   وأرشيف الدقائق موجود بعمق (ذهب · فريم الدقيقة · نافذة يوم):
       ٢٠٠٦ ✓ 1284 شمعة · ٢٠١١ ✓ 1417
   ══════════════════════════════════════════════════════════════════════ */

const DAY_MS = 86400000;

/** بيسجّل المدى المطلوب فعلياً وعدد المحاولات، بلا شبكة. */
function spy({ failTimes = 0, bars = null } = {}) {
  const fn = async ({ dates }) => {
    fn.calls++;
    fn.spans.push((dates.to - dates.from) / DAY_MS);
    fn.lastTo = dates.to;
    if (fn.calls <= failTimes) throw new Error("Request failed with status 429");
    return bars || [{ timestamp: dates.to.getTime() - DAY_MS, open: 1, high: 2, low: 0.5, close: 1.5, volume: 3 }];
  };
  fn.calls = 0;
  fn.spans = [];
  return fn;
}

const CUT_2006 = Math.floor(Date.UTC(2006, 0, 16) / 1000);

/* ══════════════ الفواصل بين المحاولات ══════════════ */

test("🔴 المحاولات كانت تنطلق بلا فاصل — كلهن بنفس نافذة الحد", async () => {
  /* الفاصل المقيس: ~٤٠٠ملّي بتفشل · ٦–١٥ ثانية بتمرّق. بلا ميزانية ما في
     فاصل إطلاقاً، فالتلاتة بيوقعوا جوّا نفس النافذة اللي رفضت الأولى. */
  const s = spy({ failTimes: 2 });
  const t0 = Date.now();
  await fetchDukascopyCandles("xauusd", "15min", 3000, CUT_2006, 27000, { getRates: s });
  const elapsed = Date.now() - t0;

  assert.equal(s.calls, 3, "لازم تلات محاولات");
  assert.ok(elapsed >= 11000, `المحاولات لازم تتباعد — طلعت ${elapsed}ms`);
});

test("⚠️ وما بتتجاوز الميزانية — ٢٤ ثانية كانت بتلامس سقف الدالة", async () => {
  /* بفاصل ٩ وهامش ٣ طلع المسار ٢٤ ثانية مقيسة، والمهلة ٢٧ و`maxDuration` ٣٠.
     تجاوز السقف بيطلّع 500 عارية بدل تراجع مرتّب. */
  const s = spy({ failTimes: 2 });
  const t0 = Date.now();
  await fetchDukascopyCandles("xauusd", "15min", 3000, CUT_2006, 27000, { getRates: s });
  assert.ok(Date.now() - t0 < 20000, `المسار الكامل لازم يضل تحت ٢٠ ثانية — طلع ${Date.now() - t0}ms`);
});

test("المسار المباشر ما بينتظر — ٨ ثواني ما بتتسع لفاصل", async () => {
  /* هناك السرعة أهم، والتراجع ليوهو مقبول للعرض الحي. */
  const s = spy({ failTimes: 2 });
  const t0 = Date.now();
  await fetchDukascopyCandles("xauusd", "15min", 1000, null, 8000, { getRates: s });
  assert.equal(s.calls, 3);
  assert.ok(Date.now() - t0 < 1500, `المباشر لازم يفشل بسرعة — طلع ${Date.now() - t0}ms`);
});

test("النجاح من أول محاولة = بلا أي فاصل", async () => {
  const s = spy();
  const t0 = Date.now();
  const out = await fetchDukascopyCandles("xauusd", "15min", 3000, CUT_2006, 27000, { getRates: s });
  assert.equal(s.calls, 1);
  assert.ok(Date.now() - t0 < 1000, "ما في داعي لأي انتظار لما تنجح");
  assert.ok(out.candles.length >= 1);
});

/* ══════════════ التقليص بيصغّر المدى فعلاً ══════════════ */

test("كل محاولة بمدى أصغر من اللي قبلها", async () => {
  const s = spy({ failTimes: 2 });
  await fetchDukascopyCandles("xauusd", "15min", 3000, CUT_2006, 27000, { getRates: s });
  assert.equal(s.spans.length, 3);
  assert.ok(s.spans[1] < s.spans[0], `${s.spans[1]} لازم أصغر من ${s.spans[0]}`);
  assert.ok(s.spans[2] < s.spans[1], `${s.spans[2]} لازم أصغر من ${s.spans[1]}`);
});

test("خطأ مش 429 بيوقف فوراً — التقليص ما بيصلّح رمزاً غلط", async () => {
  const boom = async () => {
    boom.calls++;
    throw new Error("رمز غير مدعوم");
  };
  boom.calls = 0;
  const out = await fetchDukascopyCandles("nope", "15min", 3000, CUT_2006, 27000, { getRates: boom });
  assert.equal(boom.calls, 1, "محاولة وحدة بس");
  assert.match(out.error, /غير مدعوم/);
});

/* ══════════════ الرفض المبكّر ══════════════ */

test("فريم غير مدعوم ورمز ناقص بيرجّعوا خطأ مش رمية", async () => {
  assert.match((await fetchDukascopyCandles("xauusd", "7min")).error, /فريم غير مدعوم/);
  assert.match((await fetchDukascopyCandles("", "15min")).error, /لا يوجد رمز/);
});

test("الجلب الناجح بيرجّع شموع بالثواني", async () => {
  const s = spy();
  const out = await fetchDukascopyCandles("xauusd", "1h", 1000, null, 0, { getRates: s });
  assert.equal(out.error, undefined);
  assert.ok(out.candles[0].time < 2e10, "بالثواني مش الملّي");
});
