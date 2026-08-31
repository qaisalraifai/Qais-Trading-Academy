"use client";

import { useEffect, useRef } from "react";

/* ============================================================================
   WarpTransition — لحظة العبور بعد تسجيل الدخول.
   ----------------------------------------------------------------------------
   النجوم بتتسارع من نقط لخطوط، والشاشة بتغمض، وبعدها المنصّة.

   **ليش لحظة وحدة مش تأثير دائم:** كل ما التأثير تكرر قلّت قيمته. هاد
   بينشاف **مرة بالجلسة**، بلحظتها الصح — بين «ضغطت دخول» و«صرت جوّا» —
   فبيحسّ حدثاً لا زينة. وما بيكلّف ولا إشي بالاستعمال اليومي بعدها.

   **ليش مش نفس `Starfield`:** هداك خلفية بتشتغل للأبد وبتوقف لما تكون
   الصفحة مخفية. هاد كائن قصير العمر بينهي حاله وبينادي `onDone` — عمر
   محدّد ونهاية مضمونة. خلطهم بمكوّن واحد بيخلّي حالة «بتسارع» تعيش جوّا
   شي عمره الجلسة كلها.

   ⚠️ **الانتقال ما بيحجز التنقّل.** الأب بيبلّش المصادقة **وبنفس اللحظة**
   بيشغّل الانتقال؛ اللي بيخلص آخراً بيوجّه. فلو الشبكة بطيئة الانتقال
   بيغطّي الانتظار، ولو سريعة ما بيتأخّر المستخدم أكتر من مدّته.

   ⚠️ بيحترم `prefers-reduced-motion`: بينادي `onDone` فوراً بلا ما يرسم.
   ============================================================================ */

const DURATION_MS = 1100;
/* ⚠️ الرقم مش اعتباطياً: أقصر من ثانية بيخلّيه يبان خللاً بالرسم مش قصداً،
   وأطول من ثانية ونص بيصير المستخدم مستنّي. */

export default function WarpTransition({ onDone }) {
  const canvasRef = useRef(null);
  /* ⚠️ `onDone` بمرجع: التأثير بيتركّب **مرة**، ولو قرا الـprop من إغلاقه
     بيمسك أول نسخة للأبد. والمصفوفة الفاضية مقصودة — إعادة التركيب بترجّع
     الانتقال من أوله. */
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      doneRef.current?.();
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) { doneRef.current?.(); return; }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = w / 2;
    const cy = h / 2;

    /* النجوم بإحداثيات قطبية من مركز الشاشة — الاندفاع للخارج بيصير
       بزيادة نصف القطر وبس، فما في حساب اتجاه لكل نجمة كل إطار. */
    const count = Math.round((w * h) / 5200);
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        ang: Math.random() * Math.PI * 2,
        /* التوزيع بالجذر بيخلّي الكثافة متساوية على المساحة. بلاه بتتكدّس
           النجوم بالمركز وبيصير المنظر بقعة وسط شاشة فاضية. */
        rad: Math.sqrt(Math.random()) * Math.max(w, h) * 0.62,
        speed: 0.55 + Math.random() * 0.85,
        size: Math.random() < 0.12 ? 1.7 : 0.9,
        tint: Math.random() < 0.16 ? (Math.random() < 0.5 ? "124,77,255" : "34,211,238") : "226,222,255",
      });
    }

    let raf = null;
    let start = null;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (raf) cancelAnimationFrame(raf);
      doneRef.current?.();
    };

    function frame(time) {
      if (start === null) start = time;
      const t = Math.min(1, (time - start) / DURATION_MS);

      /* منحنى التسارع: بطيء بالبداية وبينفجر بالآخر — `t³` بيعطي إحساس
         إنّ الشي **بيسحبك** مش إنه بينزلق بسرعة ثابتة. */
      const accel = t * t * t;

      /* ذيل بدل مسح كامل: تعتيم جزئي بيخلّي الإطار السابق يبهت تحت الجديد
         فتتكوّن خطوط من نفس النقط بلا ما نخزّن مسارات. */
      ctx.fillStyle = "rgba(5,3,8,0.34)";
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const prev = s.rad;
        s.rad += s.speed * (1 + accel * 46);

        const cos = Math.cos(s.ang);
        const sin = Math.sin(s.ang);
        const x1 = cx + cos * prev;
        const y1 = cy + sin * prev;
        const x2 = cx + cos * s.rad;
        const y2 = cy + sin * s.rad;

        ctx.beginPath();
        ctx.strokeStyle = `rgba(${s.tint},${(0.16 + 0.72 * t).toFixed(3)})`;
        ctx.lineWidth = s.size;
        ctx.lineCap = "round";
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      /* إغماض بالآخر — بيغطّي القفزة بين الانتقال وأول رسم للمنصّة، وبلاه
         بتشوف وميض الصفحة الجديدة وهي بتتركّب. */
      if (t > 0.72) {
        ctx.fillStyle = `rgba(5,3,8,${(((t - 0.72) / 0.28) * 0.96).toFixed(3)})`;
        ctx.fillRect(0, 0, w, h);
      }

      if (t >= 1) { finish(); return; }
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    /* ⚠️ **حارس**: لو الصفحة انخفت بنص الانتقال بيتجمّد `rAF` والوعد ما
       بيكتمل أبداً — فالمستخدم بيضل على شاشة سوداء. المؤقّت بينهيه أياً كان.
       مش تأخيراً مصطنعاً: هو **سقف** للحالة اللي بيتوقف فيها الرسم. */
    const guard = setTimeout(finish, DURATION_MS + 600);

    return () => {
      finished = true;
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(guard);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 9999,
        pointerEvents: "none",
        background: "#050308",
      }}
    />
  );
}
