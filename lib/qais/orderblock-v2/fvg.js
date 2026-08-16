/* ============================================================================
   lib/qais/orderblock-v2/fvg.js
   الفجوة السعرية (FVG) — شرط **إلزامي** لاعتماد كتلة الأوامر.

   التعريف: ثلاث شموع متتالية (i-1, i, i+1) بحيث ما بيتلامس ذيلا الطرفين:
       صاعدة : قاع الشمعة (i+1) أعلى من قمة الشمعة (i-1)
       هابطة : قمة الشمعة (i+1) أدنى من قاع الشمعة (i-1)
   الشمعة الوسطى (i) هي شمعة الاندفاع اللي خلّفت الفجوة.

   ⚠️ الفهرسة هون **على الشمعة الوسطى**، مش على الثالثة.
   ---------------------------------------------------------------------------
   المحرك القديم كان بيفهرس الفجوة على الشمعة الثالثة، وبعدين يفحص وجودها
   بنافذة `[i-1, i+2]` حوالين شمعة الزخم — نافذة عريضة بتقبل فجوات ما إلها
   علاقة بالحركة، وبتضيّع اللي إلها. الفهرسة على الوسطى بتخلّي السؤال
   مباشر: «هل شمعة الزخم هاي نفسها خلّفت فجوة؟» بدون نوافذ تقريبية.

   ⚠️ السببية: الفجوة ما بتنعرف إلا عند إغلاق الشمعة (i+1). فكل فجوة بتحمل
   `confirmedAtIndex = i + 1` — والمستدعي ممنوع يستعملها قبلها.

   ⚠️ الحجم بالـATR مش بمبلغ ثابت: فجوة بنصف نقطة على اليورو حدث، وعلى
   البتكوين ضجيج. العتبة الافتراضية صفر (أي فجوة موجبة بتُعتمد) — القياس
   بيضل مسجّل بـ`sizeAtr` حتى ينفع للتصفية لاحقاً بدل ما ننتقي رقماً بلا دليل.
   ============================================================================ */

import { atrAt } from "../structure/atr.js";

export const FVG_DEFAULTS = {
  /* حد أدنى لحجم الفجوة بوحدة ATR. صفر = أي فجوة موجبة تُعتمد.
     ما في دليل يبرّر رقماً أكبر لحد ما يصير في مرجع بشري — والحجم
     محفوظ بكل فجوة فالتصفية ممكنة بعدين بلا إعادة حساب. */
  minSizeAtrMult: 0,
};

/**
 * كل الفجوات بالسلسلة، مفهرسة على شمعة الاندفاع الوسطى.
 *
 * @param candles شموع مرتبة تصاعدياً
 * @param options { atr, timeframe, ...FVG_DEFAULTS }
 * @returns Array<{ index, time, direction, from, to, size, sizeAtr, confirmedAtIndex, timeframe, reason }>
 */
export function findFVGs(candles, options = {}) {
  const cfg = { ...FVG_DEFAULTS, ...options };
  const { atr = null, timeframe = null } = options;
  const out = [];
  if (!Array.isArray(candles) || candles.length < 3) return out;

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const mid = candles[i];
    const next = candles[i + 1];
    if (!prev || !mid || !next) continue;

    let direction = null;
    let from = null;
    let to = null;

    if (next.low > prev.high) {
      direction = "up";
      from = prev.high;
      to = next.low;
    } else if (next.high < prev.low) {
      direction = "down";
      from = next.high;
      to = prev.low;
    } else {
      continue;
    }

    const size = to - from;
    if (!(size > 0)) continue;

    /* ATR عند شمعة الاندفاع — سببي (atrAt بتمسح للخلف حصراً).
       لو ما في ATR مقيس بعد، الحجم النسبي بيضل null وما منفلتر عليه. */
    const atrHere = atr ? atrAt(atr, i) : null;
    const sizeAtr = Number.isFinite(atrHere) && atrHere > 0 ? size / atrHere : null;

    if (cfg.minSizeAtrMult > 0) {
      if (sizeAtr == null || sizeAtr < cfg.minSizeAtrMult) continue;
    }

    out.push({
      index: i,
      time: mid.time,
      timeframe,
      type: "FVG",
      direction,
      from,
      to,
      size: +size.toFixed(6),
      sizeAtr: sizeAtr == null ? null : +sizeAtr.toFixed(3),
      /* ما بتنعرف إلا لما تسكّر الشمعة اللي بعدها. */
      confirmedAtIndex: i + 1,
      reason:
        `فجوة ${direction === "up" ? "صاعدة" : "هابطة"} بين ${from.toFixed(2)} و${to.toFixed(2)}` +
        (sizeAtr == null ? " (ATR غير مقيس بعد)" : ` — ${sizeAtr.toFixed(2)}× ATR`),
    });
  }

  return out;
}

/** فهرسة سريعة: فهرس شمعة الاندفاع → الفجوة. */
export function indexFVGs(fvgs) {
  const byIndex = new Map();
  for (const f of fvgs) {
    const cur = byIndex.get(f.index);
    // لو صادف اتجاهان بنفس الفهرس (نادر جداً)، بناخد الأكبر
    if (!cur || f.size > cur.size) byIndex.set(f.index, f);
  }
  return byIndex;
}

/**
 * هل خلّفت شمعة الزخم عند `index` فجوة بنفس اتجاهها؟
 * سؤال مباشر بلا نافذة تقريبية — وهاد المقصود بـ«FVG شرط إلزامي».
 */
export function fvgAt(byIndex, index, direction) {
  const f = byIndex.get(index);
  if (!f) return null;
  return f.direction === direction ? f : null;
}
