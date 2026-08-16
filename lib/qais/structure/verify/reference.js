/* ============================================================================
   lib/qais/structure/verify/reference.js
   المرجع البشري — المعيار الخارجي الوحيد.

   ليش هاد مختلف جوهرياً عن qais_ai_trades:
   ---------------------------------------------------------------------------
   الصفقات كانت **عيّنة جزئية** من مخرجات محرك سابق: بتغطي بعض اللحظات بس،
   ومصدرها منطق أثبتنا فيه أخطاء. فما كانت تسمح بقياس الإشارات الكاذبة
   إطلاقاً (حدث بلا صفقة مش دليل خطأ).

   المرجع البشري **كامل على عيّنة مجمّدة**: المحلّل بيمرّ على كل الشموع
   ويسجّل كل حدث هيكلي يشوفه. وهاد بيقلب المعادلة —

     • حدث بالمرجع وما لقاه المحرك  → False Negative مؤكد
     • حدث بالمحرك وما بالمرجع      → False Positive مؤكد
     • نفس اللحظة بنوع مختلف        → التباس تصنيف (أهم من الاتنين)

   شرطان لصلاحية أي قياس:
     ١) التسميات مربوطة بعيّنة **مجمّدة** ببصمة SHA — بيانات السوق بتنزاح،
        وتسمية على نافذة متحركة بتفقد معناها خلال أيام.
     ٢) كل وقت بالتسميات لازم يقع على شمعة موجودة فعلاً بالعيّنة. وقت مش
        موجود = خطأ بالمرجع، مش خطأ بالمحرك.
   ============================================================================ */

export const EVENT_TYPES = ["BOS", "MSS"]; // ما في CHOCH بالمنهجية
export const SWING_LABELS = ["HH", "HL", "LH", "LL"];

/**
 * فحص المرجع قبل أي قياس. بيرجّع أخطاء صريحة بدل ما يمشي على تسميات
 * معطوبة ويطلّع أرقام دقة بلا معنى.
 */
