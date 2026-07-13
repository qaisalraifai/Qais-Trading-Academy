"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export default function ChoosePage() {
  const [logoY, setLogoY] = useState(0);
  const router = useRouter();
  const supabase = createClient();

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
      background: "radial-gradient(ellipse at top, #1a1608 0%, #0a0a0a 60%)",
      direction: "rtl",
      fontFamily: "'Segoe UI', sans-serif",
      color: "#fff",
      overflowX: "hidden",
    }}>
      {/* Header */}
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "1.2rem 2rem", borderBottom: "1px solid #1a1a0a",
      }}>
        <button onClick={handleLogout} style={{
          background: "none", border: "1px solid #333", color: "#666",
          padding: "0.5rem 1rem", borderRadius: 6, cursor: "pointer", fontSize: 13,
        }}>تسجيل الخروج</button>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: 14, color: "#ccc" }}>Qais Trading Academy</span>
          <img src="/logo.jpg" style={{ height: 34, borderRadius: "50%" }} />
        </div>
      </header>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 2rem", textAlign: "center" }}>
        
        {/* Animated Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
          <div style={{
            width: 110, height: 110, borderRadius: "50%",
            border: "2px solid #D4AF37",
            boxShadow: "0 0 40px #D4AF3744, 0 0 80px #D4AF3722",
            overflow: "hidden",
            transform: `translateY(${logoY}px)`,
            transition: "transform 0.1s ease-out",
          }}>
            <img src="/logo.jpg" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>

        <p style={{ color: "#D4AF37", letterSpacing: 4, fontSize: 11, margin: "0 0 12px" }}>QAIS TRADING ACADEMY</p>
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 900, margin: "0 0 8px" }}>
          👋 بك مرحبياً Samer
        </h1>
        <p style={{ color: "#555", fontSize: 15, margin: "0 0 3rem" }}>من أين تبدأ جلستك اليوم؟</p>

        {/* Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          
          {/* Backtest */}
          <div onClick={() => router.push("/backtest")} style={{
            background: "linear-gradient(145deg, #111108, #0A0A0A)",
            border: "1px solid #D4AF3733",
            borderRadius: 16, padding: "2.5rem 2rem",
            cursor: "pointer", textAlign: "right",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            transition: "border-color 0.3s",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#D4AF37", margin: "0 0 12px" }}>Backtest</h2>
            <p style={{ color: "#555", fontSize: 14, lineHeight: 1.75, margin: "0 0 20px" }}>
              اختبر استراتيجياتك على بيانات تاريخية حقيقية وقِس أداءك بدقة.
            </p>
            <div style={{ color: "#D4AF37", fontSize: 13, fontWeight: 600 }}>افتح البرنامج ←</div>
          </div>

          {/* المحاضرات */}
          <div onClick={() => router.push("/dashboard")} style={{
            background: "linear-gradient(145deg, #111108, #0A0A0A)",
            border: "1px solid #D4AF3733",
            borderRadius: 16, padding: "2.5rem 2rem",
            cursor: "pointer", textAlign: "right",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            transition: "border-color 0.3s",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#D4AF37", margin: "0 0 12px" }}>المحاضرات</h2>
            <p style={{ color: "#555", fontSize: 14, lineHeight: 1.75, margin: "0 0 20px" }}>
              وصول كامل لمكتبة المحاضرات المسجلة، الكورسات المرتبة، والاختبارات.
            </p>
            <div style={{ color: "#D4AF37", fontSize: 13, fontWeight: 600 }}>ابدأ التعلم ←</div>
          </div>

        </div>
      </div>
    </div>
  );
}
