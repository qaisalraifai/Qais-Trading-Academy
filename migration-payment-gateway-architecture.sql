-- =====================================================================
-- بنية نظام الدفع الموحّد (Payment Gateway Architecture) — مستقل عن المزوّد
-- =====================================================================
-- الهدف: طبقة دفع واحدة (payment_providers + invoices + payment_transactions)
-- بحيث الاشتراكات/الفواتير/التجديدات ما بترتبط مباشرة بأي مزوّد (Whop، Paddle،
-- NOWPayments، دفع يدوي USDT...). كل مزوّد هو "Adapter" مسجّل بجدول
-- payment_providers، وكل عملية دفع بتمر عبر invoices + payment_transactions
-- بغض النظر مين المزوّد.
--
-- ما منلمس أعمدة profiles الحالية (subscription_status, subscription_start,
-- subscription_end, auto_renew, whop_*) ولا جدول payments القديم — نضل نكتب
-- فيهم لأجل التوافق مع كل الكود الحالي (middleware، الداشبورد، تقارير الأدمن،
-- عمولات المسوّقين...). الجداول الجديدة هون هي "مصدر الحقيقة" التفصيلي
-- (فواتير، محاولات دفع، حالة سماح...) وبتغذّي profiles من فوق.

-- ---------------------------------------------------------------------
-- 1) سجل مزوّدي الدفع (Payment Providers Registry)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_providers (
  code text PRIMARY KEY,                  -- 'whop' | 'manual_usdt' | 'nowpayments' | 'paddle' ...
  name text NOT NULL,                     -- اسم معروض بالعربي
  type text NOT NULL CHECK (type IN ('card', 'crypto_auto', 'crypto_manual', 'other')),
  enabled boolean NOT NULL DEFAULT false,
  supports_auto_renew boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 100,
  config jsonb NOT NULL DEFAULT '{}',     -- إعدادات خاصة بالمزوّد (بدون أسرار — الأسرار بمتغيرات البيئة فقط)
  description text,                       -- نص قصير يظهر للطالب بصفحة الدفع
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- تسجيل المزوّد الحالي (Whop) بالبنية الجديدة — نفس السلوك القديم، بس هلأ
-- مسجّل بشكل رسمي بالـ registry بدل ما يكون hardcoded بالكود.
INSERT INTO payment_providers (code, name, type, enabled, supports_auto_renew, sort_order, description)
VALUES ('whop', 'بطاقة بنكية (Whop)', 'card', true, true, 10, 'دفع فوري بالبطاقة، تجديد شهري تلقائي')
ON CONFLICT (code) DO NOTHING;

INSERT INTO payment_providers (code, name, type, enabled, supports_auto_renew, sort_order, description)
VALUES ('manual_usdt', 'تحويل USDT يدوي', 'crypto_manual', true, false, 20, 'حوّل USDT لمحفظتنا وارفع إثبات الدفع، وبيتفعّل اشتراكك بعد مراجعة الأدمن')
ON CONFLICT (code) DO NOTHING;

-- Placeholder فقط — مش مفعّل، وما إله مفاتيح API حالياً. بينفعّل لاحقاً بمجرد
-- ما يتحدد المزوّد المناسب (الحساب بالأردن) وبتم ربط مفاتيحه الحقيقية.
INSERT INTO payment_providers (code, name, type, enabled, supports_auto_renew, sort_order, description)
VALUES ('nowpayments', 'كريبتو تلقائي (قريباً)', 'crypto_auto', false, false, 30, 'دفع كريبتو تلقائي مع تفعيل فوري — قيد الإعداد')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2) محافظ الكريبتو (يديرها الأدمن، بدون لمس الكود)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crypto_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL,                  -- 'TRC20' | 'BEP20' | 'ERC20' | ...
  currency text NOT NULL DEFAULT 'USDT',
  address text NOT NULL,
  label text,                             -- ملاحظة داخلية للأدمن
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crypto_wallets_active ON crypto_wallets (is_active);

-- ---------------------------------------------------------------------
-- 3) خطط الاشتراك (مرجع أسعار موحّد، بدل ما تكون الأرقام مبعثرة بالكود)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_plans (
  code text PRIMARY KEY,                  -- 'signup' | 'monthly'
  name text NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  interval text NOT NULL CHECK (interval IN ('one_time', 'month')),
  is_active boolean NOT NULL DEFAULT true
);

