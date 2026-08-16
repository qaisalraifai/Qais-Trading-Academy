/* ============================================================================
   lib/qais/liquidity-v2/equal-levels.js
   القمم المتساوية / القيعان المتساوية — سبب وجود طبقة السيولة أصلاً.

   ليش بدها كاشف مستقل:
   ---------------------------------------------------------------------------
   ١) كاشف الفراكتال بمحرك الهيكل بيرفض التعادل صراحةً (`>=` بشرط الجوار)،
      فالقمة اللي جارها بنفس السعر بالضبط **ما بتنكشف كبيفوت** — والقمم
      المتساوية هي بالتحديد الشكل اللي بيولّد أكبر تجمّع سيولة.
   ٢) على بيانات CFD حقيقية التساوي الحرفي شبه مستحيل: القياس على الذهب طلّع
      **قمة متساوية وحدة بـ٢٧٢٧ شمعة H4**. أي كاشف بيشترط `a === b` بيرجّع
      صفر ويبان إنه «ما في ظاهرة» — والظاهرة موجودة، بس بفرق تِك أو تِكّين.

   لهيك: نطاق تسامح **بوحدة ATR** عند لحظة السوينغ الأحدث، لا مبلغ سعري ثابت.

   الغلط اللي انرفض صراحةً:
   ---------------------------------------------------------------------------
   • `verify/edge-cases.js` بيقارن `candles[i].high` بـ`candles[i-1].high` —
     يعني شمعتين **متجاورتين**. هاي مش قمم متساوية بالمعنى السيولي إطلاقاً؛
     هاي شمعتين بنفس السقف جوّا نفس الحركة. القمم المتساوية = **سوينغين**
     بنفس السعر بينهم مسافة شموع، وبينهم تصحيح. الكاشف هون بيشتغل على
     السوينغات مش على الشموع المتجاورة، وبيفرض حد أدنى للمسافة.
   • المقارنة مع **متوسط متحرك** للعنقود بتخلّي العنقود «يزحف»: كل عضو جديد
     بيحرّك المتوسط شوي فبيصير آخر عضو بعيد كتير عن الأول. لهيك المقارنة
     دايماً مع **سعر المرساة** (أول عضو) — الانحراف بيضل محدود بالتسامح مهما
     زاد عدد الأعضاء.
   ============================================================================ */

import { atrBandAt } from "./atr-causal.js";
import { insufficient, makePool, meanOfAvailable, strengthFromTouchCount } from "./pool.js";

