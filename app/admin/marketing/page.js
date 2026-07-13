"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { gold } from "../styles";

const TYPES = [
  { v: "logo", label: "شعار" },
  { v: "banner", label: "بانر" },
  { v: "video", label: "فيديو" },
  { v: "copy", label: "نص جاهز" },
];

export default function AdminMarketingPage() {
  const supabase = createClient();
  const router = useRouter();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", type: "banner", file_url: "", thumbnail_url: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    checkAdmin();
    load();
  }, []);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") router.push("/dashboard");
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/marketing-assets");
      const json = await res.json();
      setAssets(json.assets || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    if (!form.title.trim() || !form.file_url.trim()) { setError("العنوان والرابط مطلوبين"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/marketing-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "حدث خطأ");
      setForm({ title: "", type: "banner", file_url: "", thumbnail_url: "", description: "" });
      await load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("حذف هاد الملف من المكتبة؟")) return;
    await fetch("/api/admin/marketing-assets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  return (
    <div style={s.page}>
      <h1 style={s.title}>مكتبة Marketing Kit</h1>
      <p style={s.sub}>
        أضف رابط لكل شعار/بانر/فيديو (ارفعه أول شي على Supabase Storage أو أي مكان استضافة، وحط الرابط هون).
        رح تظهر تلقائياً بصفحة كل المسوّقين المفعّلين.
      </p>

      {error && <div style={s.error}>{error}</div>}

      <form onSubmit={handleAdd} style={s.form}>
        <input style={s.input} placeholder="العنوان" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <select style={s.input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
        </select>
        <input style={s.input} placeholder="رابط الملف (file_url)" value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} />
        <input style={s.input} placeholder="رابط صورة مصغّرة (اختياري)" value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} />
        <input style={s.input} placeholder="وصف قصير (اختياري)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button type="submit" disabled={saving} style={s.btn}>{saving ? "جاري الإضافة..." : "إضافة"}</button>
      </form>

      {loading ? (
        <p style={{ color: "#666" }}>جاري التحميل...</p>
      ) : (
        <div style={s.grid}>
          {assets.map((a) => (
            <div key={a.id} style={s.card}>
              <p style={s.cardTitle}>{a.title}</p>
              <p style={s.cardType}>{TYPES.find((t) => t.v === a.type)?.label || a.type}</p>
              <a href={a.file_url} target="_blank" rel="noreferrer" style={s.link}>معاينة الملف ↗</a>
              <button onClick={() => handleDelete(a.id)} style={s.deleteBtn}>حذف</button>
            </div>
          ))}
          {assets.length === 0 && <p style={{ color: "#555" }}>ما في ملفات لسا.</p>}
        </div>
      )}
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#000000", direction: "rtl", fontFamily: "'Inter', sans-serif", color: "#FFFFFF", padding: "2.5rem 1.5rem", maxWidth: 1000, margin: "0 auto" },
  title: { fontSize: "1.6rem", fontWeight: 800, marginBottom: 6, color: gold },
  sub: { color: "#8a8378", fontSize: "0.88rem", marginBottom: "1.8rem", lineHeight: 1.7 },
  error: { background: "#2a0d0d", border: "1px solid #ef444444", color: "#ef4444", padding: "0.7rem 1rem", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" },
  form: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.7rem", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 12, padding: "1.2rem", marginBottom: "2rem" },
  input: { background: "#080808", border: "1px solid #1a1a1a", color: "#FFFFFF", padding: "0.7rem 0.9rem", borderRadius: 6, fontSize: "0.85rem" },
  btn: { background: gold, color: "#080600", border: "none", padding: "0.7rem 1.2rem", borderRadius: 6, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", gridColumn: "1 / -1" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" },
  card: { background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 10, padding: "1.1rem" },
  cardTitle: { fontWeight: 700, fontSize: "0.9rem", marginBottom: 4 },
  cardType: { color: "#7A7A7A", fontSize: "0.75rem", marginBottom: 10 },
  link: { color: gold, fontSize: "0.8rem", textDecoration: "none", display: "block", marginBottom: 10 },
  deleteBtn: { background: "transparent", border: "1px solid #ef444455", color: "#ef4444", padding: "0.4rem 0.8rem", borderRadius: 6, fontSize: "0.75rem", cursor: "pointer" },
};
