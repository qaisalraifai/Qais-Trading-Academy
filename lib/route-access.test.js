import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  SESSION_PATHS,
  SUBSCRIPTION_PATHS,
  matchesPath,
  accessTierFor,
} from "./route-access.js";

/* ============================================================================
   حراس سياسة الوصول.

   القيمة هون مش بتأكيد اللي كتبناه — هي بالإمساك باللي بينكسر **بعدين**:
   صفحة جديدة بتنضاف بلا تصنيف، أو مسار دفع بينزلق لطبقة الاشتراك.
   ============================================================================ */

/* ══════════════ ١) حلقة التحويل — أخطر عطل ممكن بهالملف ══════════════ */

test("🔴 مسارات الدفع ما بتنحط بطبقة الاشتراك — وإلا حلقة تحويل مقفلة", () => {
  /* حساب `inactive` بينحوّل لـ/payment. لو /payment نفسها بدها اشتراك فعّال،
     بينحوّل منها لـ/payment… للأبد — وما بيقدر يشترك أبداً. */
  const payPaths = ["/payment", "/payment-success", "/payment/crypto", "/payment/crypto-auto"];
  for (const p of payPaths) {
    assert.notEqual(
      accessTierFor(p),
      "subscription",
      `${p} لازم يضل موصولاً لحساب بلا اشتراك — وإلا ما في طريق للدفع`
    );
  }
});

test("وجهة تحويل الاشتراك (/payment) بتقبل مستخدماً بلا اشتراك", () => {
  assert.equal(accessTierFor("/payment"), "session");
});

/* ══════════════ ٢) سلامة القائمتين ══════════════ */

test("ما في مسار بالقائمتين — التصنيف قاطع", () => {
  const both = SESSION_PATHS.filter((p) => SUBSCRIPTION_PATHS.includes(p));
  assert.deepEqual(both, [], `مسارات مكرَّرة بالطبقتين: ${both.join(", ")}`);
});

test("ما في مسار بيبلع مسار تاني بنفس القائمة", () => {
  const all = [...SESSION_PATHS, ...SUBSCRIPTION_PATHS];
  for (const a of all) {
    for (const b of all) {
      if (a === b) continue;
      assert.ok(
        !(b.startsWith(a + "/")),
        `${b} داخل ${a} — واحد منهن زايد أو التصنيف متعارض`
      );
    }
  }
});

/* ══════════════ ٣) المطابقة على حدود المقاطع ══════════════ */

test("⚠️ `/course` ما بتطابق `/courses` — كانت تطابقها بالـstartsWith الخام", () => {
  assert.ok(matchesPath("/course", ["/course"]));
  assert.ok(matchesPath("/course/12", ["/course"]));
  assert.ok(!matchesPath("/courses", ["/course"]));
  assert.ok(!matchesPath("/course-list", ["/course"]));
});

test("`/courses` محمية لأنها مدرجة صراحةً مش بالصدفة", () => {
  assert.ok(SUBSCRIPTION_PATHS.includes("/courses"));
  assert.equal(accessTierFor("/courses"), "subscription");
  assert.equal(accessTierFor("/course/9"), "subscription");
});

/* ══════════════ ٤) الطبقات كما تقرّرت ══════════════ */

test("محتوى الأعضاء بيتطلب اشتراكاً", () => {
  for (const p of ["/dashboard", "/replay", "/trading-radar", "/reports", "/ai-trades", "/courses", "/live-sessions"]) {
    assert.equal(accessTierFor(p), "subscription", p);
  }
});

test("إدارة الحساب والتهيئة بتتطلب جلسة وبس", () => {
  for (const p of ["/settings", "/select-batch", "/choose", "/admin", "/admin/payments"]) {
    assert.equal(accessTierFor(p), "session", p);
  }
});

test("⚠️ `/accounts` صفحة إدارية مش محتوى مدفوع — جلسة مش اشتراك", () => {
  /* بتفرض `isAdmin` بنفسها وبتحوّل لـ/dashboard. لو حطّيناها بطبقة الاشتراك
     بيروح الطالب بلا اشتراك لصفحة الدفع على صفحة ما بيقدر يفتحها حتى لو دفع. */
  assert.equal(accessTierFor("/accounts"), "session");
  assert.ok(!SUBSCRIPTION_PATHS.includes("/accounts"));
});

test("الصفحات العامة بتضل عامة", () => {
  for (const p of ["/", "/login", "/signup", "/terms", "/privacy", "/refund-policy", "/certificate/abc", "/auth/confirmed", "/r/xyz"]) {
    assert.equal(accessTierFor(p), "public", p);
  }
});

test("مسارات /api بتحرس حالها — السياسة ما بتلمسها", () => {
  for (const p of ["/api/payments/checkout", "/api/admin/users", "/api/replay-candles"]) {
    assert.equal(accessTierFor(p), "public", p);
  }
});

/* ══════════════ ٥) الحارس الحقيقي: صفحة جديدة بلا تصنيف ══════════════ */

/** كل صفحات مجموعة `(shell)` = منطقة الأعضاء. */
function shellPageUrls() {
  const root = path.join(process.cwd(), "app", "(shell)");
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "page.js") {
        let url = p
          .slice(root.length)
          .split(path.sep)
          .join("/")
          .replace(/\/page\.js$/, "");
        out.push(url === "" ? "/" : url);
      }
    }
  })(root);
  return out;
}

test("شرط مسبق: لقينا صفحات الشِل فعلاً (الحارس مش فاضي)", () => {
  const urls = shellPageUrls();
  assert.ok(urls.length >= 20, `توقّعنا ٢٠+ صفحة بالشِل، لقينا ${urls.length}`);
  assert.ok(urls.includes("/dashboard"));
});

test("⚠️ حارس: كل صفحة بمنطقة الأعضاء مصنَّفة — ولا وحدة عامة بالغلط", () => {
  /* استثناءان مقصودان بمنطقة الأعضاء:
       · `/settings`  — إدارة الحساب لازم توصلها والاشتراك واقف.
       · `/accounts`  — صفحة **إدارية** (بتفرض isAdmin بنفسها) مش محتوى مدفوع.
     أي صفحة تانية بتطلع «عامة» معناها إنها انضافت بلا ما تنصنّف — وهاد
     بيكشف محتوى مدفوع. */
  const INTENTIONAL_SESSION_ONLY = ["/settings", "/accounts"];

  const unclassified = [];
  for (const url of shellPageUrls()) {
    // المقاطع الديناميكية بتنستبدل بقيمة عيّنة عشان تنطابق
    const concrete = url.replace(/\[[^\]]+\]/g, "1");
    const tier = accessTierFor(concrete);
    if (tier === "public") unclassified.push(url);
    else if (tier === "session" && !INTENTIONAL_SESSION_ONLY.includes(url)) {
      unclassified.push(`${url} (جلسة بس — مقصودة؟)`);
    }
  }
  assert.deepEqual(
    unclassified,
    [],
    `صفحات بمنطقة الأعضاء بلا تصنيف اشتراك:\n  ${unclassified.join("\n  ")}`
  );
});

test("الحارس بيمسك فعلاً — فحص ذاتي", () => {
  // مسار وهمي بمنطقة الأعضاء ما إله مدخل بالقوائم لازم يطلع "public"
  assert.equal(accessTierFor("/some-brand-new-member-page"), "public");
});