export const EQUAL_DEFAULTS = {
  /* عرض النطاق اللي جوّاه سوينغين بينعدّوا «متساويين».
     ٠.١٠× ATR = عُشر تقلب الشمعة النموذجي. **مش معيَّر على مرجع بشري** —
     ما في تسميات بشرية لقمم متساوية بالمشروع لحد الآن. الرقم المقيس (الفرق
     الفعلي وعرض النطاق) بينحفظ بالمخرج حتى أي معايرة لاحقة تعيد التصنيف. */
  /* ============================================================================
     عرض نطاق «التساوي» بوحدة ATR — قرار مُتّخذ على دليل، مش قيمة افتراضية.
     ----------------------------------------------------------------------------
     ما في مرجع بشري لهالمفهوم، فجرّبنا ٣ معايير موضوعية على ناسداك واليورو
     (٩٠٠ و٨٣١ شمعة H4):

     ١) **نسبة القطف** مقابل السوينغ العادي — ما ميّزت إطلاقاً:
            متساوية ٨١٪ مقابل سوينغ ٨٣٪ (ناسداك) · ٧٤٪ مقابل ٧٨٪ (يورو)
        السبب سقف: على ٩٠٠ شمعة كل المستويات تقريباً بتنقطف بالنهاية.

     ٢) **سرعة القطف** — ميّزت بقوة: وسيط ٤–١١ شمعة للمتساوية مقابل ٢٩–٣٤
        للسوينغ العادي. فالمفهوم إله محتوى تنبؤي حقيقي.
        بس المعيار **مشوّش**: نطاق أوسع = مستوى أعرض = بينلمس أبكر بالبناء،
        فبيدفع دايماً نحو الأوسع. ما بينفع نختار فيه.

     ٣) **منحنى عدد التجمّعات** — الإشارة الوحيدة غير المشوّشة:
            ناسداك: 0.05→19 · 0.1→32 · 0.15→42 · **0.2→52** · 0.3→48 · 0.4→48
            يورو  : 0.05→21 · 0.1→35 · 0.15→42 · **0.2→45** · 0.3→42 · 0.4→40
        الاتنين بيبلغوا الذروة عند 0.2 وبعدها بينزلوا — والنزول معناه إنه
        التجمّعات المنفصلة بلّشت تندمج ببعضها. هاي الحدّ اللي بعده النطاق
        بيبلع مستويات ما إلها علاقة.

     ⚠️ الدليل هون **أضعف** من عتبة الهيكل (٣.٠) اللي انعيّرت على ٣ أدلة
     مستقلة منها مرجع بشري. هون إشارة وحدة من رمزين. بيتغيّر أول ما يصير
     في تسميات بشرية لبِرك السيولة.
     ============================================================================ */
  tolAtrMult: 0.2,
  /* أقل مسافة شموع بين سوينغين حتى ينعدّوا قمتين منفصلتين. أقل من هيك بيكون
     نفس الذروة موزّعة على شمعتين، مش تجمّع سيولة تاني. */
  minBarsApart: 3,
  /* أقصى مسافة — بعدها المستوى بيصير قديم لدرجة إنه سياقه اختلف.
     null = بلا حد (الانحراف محدود أصلاً بالمرساة). */
  maxBarsApart: null,
  minMembers: 2,
};

/**
 * @param candles  الشموع
 * @param swings   سوينغات (internalSwings أو majorSwings) — لازم تحمل
 *                 {index, time, price, type} و(اختياري) confirmedAtIndex
 * @param options  { atr, lookback, timeframe, ...EQUAL_DEFAULTS }
 */
