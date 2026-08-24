import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SIGNUP_WINDOW_MS,
  SIGNUP_VERDICT,
  signupOwnershipVerdict,
} from "./signup-guard.js";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const NOW = Date.parse("2026-08-24T12:00:00.000Z");
const at = (msAgo) => new Date(NOW - msAgo).toISOString();

/* ══════════════ البوابة الأقوى: الجلسة ══════════════ */

test("جلسة مطابِقة → مسموح، حتى لو الحساب قديم", () => {
  assert.equal(
    signupOwnershipVerdict({
      sessionUserId: A, requestedUserId: A, createdAt: at(365 * 24 * 3600e3), now: NOW,
    }),
    SIGNUP_VERDICT.OK
  );
});

test("🔴 جلسة مخالِفة → مرفوض، حتى لو الحساب جديد", () => {
  /* هاي محاولة «أنشئ بروفايل لحساب غيري وأنا مسجّل دخول». */
  assert.equal(
    signupOwnershipVerdict({
      sessionUserId: A, requestedUserId: B, createdAt: at(1000), now: NOW,
    }),
    SIGNUP_VERDICT.SESSION_MISMATCH
  );
});

/* ══════════════ البوابة التانية: حداثة الحساب ══════════════ */

test("بلا جلسة + حساب لسا انعمل → مسموح (مسار التسجيل الطبيعي)", () => {
  for (const ms of [0, 500, 5000, SIGNUP_WINDOW_MS - 1]) {
    assert.equal(
      signupOwnershipVerdict({ sessionUserId: null, requestedUserId: A, createdAt: at(ms), now: NOW }),
      SIGNUP_VERDICT.OK,
      `عمر ${ms}ms`
    );
  }
});

test("🔴 بلا جلسة + حساب قديم → مرفوض (سرقة الإحالة/حجز الاسم)", () => {
  for (const ms of [SIGNUP_WINDOW_MS + 1, 3600e3, 30 * 24 * 3600e3]) {
    assert.equal(
      signupOwnershipVerdict({ sessionUserId: null, requestedUserId: A, createdAt: at(ms), now: NOW }),
      SIGNUP_VERDICT.WINDOW_EXPIRED,
      `عمر ${ms}ms`
    );
  }
});

test("⚠️ تاريخ إنشاء بالمستقبل → مرفوض (انحراف ساعة أو قيمة مدسوسة)", () => {
  assert.equal(
    signupOwnershipVerdict({ sessionUserId: null, requestedUserId: A, createdAt: at(-60000), now: NOW }),
    SIGNUP_VERDICT.WINDOW_EXPIRED
  );
});

test("⚠️ تاريخ ناقص أو غير صالح → مرفوض — الافتراضي مقفول", () => {
  for (const v of [null, undefined, "", "not-a-date", "٢٠٢٦"]) {
    assert.equal(
      signupOwnershipVerdict({ sessionUserId: null, requestedUserId: A, createdAt: v, now: NOW }),
      SIGNUP_VERDICT.WINDOW_EXPIRED,
      String(v)
    );
  }
});

/* ══════════════ فرق «ما تأكدنا» عن «مش صاحبه» ══════════════ */

test("⚠️ جلسة null (كوكي مكسور/خادم ما ردّ) بتنزل لبوابة الحداثة مش للرفض", () => {
  /* لو عاملناها رفضاً مباشراً، عطل شبكة لحظي بيكسر التسجيل لكل مستخدم
     جديد. الحساب لسا جديد فبيمرق — وهو فعلاً بلحظة تسجيله. */
  assert.equal(
    signupOwnershipVerdict({ sessionUserId: null, requestedUserId: A, createdAt: at(2000), now: NOW }),
    SIGNUP_VERDICT.OK
  );
});

test("النافذة العشر دقائق كما هي موثّقة", () => {
  assert.equal(SIGNUP_WINDOW_MS, 10 * 60 * 1000);
});
