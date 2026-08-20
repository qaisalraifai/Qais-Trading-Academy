/* اختبارات خريطة الجاهزية — بديل «الإشارة والنسبة».

   ⚠️ الغاية: كل حقل بيرجع لقاعدة إلها اسم ورقم. أي رقم مرجّح أو مجمّع
   بيكون كذبة مغلّفة — والاختبارات هون بتحرس هالمبدأ.
*/

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeStructureV2 } from "../structure/index.js";
import { analyzeOrderBlocksSK } from "./rules-sk.js";
import { buildTradeSetup } from "./trade-setup.js";
import { blockReadiness, CONDITIONS } from "./readiness.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const F = (n) => JSON.parse(fs.readFileSync(path.join(HERE, "verify/fixtures", n), "utf8")).candles;
const H4 = F("nas100-h4-2026-context.json"), D1 = F("nas100-d1-2024-2026.json");
const M15 = F("nas100-m15-2026-07-entry.json"), M5 = F("nas100-m5-2026-07-entry.json");
const SPX = F("spx500-m15-2026-07-entry.json");

const ST = analyzeStructureV2(H4, { timeframe: "h4" });
const STD = analyzeStructureV2(D1, { timeframe: "daily" });
const alignD = (t) => { let lo = 0, hi = D1.length - 1, b = 0; while (lo <= hi) { const m = (lo + hi) >> 1; if (D1[m].time <= t) { b = m; lo = m + 1; } else hi = m - 1; } return b; };
const CTX = {
  candles: H4, structure: ST,
  thirdContextFor: (i) => [
    { timeframe: "h4", majorSwings: ST.majorSwings, asOfIndex: i },
    { timeframe: "daily", majorSwings: STD.majorSwings, asOfIndex: alignD(H4[i].time) },
  ],
  lower: { candles: M15, timeframe: "m15" },
  correlateLower: { candles: SPX },
  cisdFrame: { candles: M5, timeframe: "m5" },
  structureOf: (c) => analyzeStructureV2(c, { timeframe: "m15" }),
};
const BLOCKS = analyzeOrderBlocksSK(H4, { timeframe: "h4", structure: ST }).blocks;
/* ⚠️ كل الكتل الحيّة — مش أول ١٢. كتلة صاحب المنهجية المتحقَّقة رقم ١٣،
   وقصّها كان نفس العطل اللي انصلح بالمُهايئ. */
const LIVE = BLOCKS.filter((b) => b.invalidIndex === -1);
const PRICE = H4[H4.length - 1].close;
const MAPS = LIVE.map((b) => ({ b, s: buildTradeSetup(b, CTX), }))
  .map((x) => ({ ...x, r: blockReadiness(x.b, x.s, PRICE) }));

test("كل كتلة بتطلّع خريطة كاملة", () => {
  assert.ok(MAPS.length > 5, `شرط مسبق: ${MAPS.length} كتلة بس`);
  for (const { r } of MAPS) {
    assert.equal(r.rows.length, CONDITIONS.length, "عدد الشروط مش كامل");
    assert.ok(["trade", "waiting", "unknown"].includes(r.status), `حالة غير معروفة: ${r.status}`);
    assert.ok(r.headline, "بلا عنوان");
  }
});

test("كل سطر مربوط بقاعدة إلها رقم واسم", () => {
  const ids = new Set(CONDITIONS.map((c) => c.id));
  for (const { r } of MAPS) {
    for (const row of r.rows) {
      assert.ok(ids.has(row.id), `سطر بمعرّف مش من القواعد: ${row.id}`);
      assert.ok(row.label && row.detail, `${row.id}: بلا اسم أو شرح`);
      assert.ok(["met", "pending", "unknown"].includes(row.state), `${row.id}: حالة غير معروفة`);
    }
    /* وما في تكرار — كل قاعدة مرة وحدة. */
    const seen = r.rows.map((x) => x.id);
    assert.equal(new Set(seen).size, seen.length, "قاعدة متكررة بالخريطة");
  }
});

test("⚠️ ما في نسبة ولا سكور ولا ثقة", () => {
  /* الحارس الأهم: أي حقل رقمي مجمّع بيرجع «دقة» مخترعة. */
  const banned = /confidence|score|probability|نسبة|ثقة|احتمال/i;
  for (const { r } of MAPS) {
    for (const k of Object.keys(r)) {
      assert.ok(!banned.test(k), `حقل ممنوع بالخريطة: ${k}`);
    }
    /* `metCount` عدّاد صادق — بس ما بينحوّل لنسبة جوّا الوحدة. */
    assert.equal(typeof r.metCount, "number");
    assert.equal(typeof r.totalCount, "number");
    assert.ok(r.metCount <= r.totalCount);
  }
  const src = fs.readFileSync(path.join(HERE, "readiness.js"), "utf8");
  assert.ok(!/\*\s*0\.\d+|weight|وزن/i.test(src.split("export function")[1] || ""),
    "في ترجيح جوّا حساب الخريطة");
});

test("الصفقة الجاهزة: كل الشروط متحققة إلا الأهداف ممكن", () => {
  const trades = MAPS.filter((x) => x.r.status === "trade");
  assert.ok(trades.length > 0, "شرط مسبق: في صفقة وحدة على الأقل");
  for (const { r } of trades) {
    const pending = r.rows.filter((x) => x.state !== "met");
    /* الوحيد المسموح يضل معلّقاً بصفقة جاهزة هو الأهداف — لأنه السيكونز
       ممكن ما تكون اكتملت، والصفقة صالحة بدونها. */
    for (const p of pending) {
      assert.equal(p.id, "R12", `صفقة جاهزة وفيها ${p.id} مش متحقق`);
    }
  }
});

test("الكتلة المنتظرة: أول شرط معلّق هو العنوان", () => {
  const waits = MAPS.filter((x) => x.r.status === "waiting");
  assert.ok(waits.length > 0, "شرط مسبق: في كتلة منتظرة");
  for (const { r } of waits) {
    const first = r.rows.find((x) => x.state === "pending");
    assert.ok(first, "منتظرة وما في شرط معلّق");
    assert.match(r.headline, new RegExp(first.label), `العنوان «${r.headline}» مش أول شرط معلّق «${first.label}»`);
  }
});

test("شروط التكوّن متحققة دايماً — وجود الكتلة هو الدليل", () => {
  /* `analyzeOrderBlocksSK` ما بتطلّع كتلة إلا بعد R3·R4·R6·R1. */
  for (const { r } of MAPS) {
    for (const id of ["R3", "R4", "R6", "R1", "R7"]) {
      const row = r.rows.find((x) => x.id === id);
      assert.equal(row.state, "met", `${id} مش متحقق مع إنه الكتلة موجودة`);
    }
  }
});