export function detectEqualLevels(candles, swings, options = {}) {
  const cfg = { ...EQUAL_DEFAULTS, ...options };
  const { atr, lookback = 2, timeframe = null } = options;

  const pools = [];
  const skipped = [];

  if (!Array.isArray(swings) || swings.length < cfg.minMembers) {
    return {
      pools,
      skipped,
      note: insufficient(`عدد السوينغات (${swings?.length ?? 0}) أقل من ${cfg.minMembers} — ما بينبنى ولا عنقود`),
    };
  }
  if (!Array.isArray(atr)) {
    return { pools, skipped, note: insufficient("سلسلة ATR غير ممرَّرة — نطاق التسامح غير قابل للحساب") };
  }

  /* لحظة معرفة السوينغ فعلياً: التأكيد لو موجود (من زجزاج التأكيد بالهيكل)،
     وإلا index + lookback لأن البيفوت الفراكتالي ما بينكشف قبل هيك. */
  const knownAt = (s) => (Number.isFinite(s.confirmedAtIndex) ? s.confirmedAtIndex : s.index + lookback);

  for (const side of ["high", "low"]) {
    const list = swings.filter((s) => s.type === side).sort((a, b) => a.index - b.index);
    const clusters = [];

    for (const s of list) {
      /* التسامح بيتقاس بتقلب **لحظة السوينغ الجديد** — هو اللي عم بينضم هلأ،
         فقراره لازم ينحسم بمعلومات لحظته هو، مش بتقلب آخر الشارت. */
      const band = atrBandAt(atr, s.index, cfg.tolAtrMult);
      if (!band.ok) {
        skipped.push({ index: s.index, time: s.time, price: s.price, type: side, why: band.why });
        continue;
      }

      /* بنختار **أقرب** عنقود سعرياً مش أول عنقود مطابق: لو في عنقودين
         ضمن النطاق، الانتماء للأقرب هو القرار الوحيد اللي ما بيعتمد على
         ترتيب الإنشاء — وبالتالي حتمي. */
      let best = null;
      for (const cl of clusters) {
        if (cl.closed) continue;
        const last = cl.members[cl.members.length - 1];
        const barsApart = s.index - last.index;
        if (barsApart < cfg.minBarsApart) continue; // نفس الذروة موزّعة، مش قمة تانية
        if (cfg.maxBarsApart != null && barsApart > cfg.maxBarsApart) {
          cl.closed = true;
          continue;
        }
        const dist = Math.abs(s.price - cl.anchorPrice);
        if (dist <= band.value && (!best || dist < best.dist)) best = { cl, dist };
      }

      if (best) {
        best.cl.members.push(s);
        best.cl.lastBand = band;
      } else {
        clusters.push({ anchorPrice: s.price, members: [s], closed: false, lastBand: null });
      }
    }

    for (const cl of clusters) {
      if (cl.members.length < cfg.minMembers) continue;

      const last = cl.members[cl.members.length - 1];
      const band = cl.lastBand ?? atrBandAt(atr, last.index, cfg.tolAtrMult);
      if (!band.ok) {
        skipped.push({ index: last.index, time: last.time, price: last.price, type: side, why: band.why });
        continue;
      }

      const prices = cl.members.map((m) => m.price);
      const spread = Math.max(...prices) - Math.min(...prices);
      /* مستوى البركة = الطرف الأبعد بين الأعضاء. الستوبات مركونة **فوق**
         أعلى قمة (أو تحت أوطى قاع) — مش عند المتوسط. */
      const level = side === "high" ? Math.max(...prices) : Math.min(...prices);

      /* البركة ما بتصير معروفة إلا لما آخر عضو يتأكد كسوينغ. */
      const availableFromIndex = Math.max(...cl.members.map(knownAt));
      if (availableFromIndex >= candles.length) {
        skipped.push({
          index: last.index,
          time: last.time,
          price: level,
          type: side,
          why: "آخر عضو بالعنقود ما تأكد كسوينغ ضمن البيانات المتوفرة",
        });
        continue;
      }

      const tightness = band.value > 0 ? Math.max(0, 1 - spread / band.value) : null;
      const countFactor = Math.min(1, (cl.members.length - 1) / 3);
      const confidence = meanOfAvailable([tightness, countFactor]);

      pools.push(
        makePool({
          type: side === "high" ? "EqualHighs" : "EqualLows",
          side: side === "high" ? "buy" : "sell",
          price: level,
          time: last.time,
          index: last.index,
          timeframe,
          availableFromIndex,
          strength: strengthFromTouchCount(cl.members.length),
          measure: {
            members: cl.members.length,
            spread: +spread.toFixed(5),
            tolerance: +band.value.toFixed(5),
            toleranceAtrMult: cfg.tolAtrMult,
            atrAtLastMember: +band.atr.toFixed(5),
            spanBars: last.index - cl.members[0].index,
          },
          source: {
            kind: "swings",
            members: cl.members.map((m) => ({ index: m.index, time: m.time, price: m.price, label: m.label ?? null })),
          },
          reason:
            `${cl.members.length} ${side === "high" ? "قمم" : "قيعان"} ضمن نطاق ${band.value.toFixed(2)} ` +
            `(${cfg.tolAtrMult}× ATR) — الفرق الفعلي ${spread.toFixed(2)} على مدى ${last.index - cl.members[0].index} شمعة`,
          confidence,
        })
      );
    }
  }

  pools.sort((a, b) => a.availableFromIndex - b.availableFromIndex || a.price - b.price);
  return { pools, skipped, note: null };
}
