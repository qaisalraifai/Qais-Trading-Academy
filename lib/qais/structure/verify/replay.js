/* ============================================================================
   lib/qais/structure/verify/replay.js
   تشغيل المحرك شمعة-بشمعة على بيانات حقيقية.

   ليش شمعة-بشمعة ومش تشغيلة وحدة على كل المصفوفة:
   ---------------------------------------------------------------------------
   التشغيلة الوحدة بتقدر — نظرياً — تستفيد من معلومة مستقبلية بدون ما ننتبه.
   الادعاء إنه المحرك سببي (causal) لازم **ينقاس** مش ينفترض. فمنشغّله على
   [0..i] لكل i ومنسجّل أول لحظة ظهر فيها كل حدث (`detectedAtIndex`).

   من هون بتطلع كمية معلومات ما بتطلع من التشغيلة الوحدة:
     • تأخير الاكتشاف = detectedAtIndex − eventIndex
       (المفروض صفر للنوعين — BOS وMSS الاتنين فوريين بالمنهجية الحالية)
     • أي حدث بيظهر ثم **يختفي** لاحقاً = عدم استقرار، وهاد عيب خطير
       بمحرك هيكل: يعني بيقول للمتداول إشي وبعدين بيسحبه.
   ============================================================================ */

import { analyzeStructureV2 } from "../index.js";

/**
 * @param candles  شموع حقيقية مرتبة تصاعدياً
 * @param options  إعدادات المحرك + { stride, maxCandles, warmup }
 */
export function replayIncremental(candles, options = {}) {
  const { stride = 1, maxCandles = 1200, warmup = 40, ...engineOptions } = options;

  const n = Array.isArray(candles) ? candles.length : 0;
  if (n === 0) {
    return { ok: false, reason: "ما في شموع", firstSeen: new Map(), disappeared: [], steps: 0 };
  }

  /* التشغيل O(n²) — فمنقصّه على آخر maxCandles شمعة. القص من **الأول**
     مش من الآخر، حتى تضل السلسلة متصلة لآخر البيانات. */
  const slice = n > maxCandles ? candles.slice(n - maxCandles) : candles;
  const offset = n - slice.length;

  const firstSeen = new Map(); // eventKey -> { step, event }
  const lastSeenStep = new Map();
  let steps = 0;

  for (let i = warmup; i < slice.length; i += stride) {
    const window = slice.slice(0, i + 1);
    const r = analyzeStructureV2(window, engineOptions);
    steps++;
    if (!r.ok) continue;

    for (const e of r.events) {
      const key = eventKey(e);
      if (!firstSeen.has(key)) {
        firstSeen.set(key, {
          step: i,
          detectedAtIndex: i + offset,
          eventIndex: e.index + offset,
          event: { ...e, index: e.index + offset },
        });
      }
      lastSeenStep.set(key, i);
    }
  }

  /* حدث ظهر وبعدين اختفى قبل نهاية التشغيل = غير مستقر. */
  const finalRun = analyzeStructureV2(slice, engineOptions);
  const finalKeys = new Set((finalRun.events || []).map(eventKey));
  const disappeared = [];
  for (const [key, rec] of firstSeen) {
    if (!finalKeys.has(key)) {
      disappeared.push({
        key,
        firstSeenAtIndex: rec.detectedAtIndex,
        lastSeenStep: lastSeenStep.get(key) + offset,
        event: rec.event,
      });
    }
  }

  const latencies = [];
  for (const rec of firstSeen.values()) {
    latencies.push({
      key: eventKey(rec.event),
      type: rec.event.type,
      direction: rec.event.direction,
      eventIndex: rec.eventIndex,
      detectedAtIndex: rec.detectedAtIndex,
      latencyCandles: rec.detectedAtIndex - rec.eventIndex,
    });
  }

  return {
    ok: true,
    reason: null,
    steps,
    warmup,
    replayedCandles: slice.length,
    skippedFromStart: offset,
    firstSeen,
    latencies,
    disappeared,
    finalEvents: (finalRun.events || []).map((e) => ({ ...e, index: e.index + offset })),
  };
}

/** مفتاح ثابت للحدث لا يعتمد على العدّاد الداخلي (seq) اللي بيتغيّر كل تشغيلة. */
export function eventKey(e) {
  return `${e.type}|${e.direction}|${e.index}|${round(e.price)}`;
}

function round(v) {
  return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : v;
}
