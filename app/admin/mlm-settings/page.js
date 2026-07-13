"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { gold, s, glass, transition } from "../styles";

export default function MlmSettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState(null);
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    checkAdmin();
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") router.push("/dashboard");
  }

  async function fetchSettings() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/mlm-settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل التحميل");
      setSettings(data.settings || []);
      const initialDrafts = {};
      (data.settings || []).forEach((row) => (initialDrafts[row.key] = row.value));
      setDrafts(initialDrafts);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveSetting(key) {
    setSavingKey(key);
    setError("");
    try {
      const res = await fetch("/api/admin/mlm-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: Number(drafts[key]) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحفظ");
      await fetchSettings();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={s.header}>
        <div>
          <div style={s.headerSub}>QAIS TRADING ACADEMY — إدارة</div>
          <div style={s.headerTitle}>⚙️ إعدادات خطة العمولات (MLM)</div>
        </div>
        <a href="/admin" style={{ color: gold, textDecoration: "none", fontSize: "0.85rem" }}>
          ← رجوع للوحة الأدمن
        </a>
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>
          كل المبالغ والنسب هون بتتحكم مباشرة بمحرك العمولات — أي تعديل بينطبق فورًا على أول عملية جاية
        </div>

        {error && (
          <div style={{ color: "#FF4D4F", marginBottom: "1rem", fontSize: "0.85rem" }}>{error}</div>
        )}

        {loading ? (
          <div style={{ color: "#888", padding: "2rem 0" }}>جاري التحميل...</div>
        ) : (
          <div style={{ display: "grid", gap: "1rem", maxWidth: 640 }}>
            {settings.map((row) => (
              <div
                key={row.key}
                style={{
                  ...glass,
                  padding: "1.2rem 1.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{row.label_ar}</div>
                  <div style={{ fontSize: "0.75rem", color: "#777", fontFamily: "monospace" }}>{row.key}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <input
                    type="number"
                    step="0.01"
                    value={drafts[row.key] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [row.key]: e.target.value }))}
                    style={{
                      width: 100,
                      padding: "0.5rem 0.7rem",
                      borderRadius: 8,
                      border: "1px solid #2a2a2a",
                      background: "#0d0d0c",
                      color: "#F5F5F5",
                      textAlign: "center",
                      fontFamily: "monospace",
                    }}
                  />
                  <button
                    onClick={() => saveSetting(row.key)}
                    disabled={savingKey === row.key || Number(drafts[row.key]) === Number(row.value)}
                    style={{
                      background: gold,
                      color: "#111",
                      border: "none",
                      borderRadius: 8,
                      padding: "0.55rem 1.1rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: savingKey === row.key ? 0.6 : 1,
                      transition,
                    }}
                  >
                    {savingKey === row.key ? "جاري الحفظ..." : "حفظ"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: "2rem", fontSize: "0.8rem", color: "#666", maxWidth: 640, lineHeight: 1.8 }}>
          ⚠️ نسبة Infinity Bonus وآلية توزيع Leadership Pool لسا مبنية على افتراضات
          مبدئية (مو محددة حرفيًا بخطة المشروع) — راجعيها قبل تفعيل مبالغ حقيقية.
        </div>
      </div>
    </div>
  );
}