export function validateReference(reference, fixture) {
  const errors = [];
  const warnings = [];

  if (!reference || typeof reference !== "object") {
    return { ok: false, errors: ["المرجع مش كائن صالح"], warnings };
  }
  if (!fixture?.candles?.length) {
    return { ok: false, errors: ["العيّنة المجمّدة ناقصة"], warnings };
  }

  if (reference.fixtureId !== fixture.id) {
    errors.push(`المرجع مبني على عيّنة تانية (${reference.fixtureId} ≠ ${fixture.id})`);
  }
  if (reference.sha256 && fixture.sha256 && reference.sha256 !== fixture.sha256) {
    errors.push("بصمة العيّنة تغيّرت — الشموع اتبدّلت بعد التسمية، فالتسميات باطلة");
  }

  const timeSet = new Set(fixture.candles.map((c) => c.time));
  const events = Array.isArray(reference.events) ? reference.events : [];
  const swings = Array.isArray(reference.swings) ? reference.swings : [];

  let needsReview = 0;

  events.forEach((e, i) => {
    const at = `events[${i}]`;
    if (!EVENT_TYPES.includes(e.type)) errors.push(`${at}: نوع غير معروف "${e.type}"`);
    if (!["up", "down"].includes(e.direction)) errors.push(`${at}: اتجاه غير صالح "${e.direction}"`);
    if (!Number.isFinite(e.time)) errors.push(`${at}: وقت غير رقمي`);
    else if (!timeSet.has(e.time)) errors.push(`${at}: الوقت ${e.time} مش موجود بالعيّنة`);
    if (!e.reason || !String(e.reason).trim()) warnings.push(`${at}: بدون سبب مكتوب`);

    /* المستوى المكسور: هو دلالة `price` عند المحرك كمان (events.js بيحط
       price = مستوى السوينغ المكسور). حدث بلا مستوى بينحسب needs-review —
       بينقاس زمنياً ونوعياً، وبينستثنى من مقارنة المستوى بدل ما يتخمّنله. */
    const hasLevel = Number.isFinite(e.brokenSwingPrice) && Number.isFinite(e.brokenSwingTime);
    if (!hasLevel) {
      needsReview++;
      warnings.push(`${at}: بلا سوينغ مكسور (needs-review) — مستثنى من قياس المستوى`);
    } else {
      if (!timeSet.has(e.brokenSwingTime)) {
        errors.push(`${at}: وقت السوينغ المكسور ${e.brokenSwingTime} مش موجود بالعيّنة`);
      }
      if (e.brokenSwingTime >= e.time) {
        errors.push(`${at}: السوينغ المكسور لازم يسبق شمعة الكسر`);
      }
      if (Number.isFinite(e.price) && e.price !== e.brokenSwingPrice) {
        errors.push(`${at}: price لازم يساوي brokenSwingPrice (${e.price} ≠ ${e.brokenSwingPrice})`);
      }
    }
  });

  swings.forEach((s, i) => {
    const at = `swings[${i}]`;
    if (!["high", "low"].includes(s.type)) errors.push(`${at}: نوع غير صالح "${s.type}"`);
    if (s.label != null && !SWING_LABELS.includes(s.label)) errors.push(`${at}: تسمية غير معروفة "${s.label}"`);

    /* التسمية لازم تكون من عائلة النوع: قمة ← HH|LH، قاع ← HL|LL.
       قاع موسوم LH تناقض داخلي — يا التسمية غلط يا النوع، والاتنين
       بيخربوا قياس دقة التسمية. بينكشف بدل ما ينمرّر. */
    if (s.label && ["high", "low"].includes(s.type)) {
      const allowed = s.type === "high" ? ["HH", "LH"] : ["HL", "LL"];
      if (!allowed.includes(s.label)) {
        errors.push(
          `${at}: تسمية "${s.label}" ما بتنطبق على ${s.type === "high" ? "قمة" : "قاع"} — المسموح ${allowed.join(" أو ")}`
        );
      }
    }
    if (!Number.isFinite(s.time)) errors.push(`${at}: وقت غير رقمي`);
    else if (!timeSet.has(s.time)) errors.push(`${at}: الوقت ${s.time} مش موجود بالعيّنة`);
    if (!Number.isFinite(s.price)) errors.push(`${at}: سعر غير رقمي`);
  });

  if (events.length === 0 && swings.length === 0) {
    errors.push("المرجع فاضي — ما في تسميات");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    eventCount: events.length,
    swingCount: swings.length,
    needsReview,
    scorableForLevel: events.length - needsReview,
  };
}

/* -------------------------------------------------------------------------- */

/**
 * مطابقة ثنائية الاتجاه بين المرجع ومخرجات المحرك.
 *
 * المطابقة **جشعة على الأقرب زمنياً** مع استهلاك: كل حدث محرك بينستعمل
 * مرة وحدة بالكتير، حتى ما ينحسب حدث واحد كمطابقة لعدة تسميات ويضخّم
 * الأرقام.
 */
