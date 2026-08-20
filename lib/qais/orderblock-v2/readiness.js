/* ============================================================================
   lib/qais/orderblock-v2/readiness.js
   خريطة جاهزية الكتلة — بديل «الإشارة والنسبة».

   ---------------------------------------------------------------------------
   ⚠️ ليش انبنت: الواجهة كانت بتعرض `WAIT` و`75%` و`radarScore`.

   الرقمان الأخيران من `decision.js` — **مجموع موزون ثابت** مكتوب بالكود،
   مش ثقة نموذج ولا في أي تكامل LLM بالمشروع. طالب بيشوف «٧٥٪» بيفهم إنه
   في نموذج قدّر احتمالاً. ما في. الرقم بيوهم بدقة مش موجودة.

   البديل مش رقم أنضف — هو **خريطة**: كل شرط من قواعد المنهجية، حالته،
   والمسافة للي بعده لما تكون قابلة للقياس. الطالب بيتعلّم **ليش** الكتلة
   مش جاهزة، مش إنها «٧٥٪».

   ⚠️ كل حقل هون بيرجع لقاعدة إلها رقم واسم بالمرجع البشري.
   ---------------------------------------------------------------------------
   ما في حقل واحد مشتقّ من ترجيح أو تقدير. لو إشي مش قابل للقياس، بيطلع
   `INSUFFICIENT_DATA` مع سبب — مش صفر ولا نسبة.

   ⚠️ الترتيب مقصود: هو ترتيب المنهجية نفسها.
   ---------------------------------------------------------------------------
   شروط التكوّن أولاً (R3–R7)، وبعدها شروط الدخول بالترتيب اللي نطقه صاحب
   المنهجية: الثلث → SMT → CISD → الأهداف. الطالب بيقرا السطور من فوق
   لتحت فبيشوف نفس تسلسل القرار.
   ============================================================================ */

/** الشروط بالترتيب، مع اسم مقروء ومرجعها بالمنهجية. */
export const CONDITIONS = [
  { id: "R3", label: "حدود الكتلة", detail: "آخر شموع معاكسة قبل الحركة" },
  { id: "R4", label: "وضوح الأجسام", detail: "جسم الكتلة أكبر من ذيولها" },
  { id: "R6", label: "الاكتمال", detail: "السعر سكّر خلف مستوى Open" },
  { id: "R1", label: "الزخم", detail: "أول حدث هيكل بنفس اتجاه الكتلة" },
  { id: "R7", label: "الاتجاه", detail: "الكتلة مع الاتجاه وقت العودة" },
  { id: "R5", label: "ما انكسرت", detail: "ما سكّر السعر خلف الذيل الطرفي" },
  { id: "R8", label: "الثلث", detail: "السعر رجعلها وهو تحت ⅓ الساق" },
  { id: "R10", label: "SMT", detail: "كنس سيولة والمترابط ما كنس" },
  { id: "R9", label: "CISD", detail: "كسر آخر سلسلة معاكسة على الفريم الأصغر" },
  { id: "R12", label: "الأهداف", detail: "أكبر سيكونز باتجاه الصفقة" },
];

const MET = "met";           // تحقق
const PENDING = "pending";   // لسا — والسبب مذكور
const UNKNOWN = "unknown";   // ما انقاس — بيانات ناقصة

/**
 * خريطة الشروط لكتلة واحدة، من ناتج `buildTradeSetup`.
 *
 * @param block كتلة من analyzeOrderBlocksSK
 * @param setup ناتج buildTradeSetup لنفس الكتلة
 * @param price السعر الحالي — للمسافة للثلث
 */
