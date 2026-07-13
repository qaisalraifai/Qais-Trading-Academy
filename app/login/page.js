"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) { setError("الإيميل أو كلمة المرور غلط"); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    // تسجيل IP/الجهاز/الـ Timeline من السيرفر — ما بيوقف تسجيل الدخول لو فشل
    fetch("/api/log-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    }).catch(() => {});
    router.push("/dashboard");
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #1a1608 0%, #141414 60%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', sans-serif", direction: "rtl", padding: "2rem",
    }}>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
        
        {/* Logo */}
        <div style={{ position: "relative" }}>
          <div style={{
            width: 100, height: 100, borderRadius: "50%",
            border: "2px solid #D4AF37",
            boxShadow: "0 0 30px #D4AF3755, 0 0 60px #D4AF3722",
            overflow: "hidden",
          }}>
            <img src="/logo.jpg" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#D4AF37", letterSpacing: 4, fontSize: 11, margin: "0 0 8px" }}>Q T A</p>
          <h1 style={{ color: "#fff", fontSize: 28, margin: "0 0 6px", fontWeight: 800 }}>تسجيل الدخول</h1>
          <p style={{ color: "#555", fontSize: 14, margin: 0 }}>أهلاً بعودتك لأكاديمية Qais Trading</p>
        </div>

        {/* Card */}
        <div style={{
          width: "100%",
          background: "linear-gradient(145deg, #111108, #0d0d0d)",
          border: "1px solid #D4AF3733",
          borderRadius: 16,
          padding: "2rem",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
            <div>
              <label style={{ color: "#888", fontSize: 13, display: "block", marginBottom: 6 }}>البريد الإلكتروني</label>
              <input
                type="email" placeholder="example@email.com"
                value={email} onChange={e => setEmail(e.target.value)}
                style={{
                  width: "100%", background: "#080808", border: "1px solid #222",
                  color: "#fff", padding: "0.75rem 1rem", borderRadius: 8,
                  fontSize: 14, outline: "none", direction: "ltr", boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ color: "#888", fontSize: 13, display: "block", marginBottom: 6 }}>كلمة المرور</label>
              <input
                type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                style={{
                  width: "100%", background: "#080808", border: "1px solid #222",
                  color: "#fff", padding: "0.75rem 1rem", borderRadius: 8,
                  fontSize: 14, outline: "none", direction: "ltr", boxSizing: "border-box",
                }}
              />
            </div>

            {error && <p style={{ color: "#FF4D4F", fontSize: 13, textAlign: "center", margin: 0 }}>{error}</p>}

            <button onClick={handleLogin} disabled={loading} style={{
              background: "linear-gradient(135deg, #D4AF37, #9C7A22)",
              color: "#000", border: "none", borderRadius: 8,
              padding: "0.9rem", fontWeight: 700, fontSize: 15,
              cursor: "pointer", opacity: loading ? 0.7 : 1, marginTop: "0.5rem",
            }}>
              {loading ? "جاري الدخول..." : "تسجيل الدخول"}
            </button>
          </div>
        </div>

        <p style={{ color: "#444", fontSize: 13 }}>
          ما عندك حساب؟{" "}
          <Link href="/signup" style={{ color: "#D4AF37", textDecoration: "none" }}>اشترك الآن</Link>
        </p>
      </div>
    </div>
  );
}
