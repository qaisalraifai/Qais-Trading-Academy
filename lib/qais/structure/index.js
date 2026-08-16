/* ============================================================================
   lib/qais/structure/index.js
   Structure Engine v2 — نقطة الدخول الوحيدة.

   محرك **مستقل**: بياخد شموع ويرجّع بيانات مبنيّة. ما بيستورد شي من الواجهة
   ولا من باقي طبقات QAIS، فهو قابل للاختبار لحاله (شرط المرحلة ١).

   المخرج:
     internalSwings[]  كل البيفوتات — الحركة الداخلية
     majorSwings[]     الهيكل الخارجي، مسمّى HH/HL/LH/LL
     events[]          BOS · MSS
     wickBreaks[]      تجاوز بالذيل بدون إغلاق (مادة الـSweep لاحقاً)
     displacements[]   الشموع المصنّفة Strong فما فوق
     state             حالة الهيكل + سببها
     meta              الإعدادات الفعلية + تغطية البيانات

   كل عنصر بيحمل: time · price · timeframe · type · direction · strength ·
   المرجع (شمعة/سوينغ) · reason · confidence (لما تكون محسوبة من بيانات
   حقيقية — وإلا null، مش رقم مخترع).
   ============================================================================ */

import { atrSeries } from "./atr.js";
import { detectFractalPivots, alternate, buildMajorSwings, labelSwings, trendFromLabels } from "./swings.js";
import { classifyDisplacement, atLeast } from "./displacement.js";
import { detectEvents } from "./events.js";

export const DEFAULTS = {
  lookback: 2, // فراكتال الحركة الداخلية
  atrPeriod: 14,
  /* ============================================================================
     عتبة دلالة الساق الخارجية — مُعايَرة على ٣ أدلة مستقلة، مش على عيّنة وحدة:

     ١) المرجع البشري (١١ سوينغ، NAS100 H4): الاستدعاء ثابت 0.909 من ١.٥
        لـ٣.٠، وبينزل لـ0.727 عند ٣.٥. والدقة بتتضاعف ٠.٣٢ ← ٠.٥٠.
     ٢) توافق مع هيكل D1 على NAS100 (١٠٨ بيفوت، بلا أي تسمية بشرية):
        التغطية ~٩٠٪ لحد ٣.٠، وبتنهار بعدها (٧٦٪ عند ٣.٥، ٦٠٪ عند ٤).
     ٣) نفس الفحص على EURUSD (٩٢ بيفوت): ٩٤.٦٪ عند ٣.٠ ثم ٨٥.٩٪ فـ٦٩.٦٪.

     ثلاثتهم بيأشروا على نفس الركبة. والاختيار وقع على **طرف هضبة مسطّحة**
     مش على قمة — وهاد أمتن إحصائياً من تعيير على ذروة.

     (XAUUSD مستثنى: شموع H4 وD1 تبعه متناقضة داخلياً — بيانات يوهو GC=F
     بتخدم عقود شهور مختلفة للحظي واليومي. عيب بطبقة البيانات، مش هون.)

     عند ٣.٠ المحرك بيطلّع الـMSS اللي سمّاه المحلّل بنفس الوقت وبنفس
     المستوى بالضبط — وعند ١.٥ الحدث ما كان موجود إطلاقاً.
     ============================================================================ */
  majorAtrMult: 3.0,
  majorMinLegBars: 3,
  fakeBreakBars: 3,
  minCandles: 30,
};

/**
 * @param {Array} candles  [{time, open, high, low, close, volume?}] تصاعدياً
 * @param {Object} options  { timeframe, ...DEFAULTS }
 */
