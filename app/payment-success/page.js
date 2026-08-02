"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export default function PaymentSuccessPage() {
  const [status, setStatus] = useState("checking"); // "checking" | "active" | "timeout"
  const router = useRouter();
  const supabase = createClient();

  // نتحقق من تفعيل الاشتراك فعلياً (subscription_status = active) قبل ما نسمح بالدخول
  // هاد يحل مشكلة إنه الـ Webhook ممكن ياخد ثانية-ثانيتين حتى يحدّث القاعدة بعد الدفع مباشرة
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 15; // 15 محاولة × ثانية = 15 ثانية كحد أقصى

    const checkSubscription = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      // 🔍 تشخيص مؤقت — احذفيه بعد ما نحل المشكلة
      console.log("🔍 DEBUG user:", user ? { id: user.id, aud: user.aud, role: user.role } : null);
      console.log("🔍 DEBUG userError:", userError);

      if (!user) {
        setStatus("timeout");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("subscription_status")
        .eq("id", user.id)
        .maybeSingle();

      // 🔍 تشخيص مؤقت — احذفيه بعد ما نحل المشكلة
      console.log("🔍 DEBUG profile:", profile);
      console.log("🔍 DEBUG profileError:", profileError);

      if (profile?.subscription_status === "active") {
        setStatus("active");
        router.replace("/dashboard");
        return;
      }

      attempts += 1;
      if (attempts >= maxAttempts) {
        setStatus("timeout");
        return;
      }

      setTimeout(checkSubscription, 1000);
    };

    checkSubscription();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div style={s.page}>
      <div style={s.center}>
        {status !== "timeout" && <div style={s.spinner} />}

        {status === "timeout" && (
          <>
            <h1 style={s.timeoutTitle}>⚠️ التفعيل بياخد وقت أطول من المتوقع</h1>
            <p style={s.timeoutSub}>
              دفعتك وصلت، بس تفعيل الاشتراك بياخد شوي وقت زيادة. جربي تحدّثي الصفحة بعد دقيقة، أو تواصلي معنا لو استمرت المشكلة.
            </p>
            <button onClick={handleLogout} style={s.logoutBtn}>تسجيل الخروج</button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const gold = "#E8B86D";
const s = {
  page: { backgroundColor: "#0B0E11", minHeight: "100vh", direction: "rtl", fontFamily: "'Inter', sans-serif", color: "#EAECEF", display: "flex", alignItems: "center", justifyContent: "center" },
  center: { display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem", padding: "2rem", textAlign: "center", maxWidth: "420px" },
  spinner: {
    width: "40px", height: "40px",
    border: `3px solid #2B2F36`,
    borderTopColor: gold,
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  timeoutTitle: { fontSize: "1.3rem", fontWeight: 800, lineHeight: 1.3 },
  timeoutSub: { color: "#777", fontSize: "0.95rem", lineHeight: 1.75 },
  logoutBtn: { background: "none", border: "1px solid #222", color: "#999", padding: "0.6rem 1.4rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" },
};