export function blockReadiness(block, setup, price = null) {
  const at = (id, state, note = null, distance = null) => ({
    ...CONDITIONS.find((c) => c.id === id),
    state, note, distance,
  });

  const rows = [];

  /* ── شروط التكوّن: الكتلة موجودة يعني تحققت كلها ────────────────
     `analyzeOrderBlocksSK` ما بتطلّع كتلة إلا بعد ما تمرّ R3·R4·R6·R1·R5.
     فوجودها **هو** الدليل — مش ادعاء منفصل. */
  rows.push(at("R3", MET, `${block.candleCount} شمعة ${block.direction === "up" ? "هابطة" : "صاعدة"}`));
  rows.push(at("R4", MET, `جسم ${(block.blockBodyRatio * 100).toFixed(0)}% من المدى`));
  rows.push(at("R6", MET, block.rules?.R6 ?? null));
  rows.push(at("R1", MET, block.rules?.R1 ?? null));
  rows.push(at("R7", MET, "مُحقَّق تلقائياً — الحدث بنفس اتجاه الكتلة"));

  /* R5 دورة حياة: بتضل متحققة لحد ما تنكسر. */
  rows.push(
    block.invalidIndex === -1
      ? at("R5", MET, `الحد ${block.levels.outerWick.toFixed(2)}`)
      : at("R5", PENDING, "انكسرت — الكتلة ما عادت صالحة")
  );

  /* ── شروط الدخول ──────────────────────────────────────────────── */
  const blockedAt = setup?.blockedAt ?? null;
  const insufficient = setup?.value === "INSUFFICIENT_DATA";

  if (insufficient) {
    /* ⚠️ نقص البيانات مش «لسا» — الفرق مهم للطالب: وحدة بتتغيّر بالوقت
       والتانية بتتغيّر بالبيانات. */
    const stage = blockedAt ?? "?";
    for (const id of ["R8", "R10", "R9", "R12"]) {
      const map = { third: "R8", smt: "R10", cisd: "R9" };
      const reached = Object.values(map).indexOf(map[stage]) >= 0;
      rows.push(at(id, id === map[stage] ? UNKNOWN : (reached ? UNKNOWN : UNKNOWN), setup.why));
    }
    /* ⚠️ العدّاد بينرجع هون كمان — بدونه المستهلك بيشوف `undefined`
       وبيعرضه صفراً، فبتصير الكتلة تبان «ما تحقق فيها ولا شرط» بينما
       شروط تكوّنها كلها متحققة. */
    return {
      rows, status: "unknown", headline: "غير قابل للتقييم", why: setup.why,
      metCount: rows.filter((r) => r.state === MET).length,
      totalCount: rows.length,
    };
  }

  const order = ["third", "smt", "cisd"];
  const idOf = { third: "R8", smt: "R10", cisd: "R9" };
  const stopIdx = blockedAt ? order.indexOf(blockedAt) : order.length;

  order.forEach((stage, i) => {
    const id = idOf[stage];
    if (stopIdx === -1 || i < stopIdx) {
      /* اللي قبل نقطة التوقّف تحقق فعلاً. */
      const note =
        stage === "third" ? setup?.chain?.touch?.thirds?.map((t) => `${t.timeframe} ${t.threshold.toFixed(0)}`).join(" · ")
        : stage === "smt" ? setup?.chain?.smt?.reason
        : setup?.chain?.cisd?.reason;
      rows.push(at(id, MET, note ?? null));
    } else if (i === stopIdx) {
      /* نقطة التوقّف — مع المسافة لو قابلة للقياس. */
      let distance = null;
      if (stage === "third" && price != null) {
        const th = setup?.thirds?.[0]?.threshold ?? null;
        if (th != null) distance = { to: th, points: +(Math.abs(price - th)).toFixed(2) };
      }
      rows.push(at(id, PENDING, setup?.reason ?? null, distance));
    } else {
      rows.push(at(id, PENDING, "بانتظار اللي قبله"));
    }
  });

  /* الأهداف: موجودة أو `null` بسبب صريح — ما في أهداف مخترعة. */
  if (setup?.ok) {
    rows.push(
      setup.targets
        ? at("R12", MET, `${setup.targets.length} أهداف · ${setup.rr?.map((t) => `${t.r}R`).join(" · ") ?? ""}`)
        : at("R12", PENDING, `السيكونز ${setup.targetsStage ?? "ما اكتملت"}`)
    );
  } else {
    rows.push(at("R12", PENDING, "بانتظار اكتمال الدخول"));
  }

  const pending = rows.find((r) => r.state === PENDING);
  return {
    rows,
    status: setup?.ok ? "trade" : "waiting",
    headline: setup?.ok
      ? (setup.side ?? "صفقة")
      : pending ? `بانتظار ${pending.label}` : "بانتظار",
    why: setup?.ok ? setup.reason : pending?.note ?? null,
    /* عدّاد صادق: كم شرط تحقق من كم — مش نسبة مرجّحة. */
    metCount: rows.filter((r) => r.state === MET).length,
    totalCount: rows.length,
  };
}
