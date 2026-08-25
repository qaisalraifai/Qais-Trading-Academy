-- ============================================================================
-- 🔴 حرج — رفع صلاحية متاح لكل مستخدم مسجَّل
-- ============================================================================
--
-- الوضع قبل الإصلاح (مفحوص على قاعدة الإنتاج ٢٠٢٦-٠٨-٢٥):
--
--   صلاحيات الجدول:  authenticated و anon عندهن UPDATE على **كل** الجدول
--   سياسات RLS:      profiles_update_own      UPDATE  USING (auth.uid() = id)
--                    users can update own profile UPDATE USING (auth.uid() = id)
--                    (عمود الأدوار فاضي = بتنطبق على كل الأدوار)
--                    وما في WITH CHECK بيقيّد القيم الجديدة
--
-- ⚠️ **RLS بتقيّد الصفوف، مش الأعمدة.** فالمستخدم اللي بيقدر يعدّل صفّه
--    بيقدر يعدّل **كل عمود فيه**. من كونسول المتصفّح:
--
--      supabase.from("profiles")
--        .update({ role: "admin", subscription_status: "active" })
--        .eq("id", <معرّفه هو>)
--
--    → بيصير أدمن، وبياخد اشتراكاً مجانياً. متاح لكل حساب مسجَّل.
--
-- ----------------------------------------------------------------------------
-- الإصلاح: صلاحية على مستوى **الأعمدة** بدل الجدول.
--
-- ⚠️ ما بينكسر شي — مفحوص على كل الكود:
--    · التطبيق بيكتب على `profiles` من المتصفّح بمكان **واحد** وعمود **واحد**:
--      `app/(shell)/backtest/BacktestClient.jsx` → `backtest_balance`
--    · صفحة الإعدادات ما بتلمس الجدول من المتصفّح — بتمرق على مسارات الخادم
--    · ٥٣ مسار خادمي بيستعملوا **مفتاح الخدمة** اللي بيتجاوز الصلاحيات كلها
--
-- ⚠️ سياسات RLS **ما بتتغيّر**. الإصلاح على طبقة الصلاحيات وحدها، فسلوك
--    القراءة والإدراج يضل كما هو.
-- ============================================================================

-- ١) سحب الكتابة الواسعة عن أدوار المتصفّح
revoke update on public.profiles from authenticated;
revoke update on public.profiles from anon;

-- ٢) السماح بالعمود الوحيد اللي التطبيق بيحتاجه من المتصفّح
grant update (backtest_balance) on public.profiles to authenticated;

-- ٣) تحصين إضافي: `anon` ما إله شغل يكتب أو يمسح
--    ⚠️ **TRUNCATE ما بتخضع لـRLS إطلاقاً** (بتنطبق على SELECT/INSERT/UPDATE/
--       DELETE وبس). حالياً مش قابلة للاستغلال عبر واجهة Supabase لأن
--       PostgREST ما بتعرّض TRUNCATE — بس الصلاحية موجودة بلا سبب، وسحبها
--       بيشيل الاعتماد على تفصيل بمزوّد خارجي.
revoke truncate on public.profiles from authenticated;
revoke truncate on public.profiles from anon;
revoke delete on public.profiles from anon;
revoke insert on public.profiles from anon;

-- ----------------------------------------------------------------------------
-- تحقّق بعد التشغيل — لازم يرجّع `backtest_balance` وبس لـauthenticated:
--
--   select grantee, privilege_type, column_name
--   from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'profiles'
--     and grantee in ('anon','authenticated') and privilege_type = 'UPDATE';
--
-- وللتأكد إنّ الثغرة انسدّت، جرّب من كونسول المتصفّح بحساب عادي:
--   await supabase.from("profiles").update({ role: "admin" }).eq("id", uid)
-- المفروض يرجع خطأ صلاحيات (42501) بدل ما ينجح.
-- ============================================================================
