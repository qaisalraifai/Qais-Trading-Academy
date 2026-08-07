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
      background: "radial-gradient(ellipse at top, #101828 0%, #0C1220 60%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', sans-serif", direction: "rtl", padding: "2rem",
    }}>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
        
        {/* Logo */}
        <div style={{ position: "relative" }}>
          <div style={{
            width: 100, height: 100, borderRadius: "50%",
            border: "2px solid #C9A860",
            boxShadow: "0 0 30px #3E5478, 0 0 60px #26314A",
            overflow: "hidden",
          }}>
            <img src="/logo.jpg" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#C9A860", letterSpacing: 4, fontSize: 11, margin: "0 0 8px" }}>Q T A</p>
          <h1 style={{ color: "#fff", fontSize: 28, margin: "0 0 6px", fontWeight: 800 }}>تسجيل الدخول</h1>
          <p style={{ color: "#3E4761", fontSize: 14, margin: 0 }}>أهلاً بعودتك لأكاديمية Qais Trading</p>
        </div>

        {/* Card */}
        <div style={{
          width: "100%",
          background: "#111726",
          border: "1px solid #26314A",
          borderRadius: 0,
          padding: "2rem",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
            <div>
              <label style={{ color: "#5D6880", fontSize: 13, display: "block", marginBottom: 6 }}>البريد الإلكتروني</label>
              <input
                type="email" placeholder="example@email.com"
                value={email} onChange={e => setEmail(e.target.value)}
                style={{
                  width: "100%", background: "#080B14", border: "1px solid #1B2438",
                  color: "#fff", padding: "0.75rem 1rem", borderRadius: 3,
                  fontSize: 14, outline: "none", direction: "ltr", boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ color: "#5D6880", fontSize: 13, display: "block", marginBottom: 6 }}>كلمة المرور</label>
              <input
                type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                style={{
                  width: "100%", background: "#080B14", border: "1px solid #1B2438",
                  color: "#fff", padding: "0.75rem 1rem", borderRadius: 3,
                  fontSize: 14, outline: "none", direction: "ltr", boxSizing: "border-box",
                }}
              />
            </div>

            {error && <p style={{ color: "#E8495F", fontSize: 13, textAlign: "center", margin: 0 }}>{error}</p>}

            <button onClick={handleLogin} disabled={loading} style={{
              background: "linear-gradient(135deg, #C9A860, #9C7F42)",
              color: "#000", border: "none", borderRadius: 3,
              padding: "0.9rem", fontWeight: 700, fontSize: 15,
              cursor: "pointer", opacity: loading ? 0.7 : 1, marginTop: "0.5rem",
            }}>
              {loading ? "جاري الدخول..." : "تسجيل الدخول"}
            </button>
          </div>
        </div>

        <p style={{ color: "#3E4761", fontSize: 13 }}>
          ما عندك حساب؟{" "}
          <Link href="/signup" style={{ color: "#C9A860", textDecoration: "none" }}>اشترك الآن</Link>
        </p>
      </div>
    </div>
  );
}
