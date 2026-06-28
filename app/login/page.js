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

    if (loginError) {
      setError("الإيميل أو كلمة المرور غلط");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={s.card}>
        <p style={s.eyebrow}>QTA</p>
        <h1 style={s.title}>تسجيل الدخول</h1>
        <p style={s.sub}>أهلاً بعودتك لأكاديمية Qais Trading</p>

        <div style={s.form}>
          <div style={s.field}>
            <label style={s.label}>البريد الإلكتروني</label>
            <input
              style={s.input}
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>كلمة المرور</label>
            <input
              style={s.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button onClick={handleLogin} disabled={loading} style={s.btn}>
            {loading ? "جاري الدخول..." : "تسجيل الدخول"}
          </button>
        </div>

        <p style={s.linkText}>ما عندك حساب؟ <Link href="/signup" style={s.link}>اشترك الآن</Link></p>
      </div>
    </div>
  );
}

const gold = "#C9A24B";
const s = {
  page: { backgroundColor: "#050505", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", direction: "rtl", fontFamily: "'Inter', sans-serif", padding: "2rem" },
  card: { backgroundColor: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "3rem 2.5rem", width: "100%", maxWidth: "420px" },
  eyebrow: { fontFamily: "'JetBrains Mono', monospace", color: gold, fontSize: "0.75rem", letterSpacing: "3px", marginBottom: "1rem", textAlign: "center" },
  title: { fontSize: "1.75rem", fontWeight: 800, color: "#E8E0D0", textAlign: "center", marginBottom: "0.5rem" },
  sub: { color: "#555", fontSize: "0.9rem", textAlign: "center", marginBottom: "2rem" },
  form: { display: "flex", flexDirection: "column", gap: "1.25rem" },
  field: { display: "flex", flexDirection: "column", gap: "0.4rem" },
  label: { color: "#888", fontSize: "0.82rem" },
  input: { backgroundColor: "#080808", border: "1px solid #1e1e1e", color: "#E8E0D0", padding: "0.75rem 1rem", borderRadius: "4px", fontSize: "0.95rem", outline: "none", direction: "ltr", textAlign: "right" },
  btn: { backgroundColor: gold, color: "#080600", padding: "0.9rem", borderRadius: "4px", border: "none", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", marginTop: "0.5rem" },
  error: { color: "#ef4444", fontSize: "0.85rem", textAlign: "center" },
  linkText: { color: "#444", fontSize: "0.85rem", textAlign: "center", marginTop: "1.5rem" },
  link: { color: gold, textDecoration: "none" },
};
