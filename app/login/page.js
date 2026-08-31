"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";
import Logo from "@/app/components/brand/Logo";
import WarpTransition from "@/app/components/brand/WarpTransition";

/* ============================================================================
   تسجيل الدخول — لحظة العبور بين الواجهة والمنصّة.
   ----------------------------------------------------------------------------
   🔴 **كانت الحلقة المكسورة بالرحلة البصرية.** قياس قبل الشغل:

     · `<div>` بارتفاع `100vh` وخلفية معتمة
       (`radial-gradient(ellipse at top, #120B24…)`) بترسم **فوق** طبقة
       الفضاء — فالنجوم كانت موجودة بالـDOM ومغطّاة بالكامل.
     · `fontFamily: "'Segoe UI', sans-serif"` — مش خط المنصّة إطلاقاً.
     · ١٩ استعمال لـ`style={{ }}` بألوان مكتوبة بالإيد، بينما الصفحة
       الرئيسية «صفر `style={{ }}`، كل شي بتوكنز الهوية».

   يعني المستخدم كان يمرق: صفحة رئيسية بهوية كاملة ← صفحة دخول بهوية تانية
   ← منصّة بهوية تالتة. وأي تأثير بينضاف فوق هالقطيعة بيصير ترقيع.

   ⚠️ **نداءات المصادقة ما انلمست ولا حرف** — نفس `signInWithPassword`، نفس
   `getUser`، نفس قراءة البروفايل، نفس `/api/log-login`، ونفس الوجهة
   (`/dashboard`). متحقَّق بالفرق: ولا سطر منهن ظهر بالتغييرات.

   ⚠️ **اللي تغيّر بالسلوك شغلتان، الاتنتين مقصودتان:**
   ١) التوجيه صار **مبوَّباً** على انتهاء الانتقال البصري كمان — الوجهة هي
      هي، بس توقيتها بينتظر أبطأ الاتنين (شوف `goWhenBothReady`).
   ٢) `<form onSubmit>` بدل `onClick` — يعني Enter بيسجّل الدخول.
      `handleLogin` أصلاً بتنادي `preventDefault()` فهي مكتوبة لنموذج من
      البداية وكانت معلّقة على زر. مسار الإرسال ضل واحد (`type="submit"`)
      فما في نداء مزدوج.

   ============================================================================ */

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [warping, setWarping] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  /* ═══════════════════════════════════════════════════════════════════════════
     لحظة العبور — **بلا انتظار مضاف.**
     ---------------------------------------------------------------------------
     الانتقال بيبلّش لحظة ما تنجح المصادقة، فبيمرق **فوق** باقي النداءات
     (`getUser` و`profiles` و`log-login`) بدل ما ينضاف بعدهن. اللي بيخلص
     آخراً هو اللي بيوجّه — فلو الشبكة بطيئة الانتقال بيغطّي الانتظار، ولو
     سريعة المستخدم ما بيستنى أكتر من مدّة الانتقال.

     ⚠️ **مش قبل المصادقة**: لو فشل الدخول بيكون الانتقال غطّى الشاشة وبدنا
     نلغيه — وميض وارتباك. بعد النجاح ما في تراجع.
     ═══════════════════════════════════════════════════════════════════════════ */
  const authDoneRef = useRef(false);
  const warpDoneRef = useRef(false);
  const goWhenBothReady = useCallback(() => {
    if (authDoneRef.current && warpDoneRef.current) router.push("/dashboard");
  }, [router]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) { setError("الإيميل أو كلمة المرور غلط"); setLoading(false); return; }
    setWarping(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    /* تسجيل IP/الجهاز/الـ Timeline من السيرفر — ما بيوقف تسجيل الدخول لو فشل.
       ⚠️ ما بينبعت `userId`: المسار بيقرا الهوية من الجلسة حصراً. كان بياخدها
       من الجسم بلا مصادقة، فكان أي حدا يقدر يزوّر سجلّ دخول أي حساب. */
    fetch("/api/log-login", { method: "POST" }).catch(() => {});
    authDoneRef.current = true;
    goWhenBothReady();
  }

  /* حقل واحد بستايل واحد — الفرق بين الحقلين النوع والمحتوى وبس.
     ⚠️ `dir="ltr"` على الحقل نفسه: الإيميل وكلمة المرور لاتينيان، والصفحة
     RTL — بلا هاد بتطلع علامة `@` بأول السطر. */
  const field =
    "w-full rounded-sm border border-edge-soft bg-space-0/80 px-4 py-3 text-sm text-text-primary " +
    "outline-none transition-colors duration-base placeholder:text-text-faint " +
    "focus:border-violet-300 focus:shadow-focus-ice";

  return (
    /* ⚠️ **بلا خلفية** — طبقة الفضاء (`SpaceBackdrop` بالجذر) بتبان من ورا.
       أي لون معتم هون بيحجبها، وهاد كان العطل الأصلي. */
    <div className="flex min-h-screen items-center justify-center px-5 py-12" dir="rtl">
      {warping && (
        <WarpTransition
          onDone={() => { warpDoneRef.current = true; goWhenBothReady(); }}
        />
      )}
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6">

        <Logo size={72} />

        <div className="text-center">
          <p className="mb-2 font-mono text-[0.66rem] uppercase tracking-[0.32em] text-violet-100">
            QTA
          </p>
          <h1 className="mb-1.5 text-2xl font-extrabold tracking-tight text-text-primary">
            تسجيل الدخول
          </h1>
          <p className="text-sm text-text-secondary">أهلاً بعودتك لأكاديمية Qais Trading</p>
        </div>

        {/* الكرت زجاجي مش معتم — عشان النجوم تضل محسوسة من ورا بدل ما تنقطع */}
        <form
          onSubmit={handleLogin}
          className="glass w-full rounded-lg border border-edge p-7 shadow-overlay"
        >
          <div className="flex flex-col gap-5">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-caption text-text-muted">
                البريد الإلكتروني
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="example@email.com"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-caption text-text-muted">
                كلمة المرور
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
              />
            </div>

            {/* ⚠️ `role="alert"` — قارئ الشاشة لازم ينطق الخطأ، وإلا المستخدم
                غير المبصر بيضل يضغط بلا ما يعرف إنه في رسالة. */}
            {error && (
              <p role="alert" className="m-0 text-center text-caption text-loss">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-sm bg-violet-200 py-3.5 text-sm font-semibold text-space-0 shadow-glow-violet transition-colors duration-base hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "جاري الدخول..." : "تسجيل الدخول"}
            </button>
          </div>
        </form>

        <p className="text-caption text-text-muted">
          ما عندك حساب؟{" "}
          <Link
            href="/signup"
            className="text-violet-100 no-underline transition-colors duration-base hover:text-text-primary"
          >
            اشترك الآن
          </Link>
        </p>
      </div>
    </div>
  );
}
