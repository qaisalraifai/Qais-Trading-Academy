/* ============================================================================
   lib/qais/structure/verify/render.js
   عرض التقرير كنص عادي — بيتقرا بالمتصفح والطرفية بدون أدوات.
   ============================================================================ */

const iso = (t) => (Number.isFinite(t) ? new Date(t * 1000).toISOString().replace("T", " ").slice(0, 16) : "—");
const num = (v) => (v == null ? "—" : typeof v === "number" ? String(v) : String(v));

function stat(d) {
  if (!d || d.n === 0) return "لا عيّنة";
  return `n=${d.n} · متوسط ${d.mean} · وسيط ${d.median} · أدنى ${d.min} · أقصى ${d.max}`;
}

function insufficient(x) {
  return x && x.value === "INSUFFICIENT_DATA" ? `INSUFFICIENT_DATA — ${x.why}` : null;
}

export function renderReport(r) {
  const L = [];
  const h = (s) => L.push("", s, "─".repeat(Math.min(78, s.length + 8)));

  L.push("STRUCTURE ENGINE VALIDATION REPORT");
  L.push(`generated: ${r.generatedAt}`);

  /* -------- Dataset -------- */
  h("DATASET");
  L.push(`symbols        : ${r.dataset.symbols.join(", ")}`);
  L.push(`timeframes     : ${r.dataset.timeframes.join(", ") || "—"}`);
  L.push(`total candles  : ${r.dataset.totalCandles}`);
  for (const [tf, n] of Object.entries(r.dataset.perTFCandles)) {
    const dr = r.dataset.dateRanges[tf];
    L.push(`  ${tf.padEnd(6)} : ${String(n).padStart(6)} شمعة   ${dr ? `${iso(dr.from)} → ${iso(dr.to)}` : "—"}`);
  }
  L.push(`context records: ${r.dataset.contextRecords}  ${JSON.stringify(r.dataset.contextRecordsByTF)}`);

  /* -------- Instrument / tick -------- */
  h("INSTRUMENT & TOLERANCE");
  for (const [tf, d] of Object.entries(r.perTF)) {
    if (!d?.ok) continue;
    const i = d.instrument;
    L.push(`[${tf}]`);
    L.push(`  instrument          : ${i.instrument}`);
    L.push(`  tickSize            : ${i.tickSize}`);
    L.push(`  precision           : ${i.precision}`);
    L.push(`  tickSizeSource      : ${i.tickSizeSource}`);
    L.push(`  tickSizeConfidence  : ${i.tickSizeConfidence}`);
    L.push(`  grid coverage       : ${i.coverage ?? "—"} (أسعار مميّزة: ${i.distinctPrices ?? "—"})`);
    L.push(`  tolerance           : ${d.tolerance.description}  [${d.tolerance.mode}]`);
  }

  /* -------- Engine output -------- */
  h("ENGINE OUTPUT");
  for (const [tf, d] of Object.entries(r.perTF)) {
    if (!d?.ok) {
      L.push(`[${tf}] تعذّر: ${d?.reason ?? "—"}`);
      continue;
    }
    const c = d.counts;
    L.push(`[${tf}] شموع ${d.candleCount}`);
    L.push(`  swings   : داخلي ${d.swings.internal} · خارجي ${d.swings.major} (مرساة ${d.swings.anchors})`);
    L.push(`             HH ${d.swings.labels.HH} · HL ${d.swings.labels.HL} · LH ${d.swings.labels.LH} · LL ${d.swings.labels.LL} · بلا تسمية ${d.swings.labels.unlabeled}`);
    L.push(`  events   : BOS ${c.bos} · CHOCH ${c.choch} · MSS ${c.mss} · كسر كاذب ${c.fakeBreaks} · كسر بالذيل ${c.wickBreaks}`);
    L.push(`  displace : ${d.displacement.total}  ${JSON.stringify(d.displacement.byLevel)}`);
    L.push(`  swing accuracy      : ${insufficient(d.swings.accuracy)}`);
    L.push(`  displacement accuracy: ${insufficient(d.displacement.accuracy)}`);
  }

  /* -------- Replay integrity -------- */
  h("REPLAY INTEGRITY (مستقل عن الصفقات)");
  for (const [tf, d] of Object.entries(r.perTF)) {
    if (!d?.ok) continue;
    const p = d.replay;
    if (!p?.ok) {
      L.push(`[${tf}] ما اشتغل: ${p?.reason ?? "—"}`);
      continue;
    }
    L.push(`[${tf}] شمعة-بشمعة على ${p.replayedCandles} شمعة · ${p.steps} خطوة · أحداث ${p.eventsSeen}`);
    for (const [type, s] of Object.entries(p.detectionLatencyByType)) {
      L.push(`  تأخير اكتشاف ${type.padEnd(6)}: ${stat(s)} (بالشموع)`);
    }
    L.push(`  أحداث غير مستقرة (ظهرت ثم اختفت): ${p.unstableEvents.count}`);
    L.push(`  خرق السببية (تأخير سالب)        : ${p.causalityViolations}`);
  }

  /* -------- Trade-context agreement -------- */
  h("TRADE-CONTEXT AGREEMENT");
  L.push("⚠️  qais_ai_trades سياق تاريخي، مش ground truth. الأرقام تحت توافق، مش صح/غلط.");
  const o = r.overall;
  L.push(`سجلات مقيَّمة        : ${o.contextRecordsEvaluated}`);
  L.push(`  matched            : ${o.matched}`);
  L.push(`  direction mismatch : ${o.directionMismatch}`);
  L.push(`  unmatched          : ${o.unmatched}`);
  L.push(`  insufficient data  : ${o.insufficientData}`);
  L.push(`معدل التوافق         : ${o.agreementRate == null ? "INSUFFICIENT_DATA — ما في سجلات قابلة للتقييم" : `${(o.agreementRate * 100).toFixed(1)}%`}`);
  L.push(`متطابق حسب النوع     : ${JSON.stringify(o.matchedByType)}`);
  L.push(`متطابق حسب الاتجاه   : ${JSON.stringify(o.matchedByDirection)}`);
  L.push(`أحداث المحرك إجمالاً : ${JSON.stringify(o.engineEventTotals)}`);
  L.push(`false positives      : ${insufficient(o.falsePositives)}`);
  L.push(`false negatives      : ${o.falseNegatives.count} — ${o.falseNegatives.note}`);

  /* -------- Timing -------- */
  h("TIMING ERROR");
  if (r.timing.value === "INSUFFICIENT_DATA") {
    L.push(`INSUFFICIENT_DATA — ${r.timing.why}`);
  } else {
    L.push(`مطابقات: ${r.timing.n}`);
    L.push(`  فرق بالشموع : ${stat(r.timing.diffCandles)}`);
    L.push(`  فرق بالدقائق: ${stat(r.timing.diffMinutes)}`);
    L.push(`  متأخر ${r.timing.lateCount} · مبكر ${r.timing.earlyCount} · مطابق ${r.timing.exactCount}`);
  }

  /* -------- Edge cases -------- */
  h("EDGE CASES");
  for (const [tf, d] of Object.entries(r.perTF)) {
    if (!d?.ok) continue;
    const e = d.edgeCases;
    L.push(`[${tf}] معيار التساوي: ${e.equalityCriterion}`);
    const rows = [
      ["Equal Highs", e.equalHighs.count],
      ["Equal Lows", e.equalLows.count],
      ["بيفوتات ضاعت بالتعادل", e.pivotsSuppressedByExactTie.count],
      ["Wick Break", e.wickBreaks.count],
      ["Close Break", e.closeBreaks.count],
      ["Fake Break", e.fakeBreaks.count],
      ["Sweep → Return", e.sweepThenReturn.count],
      ["Strong Displacement", e.strongDisplacements.count],
      ["Extreme Displacement", e.extremeDisplacements.count],
      ["Consolidation bars", e.consolidationBars.count],
      ["High volatility bars", e.highVolatilityBars.count],
      ["Overlapping swings", e.overlappingSwings.count],
      ["Internal داخل Major", e.internalInsideMajor.count],
    ];
    for (const [k, v] of rows) L.push(`  ${k.padEnd(26)}: ${v}`);
  }

  /* -------- Failures -------- */
  h(`FAILURES (${r.failures.length})`);
  if (r.failures.length === 0) L.push("ما في حالات عدم تطابق.");
  for (const f of r.failures.slice(0, 40)) {
    L.push(`• ${f.timestamp ?? "—"} [${f.timeframe ?? "—"}] status=${f.status}`);
    L.push(`    مرجع : اتجاه ${f.referenceContext.direction ?? "—"} · دخول ${num(f.referenceContext.entryPrice)}`);
    L.push(`    محرك : ${f.engineOutput ? `${f.engineOutput.type} ${f.engineOutput.direction} @ ${num(f.engineOutput.price)} (${iso(f.engineOutput.time)})` : "لا حدث"}`);
    L.push(`    ليش  : ${f.whyDifferent}`);
    L.push(`    تصنيف مقترح: [${f.suggestedClass.code}] ${f.suggestedClass.label}${f.suggestedClass.note ? ` — ${f.suggestedClass.note}` : ""}`);
  }
  if (r.failures.length > 40) L.push(`… و${r.failures.length - 40} حالة إضافية بالـJSON`);

  /* -------- Limitations -------- */
  h("KNOWN LIMITATIONS");
  for (const l of r.limitations) {
    L.push(`• [${l.severity}] ${l.id}`);
    L.push(`    ${l.text}`);
    if (l.measured) L.push(`    مقيس: ${JSON.stringify(l.measured)}`);
  }

  return L.join("\n");
}
