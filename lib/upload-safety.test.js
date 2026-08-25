import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedDocument,
  safeContentType,
  safeExtension,
} from "./upload-safety.js";

/* ══════════════ الصيغ اللي الواجهة بتعلنها (accept="image/*,.pdf") ══════════════ */

test("صور وPDF مقبولة — نفس اللي الواجهة بتعرضه", () => {
  for (const t of ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/heic", "application/pdf"]) {
    assert.ok(isAllowedDocument(t), t);
  }
});

test("🔴 الصيغ التنفيذية مرفوضة للتوثيق", () => {
  for (const t of ["text/html", "image/svg+xml", "application/javascript", "text/xml", "application/x-msdownload", ""]) {
    assert.ok(!isAllowedDocument(t), t);
  }
});

test("بارامترات MIME وحالة الأحرف ما بتخدع الفحص", () => {
  assert.ok(isAllowedDocument("IMAGE/JPEG"));
  assert.ok(isAllowedDocument("application/pdf; charset=binary"));
  assert.ok(isAllowedDocument("  image/png  "));
});

/* ══════════════ نوع المحتوى المخزَّن — الحماية الفعلية ══════════════ */

test("الآمن للعرض بينخزَّن كما هو", () => {
  for (const t of ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "application/pdf"]) {
    assert.equal(safeContentType(t), t, t);
  }
});

test("🔴 SVG مستثنى رغم إنه صورة — بيقبل سكربت جوّاه", () => {
  assert.equal(safeContentType("image/svg+xml"), "application/octet-stream");
});

test("🔴 أي شي تنفيذي بينخزَّن octet-stream فبينزّل بدل ما ينفّذ", () => {
  for (const t of ["text/html", "application/xhtml+xml", "text/xml", "application/javascript", "text/javascript"]) {
    assert.equal(safeContentType(t), "application/octet-stream", t);
  }
});

test("⚠️ المجهول بينزل لـoctet-stream — الافتراضي مقفول", () => {
  for (const t of [undefined, null, "", "غريب/شي", "application/zip", "application/msword"]) {
    assert.equal(safeContentType(t), "application/octet-stream", String(t));
  }
});

test("⚠️ العميل بيقدر يدّعي image/png لملف HTML — والادّعاء بينخزَّن", () => {
  /* هاد حدّ معروف: النوع المعلَن هو كل اللي عنا. الحماية إنّ ادّعاء **مش**
     من القائمة الآمنة بينحوّل octet-stream، وإنّ الامتداد بينشتق من النوع
     المعلَن — فملف HTML مدّعي `image/png` بينتخزّن `.png` بنوع صورة، والمتصفّح
     ما بيرسمه كصفحة. */
  assert.equal(safeContentType("image/png"), "image/png");
  assert.equal(safeExtension("image/png"), "png");
});

/* ══════════════ الامتداد من النوع مش من اسم الملف ══════════════ */

test("🔴 الامتداد بينشتق من النوع المتحقَّق مش من اسم العميل", () => {
  assert.equal(safeExtension("image/jpeg"), "jpg");
  assert.equal(safeExtension("application/pdf"), "pdf");
  assert.equal(safeExtension("image/heic"), "heic");
});

test("نوع مجهول → الامتداد الاحتياطي، وما بينبنى من اسم الملف", () => {
  assert.equal(safeExtension("text/html"), "bin");
  assert.equal(safeExtension("text/html", "jpg"), "jpg");
  assert.equal(safeExtension(undefined, "jpg"), "jpg");
});
