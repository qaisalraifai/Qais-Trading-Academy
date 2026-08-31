"use client";
import { BarChart3, GraduationCap } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export default function ChoosePage() {
  const [logoY, setLogoY] = useState(0);
  const [username, setUsername] = useState("");
  const router = useRouter();
  const supabase = createClient();

  /* اسم المستخدم للتحية. ⚠️ الفشل بينتجاهل بصمت عن قصد: التحية زينة،
     وما بتستاهل تعطّل الصفحة ولا تطلّع خطأ. بلا اسم بتصير «مرحباً بك». */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from("profiles").select("username").eq("id", user.id).single();
        if (alive && profile?.username) setUsername(profile.username);
      } catch { /* التحية بلا اسم */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let frame;
    let start = null;
    const animate = (ts) => {
      if (!start) start = ts;
      setLogoY(Math.sin((ts - start) / 1000) * 8);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div style={{
      minHeight: "100vh",
      /* ⚠️ **بلا خلفية ولا خط مفروض.** كانت `radial-gradient(ellipse at
         top…)` معتمة بترسم فوق طبقة الفضاء فتحجبها بالكامل، و`Segoe UI`
         مش خط المنصّة — فكانت الصفحة تقطع الرحلة البصرية مرتين.
         الخط بينورث من الجسم، والخلفية بتجي من `SpaceBackdrop`. */
      direction: "rtl",
      color: "#fff",
      overflowX: "hidden",
    }}>
      {/* Header */}
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "1.2rem 2rem", borderBottom: "1px solid #1E1836",
      }}>
        <button onClick={handleLogout} style={{
          background: "none", border: "1px solid #2A2145", color: "#6E6690",
          padding: "0.5rem 1rem", borderRadius: 3, cursor: "pointer", fontSize: 13,
        }}>تسجيل الخروج</button>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: 14, color: "#A79FC4" }}>Qais Trading Academy</span>
          <img src="/logo.svg" style={{ height: 34, borderRadius: "50%" }} />
        </div>
      </header>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 2rem", textAlign: "center" }}>
        
        {/* Animated Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
          <div style={{
            width: 110, height: 110, borderRadius: "50%",
            border: "2px solid #DCD4F7",
            boxShadow: "0 0 40px #3D2F63, 0 0 80px #2A2145",
            overflow: "hidden",
            transform: `translateY(${logoY}px)`,
            transition: "transform 0.1s ease-out",
          }}>
            <img src="/logo.svg" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>

        <p style={{ color: "#DCD4F7", letterSpacing: 4, fontSize: 11, margin: "0 0 12px" }}>QAIS TRADING ACADEMY</p>
        {/* ═══════════════════════════════════════════════════════════════
            🔴 **كان مكتوباً: «بك مرحبياً Samer»** — اسم ثابت بالكود بيظهر
            لكل مستخدم، وكلمتان مقلوبتان («بك مرحبياً» بدل «مرحباً بك»).
            الصفحة ما بتجيب بروفايل أصلاً فما كان في مصدر للاسم.
            صار بينجلب من `profiles` زي باقي المنصّة، وبيرجع لتحية بلا اسم
            لو ما وصل — أحسن من اسم غلط.
            ═══════════════════════════════════════════════════════════════ */}
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 900, margin: "0 0 8px" }}>
          {username ? `مرحباً بك ${username}` : "مرحباً بك"}
        </h1>
        <p style={{ color: "#4A4368", fontSize: 15, margin: "0 0 3rem" }}>من أين تبدأ جلستك اليوم؟</p>

        {/* Cards */}
        {/* ⚠️ كان `"1fr 1fr"` ثابتاً — عمودان مهما ضاقت الشاشة، فبينضغط
            الكرتان على الموبايل. `auto-fit` بينزّل لعمود واحد لحاله. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem" }}>
          
          {/* Backtest */}
          <div onClick={() => router.push("/backtest")} style={{
            background: "#141024",
            border: "1px solid #2A2145",
            borderRadius: 0, padding: "2.5rem 2rem",
            cursor: "pointer", textAlign: "right",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            transition: "border-color 0.3s",
          }}>
            {/* ⚠️ كان `fontSize: 48` على الغلاف و`size={14}` على الأيقونة —
                والأيقونة SVG فما بيمسّها حجم الخط. فطلعت ٤ مرات أصغر من
                المقصود. الحجم صار على الأيقونة نفسها. */}
            <div style={{ marginBottom: 16, color: "#DCD4F7" }}><BarChart3 size={34} strokeWidth={1.7} aria-hidden /></div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#DCD4F7", margin: "0 0 12px" }}>Backtest</h2>
            <p style={{ color: "#4A4368", fontSize: 14, lineHeight: 1.75, margin: "0 0 20px" }}>
              اختبر استراتيجياتك على بيانات تاريخية حقيقية وقِس أداءك بدقة.
            </p>
            <div style={{ color: "#DCD4F7", fontSize: 13, fontWeight: 600 }}>افتح البرنامج ←</div>
          </div>

          {/* المحاضرات */}
          <div onClick={() => router.push("/dashboard")} style={{
            background: "#141024",
            border: "1px solid #2A2145",
            borderRadius: 0, padding: "2.5rem 2rem",
            cursor: "pointer", textAlign: "right",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            transition: "border-color 0.3s",
          }}>
            <div style={{ marginBottom: 16, color: "#DCD4F7" }}><GraduationCap size={34} strokeWidth={1.7} aria-hidden /></div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#DCD4F7", margin: "0 0 12px" }}>المحاضرات</h2>
            <p style={{ color: "#4A4368", fontSize: 14, lineHeight: 1.75, margin: "0 0 20px" }}>
              وصول كامل لمكتبة المحاضرات المسجلة، الكورسات المرتبة، والاختبارات.
            </p>
            <div style={{ color: "#DCD4F7", fontSize: 13, fontWeight: 600 }}>ابدأ التعلم ←</div>
          </div>

        </div>
      </div>
    </div>
  );
}