export function scoreEvents(referenceEvents, engineEvents, candles, options = {}) {
  const { windowCandles = 2, tfSeconds = null } = options;

  const secs = tfSeconds || inferBarSeconds(candles);
  const tol = secs ? windowCandles * secs : 0;

  const used = new Set();
  const matchedRefs = new Set();
  const matches = [];
  const falseNegatives = [];

  // بنرتّب المرجع زمنياً حتى تكون المطابقة حتمية بغض النظر عن ترتيب الإدخال
  const refs = [...referenceEvents].sort((a, b) => a.time - b.time);

  /* ============================================================================
     المطابقة: أزواج مرشّحة مرتّبة عالمياً — مش جشع بترتيب الزمن.
     ----------------------------------------------------------------------------
     النسخة السابقة كانت تمشي على المرجع بالترتيب الزمني وتخلّي كل تسمية
     تبلع أقرب حدث محرك غير مستهلك. النتيجة: تسمية مبكّرة ما إلها مقابل
     صحيح كانت تبلع الحدث اللي بيخص تسمية لاحقة — حتى لو النوع والاتجاه
     الاتنين غلط، لأنه المرشّح الوحيد. مُعاد إنتاجه:

         مرجع : BOS up @t10 · MSS down @t12
         محرك : MSS down @t12          ← مطابق تماماً للتسمية التانية
         النتيجة: TP 0 · recall 0 · precision 0

     محرك سليم تماماً بيتقيّم صفر. وتحريك نفس الزوج شمعتين بيرجّع
     recall 0.5 على نفس الدليل — يعني الرقم كان بيعتمد على ترتيب التسميات
     مش على سلوك المحرك.

     التصحيح: منبني كل الأزواج الممكنة، منرفض اللي **النوع والاتجاه فيها
     غلط الاتنين** (score 3 — هاي مش مطابقة بأي معنى)، ومنرتّب عالمياً
     بجودة المطابقة ثم القرب الزمني. الترتيب حتمي فالنتيجة معادة الإنتاج.
     ============================================================================ */
  const pairs = [];
  refs.forEach((ref, ri) => {
    engineEvents.forEach((e, idx) => {
      const dt = Math.abs(e.time - ref.time);
      if (dt > tol) return;
      const quality = (e.type === ref.type ? 0 : 1) + (e.direction === ref.direction ? 0 : 2);
      if (quality >= 3) return; // النوع والاتجاه غلط الاتنين — ما بتنعتبر مطابقة
      pairs.push({ ri, idx, quality, dt });
    });
  });
  pairs.sort((a, b) => a.quality - b.quality || a.dt - b.dt || a.ri - b.ri || a.idx - b.idx);

  for (const { ri, idx } of pairs) {
    if (matchedRefs.has(ri) || used.has(idx)) continue;
    const ref = refs[ri];
    const e = engineEvents[idx];
    used.add(idx);
    matchedRefs.add(ri);

    /* مقارنة المستوى المكسور: عند الطرفين `price` = مستوى السوينغ اللي
       انكسر (المحرك: events.js buildEvent(..., level, ...)). وبنقارن كمان
       **هوية** السوينغ نفسه عبر swingRef.time — هل كسر المحرك نفس القمة
       اللي حدّدها المحلّل، ولا قمة تانية صادف إنها بنفس السعر تقريباً. */
    const refLevel = Number.isFinite(ref.brokenSwingPrice) ? ref.brokenSwingPrice : null;
    const engLevel = Number.isFinite(e.price) ? e.price : null;
    const engSwingTime = e.swingRef?.time ?? null;

    matches.push({
      reference: ref,
      engine: e,
      typeMatch: e.type === ref.type,
      directionMatch: e.direction === ref.direction,
      timingDiffCandles: secs ? +((e.time - ref.time) / secs).toFixed(2) : null,
      timingDiffMinutes: +((e.time - ref.time) / 60).toFixed(1),
      levelScorable: refLevel != null && engLevel != null,
      sameBrokenSwing:
        refLevel == null || engSwingTime == null ? null : engSwingTime === ref.brokenSwingTime,
      priceDiff: refLevel != null && engLevel != null ? +(engLevel - refLevel).toFixed(5) : null,
      pricePct:
        refLevel != null && engLevel != null && refLevel !== 0
          ? +((Math.abs(engLevel - refLevel) / Math.abs(refLevel)) * 100).toFixed(4)
          : null,
    });
  }

  /* التسميات اللي ما لقيت ولا مرشّح مقبول — بعد ما خلص التوزيع العالمي. */
  refs.forEach((ref, ri) => {
    if (!matchedRefs.has(ri)) {
      falseNegatives.push({ ...ref, why: `ما في حدث محرك مقبول ضمن ±${windowCandles} شمعة` });
    }
  });

  const falsePositives = engineEvents
    .map((e, idx) => ({ e, idx }))
    .filter(({ idx }) => !used.has(idx))
    .map(({ e }) => ({ ...e, why: "حدث محرك ما إله مقابل بالمرجع" }));

  const exact = matches.filter((m) => m.typeMatch && m.directionMatch);
  const typeConfusion = matches.filter((m) => !m.typeMatch && m.directionMatch);
  const directionError = matches.filter((m) => !m.directionMatch);

  const precision = engineEvents.length ? exact.length / engineEvents.length : null;
  const recall = refs.length ? exact.length / refs.length : null;

  return {
    referenceCount: refs.length,
    engineCount: engineEvents.length,
    truePositives: exact.length,
    typeConfusion: typeConfusion.length,
    directionErrors: directionError.length,
    falseNegatives: falseNegatives.length,
    falsePositives: falsePositives.length,
    precision: precision == null ? null : +precision.toFixed(4),
    recall: recall == null ? null : +recall.toFixed(4),
    /* ============================================================================
       f1 مشتقّة من نفس الـprecision والـrecall المنشورين — فما بتقدر
       تناقضهم أبداً.
       ----------------------------------------------------------------------------
       قبل هيك كانت تنحسب من tp/fp/fn، وتسمية انطابقت بنوع أو اتجاه غلط
       ما كانت تدخل بأي منهم — فالمقامان بينقصوا. النتيجة المُعاد إنتاجها:

           precision 0.5 · recall 0.5 · f1 1.0 · directionErrors 1

       و f1 هي الرقم اللي بينقرا أول — فكانت تقول «مثالي» بينما خطأ اتجاه
       مسجّل بنفس السطر.
       ============================================================================ */
    f1: harmonic(precision, recall),
    brokenLevel: levelMetrics(matches),
    byType: perType(refs, matches, falseNegatives, falsePositives),
    byDirection: perDirection(refs, matches),
    details: { matches, falseNegatives, falsePositives, typeConfusion, directionError },
    tolerance: { windowCandles, barSeconds: secs },
  };
}