export function analyzeStructureV2(candles, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const timeframe = options.timeframe ?? null;

  const empty = (reason) => ({
    ok: false,
    reason,
    timeframe,
    internalSwings: [],
    majorSwings: [],
    events: [],
    wickBreaks: [],
    displacements: [],
    state: { state: "INSUFFICIENT_DATA", trend: null, reason, confidence: null },
    meta: { config: cfg, candleCount: Array.isArray(candles) ? candles.length : 0 },
  });

  if (!Array.isArray(candles) || candles.length < cfg.minCandles) {
    return empty(`عدد الشموع (${Array.isArray(candles) ? candles.length : 0}) أقل من الحد الأدنى ${cfg.minCandles}`);
  }

  const atr = atrSeries(candles, cfg.atrPeriod);

  // -------- ١) المقياس الداخلي --------
  const rawPivots = detectFractalPivots(candles, cfg.lookback);
  const internalAlt = alternate(rawPivots);
  const internalSwings = labelSwings(internalAlt).map((s) => ({ ...s, scale: "internal", timeframe }));

  // -------- ٢) المقياس الخارجي --------
  const majorsRaw = buildMajorSwings(candles, internalAlt, {
    atrPeriod: cfg.atrPeriod,
    atrMult: cfg.majorAtrMult,
    minLegBars: cfg.majorMinLegBars,
    lookback: cfg.lookback,
  });
  /* الطرف الحالي غير المؤكَّد — بينعرض للمعلومة بس، وما بيدخل كشف الأحداث
     لأنه لسا ممكن يمتد ويتغيّر. */
  const provisionalSwing = majorsRaw.provisional ? { ...majorsRaw.provisional, scale: "provisional", timeframe } : null;
  const majorSwings = labelSwings(majorsRaw).map((s, idx, arr) => ({
    ...s,
    scale: "major",
    timeframe,
    /* طول الساق الواصلة لهاد السوينغ — بتُستخدم كدليل «دلالة المستوى»
       بحساب ثقة الأحداث. أول سوينغ ما إله ساق سابقة. */
    legLength: idx > 0 ? Math.abs(s.price - arr[idx - 1].price) : null,
    reason:
      idx > 0
        ? `ساق ${Math.abs(s.price - arr[idx - 1].price).toFixed(2)} من السوينغ السابق — تجاوزت عتبة ${cfg.majorAtrMult}× ATR`
        : "أول سوينغ خارجي بالنطاق",
  }));

  // -------- ٣) الأحداث --------
  const { events, wickBreaks } = detectEvents(candles, majorSwings, {
    timeframe,
    lookback: cfg.lookback,
    fakeBreakBars: cfg.fakeBreakBars,
    atrPeriod: cfg.atrPeriod,
  });

  // -------- ٤) الزخم المعتبر --------
  const displacements = [];
  for (let i = 0; i < candles.length; i++) {
    const d = classifyDisplacement(candles, i, { atrPeriod: cfg.atrPeriod, precomputedAtr: atr });
    if (d && atLeast(d.level, "Strong")) {
      displacements.push({
        index: i,
        time: candles[i].time,
        price: candles[i].close,
        timeframe,
        type: "Displacement",
        direction: d.direction,
        strength: d.level,
        reason: d.reason,
        confidence: d.confidence,
        factors: d.factors,
      });
    }
  }

  // -------- ٥) حالة الهيكل --------
  const state = deriveState(majorSwings, events, candles);

  return {
    ok: true,
    reason: null,
    timeframe,
    internalSwings,
    majorSwings,
    provisionalSwing,
    events,
    wickBreaks,
    displacements,
    state,
    meta: {
      config: cfg,
      candleCount: candles.length,
      firstTime: candles[0]?.time ?? null,
      lastTime: candles[candles.length - 1]?.time ?? null,
      counts: {
        internalSwings: internalSwings.length,
        majorSwings: majorSwings.length,
        bos: events.filter((e) => e.type === "BOS").length,
        mss: events.filter((e) => e.type === "MSS").length,
        fakeBreaks: events.filter((e) => e.fakeBreak).length,
        wickBreaks: wickBreaks.length,
        displacements: displacements.length,
      },
    },
  };
}

/**
 * حالة الهيكل من التسميات + آخر حدث.
 * مقصورة على ما يمكن استنتاجه **من الهيكل وحده** — تصنيفات التجميع/التوزيع
 * (Accumulation/Distribution) بتحتاج سيولة وحجم، فمكانها طبقة لاحقة.
 * ما منطلّع حالة ما عنا دليل إلها.
 */