INSERT INTO billing_plans (code, name, amount, currency, interval)
VALUES
  ('signup', 'اشتراك أول (تسجيل)', 300.00, 'USD', 'one_time'),
  ('monthly', 'اشتراك شهري', 100.00, 'USD', 'month')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4) الاشتراكات (حالة الفوترة المستقلة عن المزوّد — تغذّي profiles)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_code text REFERENCES payment_providers(code),  -- آخر مزوّد استُخدم/مختار
  status text NOT NULL DEFAULT 'incomplete'
    CHECK (status IN ('incomplete', 'active', 'past_due', 'suspended', 'canceled')),
  auto_renew boolean NOT NULL DEFAULT false,              -- بتتحدد حسب المزوّد (supports_auto_renew)
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_period_end timestamptz,                           -- نهاية فترة السماح قبل التعليق
  external_ref text,                                      -- مرجع الاشتراك عند المزوّد (مثلاً whop_membership_id)
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_active
  ON subscriptions (user_id) WHERE status IN ('active', 'past_due', 'suspended', 'incomplete');

-- ---------------------------------------------------------------------
-- 5) الفواتير (المصدر الموحّد لكل عملية استحقاق مالي، بغض النظر عن المزوّد)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_code text REFERENCES billing_plans(code),
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  provider_code text REFERENCES payment_providers(code),  -- المزوّد اللي هالفاتورة رح تنسدد فيه (أو انسدت)
  period_start timestamptz,
  period_end timestamptz,
  due_date timestamptz,
  paid_at timestamptz,
  external_ref text,                                      -- معرف الفاتورة/الجلسة عند المزوّد (لو موجود)
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices (user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices (due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices (subscription_id);

-- ---------------------------------------------------------------------
-- 6) محاولات/عمليات الدفع الفعلية (كل محاولة سداد لفاتورة، عبر أي مزوّد)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_code text NOT NULL REFERENCES payment_providers(code),
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'rejected')),
  external_ref text,                                      -- معرف العملية عند المزوّد (payment id، tx id...)
  raw_payload jsonb,                                       -- استجابة/Webhook خام للمرجعية والتدقيق
  reviewed_by uuid REFERENCES profiles(id),                -- للدفع اليدوي: مين من الأدمن راجعها
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_invoice ON payment_transactions (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_user ON payment_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_provider ON payment_transactions (provider_code);
CREATE INDEX IF NOT EXISTS idx_payment_tx_status ON payment_transactions (status);

-- ---------------------------------------------------------------------
-- 7) تفاصيل الدفع اليدوي بالـ USDT (TXID + صورة الإثبات + الشبكة/المحفظة)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manual_payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  wallet_id uuid REFERENCES crypto_wallets(id),
  network text NOT NULL,
  txid text,
  proof_image_path text,                                  -- مسار بـ Supabase Storage (bucket: payment-proofs)
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_submissions_tx ON manual_payment_submissions (transaction_id);

-- ---------------------------------------------------------------------
-- 8) سجل إشعارات الفوترة (حتى ما نرسل نفس التذكير مرتين)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('upcoming_7d', 'upcoming_3d', 'due_today', 'suspended', 'reactivated')),
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_notif_unique
  ON billing_notifications_log (invoice_id, kind);

-- ---------------------------------------------------------------------
-- 9) أعمدة إضافية بسيطة على profiles (بدون لمس الأعمدة الموجودة)
-- ---------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_payment_provider text REFERENCES payment_providers(code);

-- =====================================================================
-- ملاحظات تشغيل:
-- - لازم تنشئ Storage bucket اسمه payment-proofs (private) — بينشئه الكود
--   تلقائياً أول رفع (نفس نمط kyc-documents).
-- - جدول payments القديم يضل يشتغل متل ما هو (لغايات التقارير التاريخية)،
--   وطبقة الدفع الجديدة بتكتب فيه كمان تلقائياً لأجل التوافق مع أي تقرير/
--   عمولة موجودة حالياً بتعتمد عليه.
-- =====================================================================
