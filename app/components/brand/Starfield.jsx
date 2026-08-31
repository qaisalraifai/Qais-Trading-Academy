"use client";

import { useEffect, useRef } from "react";

/* ============================================================================
   Starfield — حقل نجوم على Canvas.
   ----------------------------------------------------------------------------
   ليش Canvas مش SVG/CSS: مئات النقاط المتحرّكة بـDOM بتقتل الأداء. الكانفس
   بيرسمهم بطبقة واحدة، وبيوقف كلياً لما الصفحة تكون برّا الشاشة.

   الحركة انجراف بطيء جداً + وميض خفيف — مش "نجوم تلمع". الهدف عمق، مش لفت نظر.
   بيحترم prefers-reduced-motion: بيرسم إطار ثابت وبيوقف.

   ---------------------------------------------------------------------------
   ⚠️ **انقوّى** (٢٠٢٦-٠٨-٣١): «الانميشن أقوى بمراحل». الزيادات تلاتة، وكلها
   بنفس الكانفس الواحد — ولا طبقة DOM جديدة:

   ١) هالة للنجوم اللامعة — دايرة تانية بشفافية واطية. أرخص من `shadowBlur`
      (اللي بيعيد حساب الضبابية لكل نجمة كل إطار) وبتعطي نفس إحساس العمق.
   ٢) شهاب عابر — **واحد بس بكل مرة**، والتالي بعد ٧–١٨ ثانية عشوائياً.
      نادر ومقصود، مش مطر شهب.
   ٣) وميض أوضح شوي وانجراف أسرع بشكل طفيف.

   ⚠️ الشهب بتنطفي مع `prefers-reduced-motion` زي باقي الحركة.

   ⚠️ **جُرّب بديل بلا نجوم (سديم متدرّج) وانرفض** — قراره: «كثير مزعج
   وألوان قوية وفاقد إحساس الفضاء». فالنجوم هي الأساس، والتقوية بتصير
   **عليها** مش بدالها.
   ============================================================================ */

export default function Starfield({ density = 1, className, parallax = true, meteors = true }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = null;
    let stars = [];
    let w = 0;
    let h = 0;
    let scrollY = 0;
    let running = true;
    /* شهاب واحد بس — `null` يعني ما في، ووقت الولادة الجاية بالميلي ثانية. */
    let meteor = null;
    let nextMeteorAt = 0;

    function build() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(((w * h) / 9000) * density);
      stars = [];
      for (let i = 0; i < count; i++) {
        const bright = Math.random() < 0.08;
        stars.push({
          bright,
          x: Math.random() * w,
          y: Math.random() * h,
          r: bright ? Math.random() * 1 + 1.1 : Math.random() * 0.7 + 0.25,
          a: bright ? Math.random() * 0.35 + 0.4 : Math.random() * 0.3 + 0.1,
          // النجوم الأبعد بتتحرّك أبطأ — إحساس عمق
          depth: Math.random() * 0.7 + 0.3,
          phase: Math.random() * Math.PI * 2,
          // القليل منها بلون الهوية بدل الأبيض
          tint: Math.random() < 0.14 ? (Math.random() < 0.5 ? "124,77,255" : "34,211,238") : "226,222,255",
        });
      }
      /* ⚠️ أول شهاب بعد ٢.٥–٥.٥ ثانية مش لحظة التحميل: `nextMeteorAt = 0`
         بيخلّيه يولد بأول إطار، فأول إشي بتشوفه الصفحة شهاب.
         `performance.now()` نفس مرجع وقت `requestAnimationFrame`. */
      nextMeteorAt = performance.now() + 2500 + Math.random() * 3000;
    }

    /* شهاب جديد: بيبدأ من الثلث العلوي وبيهبط قُطرياً. الطول والسرعة
       بيتغيّروا شوي حتى ما يبان مكرراً. */
    function spawnMeteor(time) {
      const fromLeft = Math.random() < 0.5;
      meteor = {
        x: fromLeft ? -60 : w + 60,
        y: Math.random() * h * 0.45,
        vx: (fromLeft ? 1 : -1) * (2.6 + Math.random() * 1.6),
        vy: 1.1 + Math.random() * 0.9,
        len: 90 + Math.random() * 70,
        ttl: 900 + Math.random() * 500,
        born: time,
      };
    }

    function drawMeteor(time) {
      if (!meteor) return;
      const age = time - meteor.born;
      if (age > meteor.ttl) { meteor = null; return; }
      /* بيظهر بسرعة وبيختفي بهدوء. */
      const t = age / meteor.ttl;
      const alpha = t < 0.18 ? t / 0.18 : 1 - (t - 0.18) / 0.82;

      meteor.x += meteor.vx;
      meteor.y += meteor.vy;
      if (meteor.x < -140 || meteor.x > w + 140 || meteor.y > h + 140) { meteor = null; return; }

      const nx = meteor.x - meteor.vx * (meteor.len / 3);
      const ny = meteor.y - meteor.vy * (meteor.len / 3);
      const g = ctx.createLinearGradient(meteor.x, meteor.y, nx, ny);
      g.addColorStop(0, `rgba(226,222,255,${(0.75 * alpha).toFixed(3)})`);
      g.addColorStop(0.35, `rgba(124,77,255,${(0.3 * alpha).toFixed(3)})`);
      g.addColorStop(1, "rgba(124,77,255,0)");

      ctx.save();
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(meteor.x, meteor.y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ctx.restore();
    }

    function draw(time) {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const tw = reduced ? 1 : 0.7 + 0.3 * Math.sin(time / 1700 + s.phase);
        const py = parallax ? s.y - scrollY * 0.12 * s.depth : s.y;
        const y = ((py % h) + h) % h;

        /* هالة للّامعة وحدها — دايرة أوسع بشفافية واطية. */
        if (s.bright) {
          ctx.beginPath();
          ctx.arc(s.x, y, s.r * 3.2, 0, 6.2832);
          ctx.fillStyle = `rgba(${s.tint},${(s.a * tw * 0.13).toFixed(3)})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(s.x, y, s.r, 0, 6.2832);
        ctx.fillStyle = `rgba(${s.tint},${(s.a * tw).toFixed(3)})`;
        ctx.fill();

        if (!reduced) {
          s.x += 0.05 * s.depth;
          if (s.x > w + 3) s.x = -3;
        }
      }

      if (meteors && !reduced) {
        if (!meteor && time >= nextMeteorAt) {
          spawnMeteor(time);
          /* ⚠️ الفاصل بينحسب **عند الولادة** مش عند الانتهاء — وإلا كل شهاب
             بيزيح اللي بعده فبيتباعدوا بالتدريج. */
          nextMeteorAt = time + 7000 + Math.random() * 11000;
        }
        drawMeteor(time);
      }

      raf = requestAnimationFrame(draw);
    }

    build();
    if (reduced) {
      draw(0);
      if (raf) cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(draw);
    }

    let resizeTimer = null;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 180);
    };
    const onScroll = () => {
      scrollY = window.scrollY;
    };

    // بيوقف الرسم لما الصفحة تكون مخفية — ما في داعي نحرق بطارية
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        if (raf) cancelAnimationFrame(raf);
      } else if (!reduced) {
        running = true;
        raf = requestAnimationFrame(draw);
      }
    };

    window.addEventListener("resize", onResize);
    if (parallax) window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      if (parallax) window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density, parallax, meteors]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
