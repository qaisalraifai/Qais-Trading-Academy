-- استبدال Paddle بـ Whop: أعمدة جديدة لتتبع العضوية بدل paddle_customer_id / paddle_subscription_id.
-- ما منمسح أعمدة Paddle القديمة عمداً، حتى يضل سجل المدفوعات التاريخية القديمة قابل للقراءة.
-- لو بدك تشيلها لاحقاً بعد التأكد إنه كل شي شغال:
--   ALTER TABLE profiles DROP COLUMN paddle_customer_id, DROP COLUMN paddle_subscription_id;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS whop_user_id text,
  ADD COLUMN IF NOT EXISTS whop_membership_id text;

CREATE INDEX IF NOT EXISTS idx_profiles_whop_membership_id ON profiles (whop_membership_id);
CREATE INDEX IF NOT EXISTS idx_profiles_whop_user_id ON profiles (whop_user_id);

-- لو عندك بيانات مدفوعات قديمة بجدول payments بعمود method = 'paddle'،
-- منتركها متل ما هي (سجل تاريخي). الدفعات الجديدة رح تنسجل بـ method = 'whop'.