function deriveState(majorSwings, events, candles) {
  const last = events[events.length - 1] || null;
  const lastPrice = candles[candles.length - 1]?.close ?? null;
  const labelRead = trendFromLabels(majorSwings);

  const lastEvent = last
    ? { id: last.id, type: last.type, direction: last.direction, time: last.time, price: last.price }
    : null;

  /* ============================================================================
     الاتجاه من **الأحداث**، مش من تسميات السوينغات.
     ----------------------------------------------------------------------------
     كان المحرك عنده مفهومان مستقلان للاتجاه: واحد داخل detectEvents بينقلب
     عند الـMSS (صح)، وواحد بينشر للخارج من trendFromLabels ما بيعرف عن
     الأحداث شي. مُعاد إنتاجه:

         أحداث : BOS:up@32 · BOS:up@60 · MSS:down@73
         state.trend = "up"                     ← بنفس اللحظة اللي انقلب فيها

     السبب: الـHL الحامي اللي انكسر بيضل بالتسميات، فقراءة HH/HL بتضل
     صاعدة بعد ما الهيكل انقلب فعلياً. والحقل المنشور هو اللي بتقراه
     الطبقات اللي فوق.

     القاعدة: BOS بيأكد الاستمرار باتجاهه، وMSS بيقلب للاتجاه الجديد —
     فبالحالتين اتجاه الهيكل = اتجاه آخر حدث. قراءة التسميات بتضل معروضة
     كدليل مساند بالـreason، وبتنكشف صراحةً لما تخالف.
     ============================================================================ */
  const trend = last ? last.direction : null;

  /* ============================================================================
     أحداث حقيقية ما بتنبلع لما التسلسل ما يكتمل.
     ----------------------------------------------------------------------------
     كان في خروج مبكّر عند `majorSwings.length < 4` بيرجّع INSUFFICIENT_DATA
     **بدون lastEvent ولا lastPrice** — فحدث MSS بثقة ٠.٨ بينختفي من الحالة
     كلياً. نفس صنف الحارس اللي كان يبلع كل الأحداث عند `majors.length < 2`.

     التسلسل الناقص بيمنع ادعاء **نمط** الهيكل (HH/HL مقابل LH/LL)، بس ما
     بيلغي وجود الأحداث ولا اتجاهها.
     ============================================================================ */
  const sequenceEstablished = majorSwings.length >= 4;

  let state;
  if (!last) {
    state = "INSUFFICIENT_DATA";
  } else if (last.type === "MSS") {
    state = "TRANSITION"; // الاتجاه انقلب توّه
  } else if (labelRead.trend === "range" && sequenceEstablished) {
    state = "RANGE";
  } else if (last.type === "BOS") {
    state = "EXPANSION"; // BOS = استمرار مؤكَّد باتجاهه
  } else {
    state = "CORRECTION";
  }

  const bits = [];
  if (last) bits.push(`آخر حدث ${last.type} ${last.direction} عند ${last.price?.toFixed?.(2) ?? last.price}`);
  else bits.push("ما في أي حدث هيكلي مؤكَّد بعد");
  if (sequenceEstablished) bits.push(labelRead.reason);
  else bits.push(`السوينغات الخارجية (${majorSwings.length}) أقل من ٤ — نمط التسلسل غير مثبت بعد`);
  if (trend && labelRead.trend && labelRead.trend !== "range" && labelRead.trend !== trend) {
    bits.push(`⚠ قراءة التسميات (${labelRead.trend}) بتخالف اتجاه آخر حدث — طبيعي بعد MSS مباشرة`);
  }

  return {
    state,
    trend,
    /* قراءة التسميات معروضة كدليل مساند مستقل — مفيدة للتشخيص، وما
       بتنشر كاتجاه معتمد. */
    labelTrend: labelRead.trend === "range" ? null : labelRead.trend,
    sequenceEstablished,
    lastEvent,
    lastPrice,
    reason: bits.join(" · "),
    /* ثقة الحالة = ثقة آخر حدث (هو الدليل اللي بنت عليه). بدون حدث ما في
       رقم — null مش صفر ومش تقدير. */
    confidence: last?.confidence ?? null,
  };
}