/**
 * هل كسر المحرك **نفس المستوى** اللي حدّده المحلّل؟
 * مقياس منفصل عن التوقيت عن قصد: ممكن يلقط الحدث بنفس اللحظة بالضبط
 * وهو شايف قمة تانية انكسرت — وهاد خطأ هيكلي مختلف تماماً عن التأخير.
 */
function levelMetrics(matches) {
  const scorable = matches.filter((m) => m.levelScorable);
  if (scorable.length === 0) {
    return { value: "INSUFFICIENT_DATA", why: "ما في مطابقات فيها مستوى مكسور بالطرفين" };
  }
  const identity = scorable.filter((m) => m.sameBrokenSwing !== null);
  const diffs = scorable.map((m) => Math.abs(m.priceDiff)).filter(Number.isFinite);
  diffs.sort((a, b) => a - b);

  return {
    scorable: scorable.length,
    excludedNeedsReview: matches.length - scorable.length,
    sameBrokenSwing: identity.length ? identity.filter((m) => m.sameBrokenSwing).length : null,
    swingIdentityRate: identity.length
      ? +(identity.filter((m) => m.sameBrokenSwing).length / identity.length).toFixed(4)
      : { value: "INSUFFICIENT_DATA", why: "أحداث المحرك ما بتحمل swingRef" },
    exactLevel: diffs.filter((d) => d === 0).length,
    absDiff: diffs.length
      ? {
          mean: +(diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(5),
          median: +diffs[Math.floor(diffs.length / 2)].toFixed(5),
          max: +diffs[diffs.length - 1].toFixed(5),
        }
      : null,
  };
}

/**
 * المتوسط التوافقي لـprecision وrecall المنشورين — بدون أي مقام تاني.
 *
 * التمييز المهم: `null` معناها **ما بينقاس** (ما في تسميات أصلاً، أو ما في
 * مخرج محرك). أما precision=0 وrecall=0 فهي نتيجة **مقيسة**: المحرك ما لقط
 * ولا حدث صح. إرجاع null هون بيخبّي صفراً حقيقياً وبيخلّيه يبان كنقص بيانات.
 */
function harmonic(p, r) {
  if (p == null || r == null) return null;
  if (p + r === 0) return 0;
  return +((2 * p * r) / (p + r)).toFixed(4);
}

function perType(refs, matches, fns, fps) {
  const out = {};
  for (const t of EVENT_TYPES) {
    const refN = refs.filter((r) => r.type === t).length;
    const tp = matches.filter((m) => m.reference.type === t && m.typeMatch && m.directionMatch).length;
    const fn = fns.filter((r) => r.type === t).length;
    const fp = fps.filter((e) => e.type === t).length;
    out[t] =
      refN === 0 && fp === 0
        ? { value: "INSUFFICIENT_DATA", why: `ما في ${t} بالمرجع ولا بالمحرك على هالعيّنة` }
        : {
            reference: refN,
            truePositives: tp,
            falseNegatives: fn,
            falsePositives: fp,
            recall: refN ? +(tp / refN).toFixed(4) : null,
            precision: tp + fp > 0 ? +(tp / (tp + fp)).toFixed(4) : null,
          };
  }
  return out;
}

function perDirection(refs, matches) {
  const out = {};
  for (const d of ["up", "down"]) {
    const refN = refs.filter((r) => r.direction === d).length;
    const tp = matches.filter((m) => m.reference.direction === d && m.typeMatch && m.directionMatch).length;
    out[d] = refN === 0 ? { value: "INSUFFICIENT_DATA", why: `ما في أحداث ${d} بالمرجع` } : { reference: refN, truePositives: tp, recall: +(tp / refN).toFixed(4) };
  }
  return out;
}

/**
 * السوينغات: بتنطابق بالوقت، وبتتقارن تسمياتها (HH/HL/LH/LL).
 * بنقيس المقياس الخارجي (major) لأنه هو اللي بيدّعي «هيكل» — الداخلي
 * وصفي وما إله ادعاء قابل للتخطئة.
 */
export function scoreSwings(referenceSwings, engineMajorSwings, candles, options = {}) {
  const { windowCandles = 1 } = options;
  const secs = inferBarSeconds(candles);
  const tol = secs ? windowCandles * secs : 0;

  const used = new Set();
  const matched = [];
  const missed = [];

  for (const ref of [...referenceSwings].sort((a, b) => a.time - b.time)) {
    let bestIdx = -1;
    let bestDist = Infinity;
    engineMajorSwings.forEach((s, idx) => {
      if (used.has(idx) || s.type !== ref.type) return;
      const d = Math.abs(s.time - ref.time);
      if (d <= tol && d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    });

    if (bestIdx === -1) {
      missed.push({ ...ref, why: `ما في سوينغ خارجي ${ref.type} ضمن ±${windowCandles} شمعة` });
      continue;
    }
    used.add(bestIdx);
    const s = engineMajorSwings[bestIdx];
    matched.push({
      reference: ref,
      engine: { time: s.time, price: s.price, type: s.type, label: s.label ?? null },
      labelMatch: ref.label == null || s.label == null ? null : ref.label === s.label,
      priceDiff: +(s.price - ref.price).toFixed(5),
    });
  }

  const extra = engineMajorSwings.filter((_, idx) => !used.has(idx));
  const labelled = matched.filter((m) => m.labelMatch !== null);

  return {
    referenceCount: referenceSwings.length,
    engineMajorCount: engineMajorSwings.length,
    matched: matched.length,
    missed: missed.length,
    extra: extra.length,
    recall: referenceSwings.length ? +(matched.length / referenceSwings.length).toFixed(4) : null,
    precision: engineMajorSwings.length ? +(matched.length / engineMajorSwings.length).toFixed(4) : null,
    labelAccuracy: labelled.length
      ? +(labelled.filter((m) => m.labelMatch).length / labelled.length).toFixed(4)
      : { value: "INSUFFICIENT_DATA", why: "ما في سوينغات مسمّاة بالطرفين للمقارنة" },
    /* الفائض هو الجواب المباشر على سؤال الكثافة: كم سوينغ «خارجي»
       بيطلّعه المحرك وما بيعتبره المحلّل هيكل. */
    densityRatio: referenceSwings.length ? +(engineMajorSwings.length / referenceSwings.length).toFixed(2) : null,
    details: { matched, missed, extra: extra.slice(0, 50) },
  };
}

function inferBarSeconds(candles) {
  if (!Array.isArray(candles) || candles.length < 3) return null;
  const gaps = [];
  for (let i = 1; i < Math.min(candles.length, 200); i++) {
    const g = candles[i].time - candles[i - 1].time;
    if (g > 0) gaps.push(g);
  }
  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)]; // الوسيط بيتجاهل فجوات العطل
}
