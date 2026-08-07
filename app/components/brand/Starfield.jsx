"use client";

import { useEffect, useRef } from "react";

/* ============================================================================
   Starfield — حقل نجوم على Canvas.
   ----------------------------------------------------------------------------
   ليش Canvas مش SVG/CSS: مئات النقاط المتحرّكة بـDOM بتقتل الأداء. الكانفس
   بيرسمهم بطبقة واحدة، وبيوقف كلياً لما الصفحة تكون برّا الشاشة.

   الحركة انجراف بطيء جداً + وميض خفيف — مش "نجوم تلمع". الهدف عمق، مش لفت نظر.
   بيحترم prefers-reduced-motion: بيرسم إطار ثابت وبيوقف.
   ============================================================================ */

export default function Starfield({ density = 1, className, parallax = true }) {
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
    }

    function draw(time) {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const tw = reduced ? 1 : 0.78 + 0.22 * Math.sin(time / 1700 + s.phase);
        const py = parallax ? s.y - scrollY * 0.12 * s.depth : s.y;
        const y = ((py % h) + h) % h;

        ctx.beginPath();
        ctx.arc(s.x, y, s.r, 0, 6.2832);
        ctx.fillStyle = `rgba(${s.tint},${(s.a * tw).toFixed(3)})`;
        ctx.fill();

        if (!reduced) {
          s.x += 0.035 * s.depth;
          if (s.x > w + 3) s.x = -3;
        }
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
  }, [density, parallax]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
