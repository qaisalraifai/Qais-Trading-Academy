import test from "node:test";
import assert from "node:assert/strict";
import { symbolReadiness, pickRepresentative, radarRow } from "./symbol-readiness.js";

/* ============================================================================
   ⚠️ الغرض الأول من هالملف: **يمنع رجوع الأرقام المخترعة**.

   `decision.js` كانت بتطلّع `score` و`radarScore` و`aiConfidence` — مجاميع
   موزونة ثابتة مكتوبة بالكود، ما إلها علاقة بأي نموذج. الاختبار الأخير تحت
   بيفشل لو رجع أي واحد منهن للمخرج.
   ============================================================================ */

const row = (id, state) => ({ id, label: id, detail: "", state, note: null });

const mkSetup = (blockId, direction, { ok = false, blockedAt = null, met = 5 } = {}) => ({
  blockId,
  direction,
  levels: { mt: 100 },
  setup: ok
    ? { ok: true, entry: 110, stop: 105, risk: 5, targets: [{ key: "TP1", price: 130 }], rr: [{ key: "TP1", price: 130, r: 4 }] }
    : { ok: false, blockedAt, reason: `واقفة عند ${blockedAt}` },
  readiness: {
    rows: [
      ...Array.from({ length: met }, (_, i) => row(`R${i + 1}`, "met")),
      ...(ok ? [] : [row("R8", "pending")]),
    ],
    status: ok ? "trade" : "waiting",
    headline: ok ? "شراء" : "بانتظار الثلث",
    metCount: met,
    totalCount: met + (ok ? 0 : 1),
  },
});

test("الصفقة المكتملة بتسبق كل الكتل مهما كان ترتيبها", () => {
  const setups = [
    mkSetup("B1", "up", { blockedAt: "third" }),
    mkSetup("B2", "down", { ok: true, met: 10 }),
    mkSetup("B3", "up", { blockedAt: "cisd" }),
  ];
  assert.equal(pickRepresentative(setups).blockId, "B2");
});

test("بلا صفقة: بتنختار اللي وصلت أبعد مرحلة بالسلسلة", () => {
  const setups = [
    mkSetup("B1", "up", { blockedAt: "third" }),
    mkSetup("B2", "up", { blockedAt: "cisd" }),
    mkSetup("B3", "up", { blockedAt: "smt" }),
  ];
  assert.equal(pickRepresentative(setups).blockId, "B2");
});

test("الإشارة BUY/SELL بتطلع بس مع سلسلة مكتملة — بلاها WAIT", () => {
  const waiting = symbolReadiness({ ok: true, setups: [mkSetup("B1", "up", { blockedAt: "smt" })] });
  assert.equal(waiting.signal, "WAIT");
  assert.equal(waiting.tradeValid, false);
  assert.equal(waiting.entry, null, "بلا صفقة ما في دخول");
  assert.equal(waiting.stopLoss, null);
  assert.equal(waiting.waitingFor, "R8");

  const ready = symbolReadiness({ ok: true, setups: [mkSetup("B1", "down", { ok: true, met: 10 })] });
  assert.equal(ready.signal, "SELL");
  assert.equal(ready.tradeValid, true);
  assert.equal(ready.entry, 110);
  assert.equal(ready.stopLoss, 105);
  assert.equal(ready.riskReward, 4);
});

test("نقص البيانات بيرجّع null مش صفر — «ما انقاس» غير «ولا شرط تحقق»", () => {
  const r = symbolReadiness({ ok: false, why: "شموع h4 أقل من 60" });
  assert.equal(r.available, false);
  assert.equal(r.metCount, null, "صفر بيقول إنه فُحص وطلع صفر — والحقيقة ما انفحص");
  assert.equal(r.totalCount, null);
  assert.equal(r.entryStatus, "Unavailable");
  assert.match(r.why, /شموع h4/);
});

test("ما في كتلة حيّة = غير متاح، مش WAIT بصفر شروط", () => {
  const r = symbolReadiness({ ok: true, setups: [] });
  assert.equal(r.available, false);
  assert.equal(r.metCount, null);
});

test("صف الرادار: أعمدة النِسَب بتنكتب null، والأسباب صارت معرّفات قواعد", () => {
  const analysis = {
    symbol: "NAS100",
    direction: "down",
    price: 30000,
    timeframe: "daily",
    tradeValid: false,
    signal: "WAIT",
    entryStatus: "Waiting",
    session: "London",
    sessionLabel: "London",
    riskReward: null,
    readiness: {
      rows: [row("R3", "met"), row("R4", "met"), row("R8", "pending")],
      metCount: 2,
      totalCount: 3,
      waitingFor: "الثلث",
    },
  };
  const rr = radarRow(analysis);

  /* ⚠️ الجوهر: ولا رقم مخترع بينكتب بقاعدة البيانات. */
  assert.equal(rr.score, null);
  assert.equal(rr.radar_score, null);
  assert.equal(rr.radar_signal_strength, null);
  /* الأعمدة اللي مصدرها انشال بتنكتب null صراحةً — ما بتضل قيمة قديمة معلّقة. */
  for (const k of ["htf_trend", "market_structure", "bos_status", "choch_status", "fvg_status", "liquidity_status", "premium_discount"]) {
    assert.equal(rr[k], null, `${k} لازم ينكتب null بعد ما انشال مصدره`);
  }
  assert.deepEqual(rr.reason_tags, ["R3", "R4"], "الأسباب = القواعد المتحققة فعلاً");
  assert.equal(rr.radar_status, "neutral");
  assert.equal(rr.why, "بانتظار الثلث");
});

test("⚠️ حارس: ما في حقل نسبة/ثقة راجع للمخرج", () => {
  const r = symbolReadiness({ ok: true, setups: [mkSetup("B1", "up", { ok: true, met: 10 })] });
  const banned = [
    "score", "qualityScore", "confidence", "radarScore", "radarConfidence",
    "aiConfidence", "radarStrength", "radarStatus", "radarSignalLabel",
  ];
  for (const k of banned) {
    assert.equal(k in r, false, `الحقل «${k}» رجع للمخرج — هاد رقم مخترع من decision.js المشال`);
  }
  /* العدّاد مسموح — لأنه عدّ، مش نسبة. */
  assert.equal(r.metCount, 10);
  assert.equal(r.totalCount, 10);
});
