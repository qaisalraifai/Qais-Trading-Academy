-- i18n (Phase 5) — يضيف عمود اللغة المفضّلة لبروفايل المستخدم، حتى تنحفظ
-- اللغة بالحساب نفسه (مش بس بالمتصفح) وتضل ثابتة عبر الأجهزة وبعد تسجيل الخروج.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en'));
