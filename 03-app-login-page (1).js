"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const fakeEmail = `${username.trim().toLowerCase()}@eduapp.local`;

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password,
    });

    if (loginError) {
      setError("اسم المستخدم أو كلمة المرور غير صحيحة");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div style={styles.container}>
      <form onSubmit={handleLogin} style={styles.form}>
        <h1 style={styles.title}>تسجيل الدخول</h1>

        <input
          style={styles.input}
          type="text"
          placeholder="اسم المستخدم"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <input
          style={styles.input}
          type="password"
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.button} type="submit" disabled={loading}>
          {loading ? "جاري الدخول..." : "تسجيل الدخول"}
        </button>

        <p style={styles.linkText}>
          ما عندك حساب؟ <a href="/signup">سجل الآن</a>
        </p>
      </form>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#0f0f0f",
    direction: "rtl",
    fontFamily: "system-ui, sans-serif",
  },
  form: {
    backgroundColor: "#1a1a1a",
    padding: "2rem",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "380px",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  title: { color: "#fff", textAlign: "center", marginBottom: "1rem" },
  input: {
    padding: "0.75rem",
    borderRadius: "8px",
    border: "1px solid #333",
    backgroundColor: "#0f0f0f",
    color: "#fff",
    fontSize: "1rem",
  },
  button: {
    padding: "0.75rem",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#10b981",
    color: "#fff",
    fontSize: "1rem",
    cursor: "pointer",
    fontWeight: "bold",
  },
  error: { color: "#ef4444", fontSize: "0.9rem", textAlign: "center" },
  linkText: { color: "#999", textAlign: "center", fontSize: "0.9rem" },
};
