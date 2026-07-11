"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import Link from "next/link";

const emptyForm = {
  title: "", description: "", driveLink: "", order_index: "",
  course_id: "", chapter: "", chapter_order: "", duration_minutes: "",
  difficulty: "", practice_type: "",
};

const DIFFICULTY_OPTIONS = [
  { value: "", label: "بدون تحديد" },
  { value: "beginner", label: "🟢 مبتدئ" },
  { value: "intermediate", label: "🟡 متوسط" },
  { value: "advanced", label: "🔴 متقدم" },
];

const PRACTICE_OPTIONS = [
  { value: "", label: "بدون تمرين تطبيقي" },
  { value: "support_resistance", label: "الدعم والمقاومة" },
  { value: "fvg", label: "FVG" },
  { value: "order_block", label: "Order Block" },
  { value: "bos_choch", label: "BOS / CHOCH" },
  { value: "custom", label: "تمرين مخصص آخر" },
];

export default function AdminLecturesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [lectures, setLectures] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    checkAdmin();
    fetchLectures();
    fetchCourses();
  }, []);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") router.push("/dashboard");
  }

  async function fetchLectures() {
    setLoading(true);
    const res = await fetch("/api/admin/lectures");
    const data = await res.json();
    if (res.ok) setLectures(data.lectures || []);
    else setError(data.error || "صار خطأ بجلب المحاضرات");
    setLoading(false);
  }

  async function fetchCourses() {
    const res = await fetch("/api/admin/courses");
    const data = await res.json();
    if (res.ok) setCourses(data.courses || []);
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEditForm(lecture) {
    setEditingId(lecture.id);
    setForm({
      title: lecture.title || "",
      description: lecture.description || "",
      driveLink: lecture.youtube_video_id || "",
      order_index: lecture.order_index ?? "",
      course_id: lecture.course_id || "",
      chapter: lecture.chapter || "",
      chapter_order: lecture.chapter_order ?? "",
      duration_minutes: lecture.duration_seconds ? Math.round(lecture.duration_seconds / 60 * 10) / 10 : "",
      difficulty: lecture.difficulty || "",
      practice_type: lecture.practice_type || "",
    });
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const url = editingId ? `/api/admin/lectures/${editingId}` : "/api/admin/lectures";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "صار خطأ، حاولي مرة تانية");
      setSaving(false);
      return;
    }

    setSaving(false);
    closeForm();
    fetchLectures();
  }

  async function handleDelete(id, title) {
    if (!confirm(`متأكدة إنك بدك تحذفي محاضرة "${title}"؟ هالإجراء ما ممكن يترجع.`)) return;
    const res = await fetch(`/api/admin/lectures/${id}`, { method: "DELETE" });
    if (res.ok) fetchLectures();
    else {
      const data = await res.json();
      alert(data.error || "صار خطأ بالحذف");
    }
  }

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <header style={s.header}>
        <div>
          <p style={s.headerSub}>لوحة التحكم</p>
          <h1 style={s.headerTitle}>إدارة المحاضرات</h1>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link href="/admin" style={s.backBtn}>← رجوع للمشتركين</Link>
          <button onClick={openAddForm} style={s.addBtn}>+ إضافة محاضرة</button>
        </div>
      </header>

      {showForm && (
        <div style={s.overlay} onClick={closeForm}>
          <form style={s.formCard} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <h2 style={s.formTitle}>{editingId ? "تعديل محاضرة" : "إضافة محاضرة جديدة"}</h2>

            <label style={s.label}>عنوان المحاضرة</label>
            <input
              style={s.input}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="مثلاً: مقدمة في تحليل الشموع اليابانية"
              required
            />

            <label style={s.label}>رابط Google Drive</label>
            <input
              style={s.input}
              value={form.driveLink}
              onChange={(e) => setForm({ ...form, driveLink: e.target.value })}
              placeholder="https://drive.google.com/file/d/XXXXXXXX/view"
              required
            />
            <p style={s.hint}>حطي رابط المشاركة تبع الملف من Drive، أو الـ File ID مباشرة.</p>

            <label style={s.label}>الوصف (اختياري)</label>
            <textarea
              style={{ ...s.input, minHeight: "80px", resize: "vertical" }}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="وصف مختصر للمحاضرة..."
            />

            <label style={s.label}>الكورس</label>
            <select
              style={s.input}
              value={form.course_id}
              onChange={(e) => setForm({ ...form, course_id: e.target.value })}
            >
              <option value="">بدون تحديد</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.title}</option>
              ))}
            </select>

            <label style={s.label}>الفصل (Chapter)</label>
            <input
              style={s.input}
              value={form.chapter}
              onChange={(e) => setForm({ ...form, chapter: e.target.value })}
              placeholder="مثلاً: أساسيات الفوركس، Order Blocks..."
            />

            <label style={s.label}>ترتيب الفصل (اختياري)</label>
            <input
              type="number"
              style={s.input}
              value={form.chapter_order}
              onChange={(e) => setForm({ ...form, chapter_order: e.target.value })}
              placeholder="يحدد ترتيب ظهور الفصل ضمن الكورس"
            />

            <label style={s.label}>مدة الفيديو (بالدقائق)</label>
            <input
              type="number"
              step="0.1"
              style={s.input}
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
              placeholder="مثلاً: 12.5"
            />

            <label style={s.label}>مستوى الصعوبة</label>
            <select
              style={s.input}
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
            >
              {DIFFICULTY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>

            <label style={s.label}>التطبيق العملي بعد الدرس</label>
            <select
              style={s.input}
              value={form.practice_type}
              onChange={(e) => setForm({ ...form, practice_type: e.target.value })}
            >
              {PRACTICE_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            <label style={s.label}>الترتيب العام (اختياري)</label>
            <input
              type="number"
              style={s.input}
              value={form.order_index}
              onChange={(e) => setForm({ ...form, order_index: e.target.value })}
              placeholder="بيتحدد تلقائي إذا تركتيه فاضي"
            />

            {error && <p style={s.errorText}>{error}</p>}

            <div style={s.formActions}>
              <button type="button" onClick={closeForm} style={s.cancelBtn}>إلغاء</button>
              <button type="submit" disabled={saving} style={s.saveBtn}>
                {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة المحاضرة"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={s.tableWrap}>
        {loading ? (
          <p style={s.loading}>جاري التحميل...</p>
        ) : lectures.length === 0 ? (
          <p style={s.loading}>لا يوجد محاضرات بعد. دوسي "+ إضافة محاضرة" حتى تبدأي.</p>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {["الترتيب", "العنوان", "الكورس", "الفصل", "الصعوبة", "إجراءات"].map((h, i) => (
                  <th key={i} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lectures.map((lecture) => {
                const course = courses.find((c) => c.id === lecture.course_id);
                const diff = DIFFICULTY_OPTIONS.find((d) => d.value === lecture.difficulty);
                return (
                  <tr key={lecture.id} style={s.tr}>
                    <td style={s.td}><span style={s.mono}>{lecture.order_index}</span></td>
                    <td style={s.td}><span style={s.username}>{lecture.title}</span></td>
                    <td style={s.td}><span style={s.mono}>{course ? `${course.icon} ${course.title}` : "—"}</span></td>
                    <td style={s.td}><span style={s.mono}>{lecture.chapter || "—"}</span></td>
                    <td style={s.td}><span style={s.mono}>{diff?.value ? diff.label : "—"}</span></td>
                    <td style={s.td}>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={() => openEditForm(lecture)} style={s.btnEdit}>تعديل</button>
                        <button onClick={() => handleDelete(lecture.id, lecture.title)} style={s.btnDanger}>حذف</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const gold = "#C9A24B";
const ink = "#050505";
const s = {
  page: { backgroundColor: ink, color: "#E8E0D0", direction: "rtl", fontFamily: "'Inter', sans-serif", minHeight: "100vh", padding: "0 0 4rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2rem 3rem", borderBottom: "1px solid #141414" },
  headerSub: { fontFamily: "'JetBrains Mono', monospace", color: gold, fontSize: "0.75rem", letterSpacing: "2px", marginBottom: "0.25rem" },
  headerTitle: { fontSize: "1.4rem", fontWeight: 800 },
  backBtn: { background: "none", border: "1px solid #222", color: "#999", padding: "0.6rem 1.2rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", textDecoration: "none", display: "flex", alignItems: "center" },
  addBtn: { backgroundColor: gold, color: "#000", border: "none", padding: "0.6rem 1.2rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 700 },
  tableWrap: { margin: "2rem 3rem", border: "1px solid #111", borderRadius: "4px", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { backgroundColor: "#0a0a0a", padding: "1rem 1.25rem", textAlign: "right", fontSize: "0.78rem", color: "#444", fontWeight: 500, borderBottom: "1px solid #111" },
  tr: { borderBottom: "1px solid #0d0d0d" },
  td: { padding: "1rem 1.25rem", fontSize: "0.88rem", verticalAlign: "middle" },
  username: { color: "#E8E0D0", fontWeight: 500 },
  mono: { fontFamily: "'JetBrains Mono', monospace", color: "#555", fontSize: "0.82rem" },
  btnEdit: { backgroundColor: "#1a2a3a", color: "#5b9bd5", border: "1px solid #2a3a5a", padding: "0.4rem 0.9rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.82rem" },
  btnDanger: { backgroundColor: "#2a1a1a", color: "#ef5350", border: "1px solid #4a2a2a", padding: "0.4rem 0.9rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.82rem" },
  loading: { textAlign: "center", padding: "3rem", color: "#444" },
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" },
  formCard: { backgroundColor: "#0d0d0d", border: `1px solid ${gold}44`, borderRadius: "8px", padding: "2rem", width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "90vh", overflowY: "auto" },
  formTitle: { fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.75rem" },
  label: { fontSize: "0.82rem", color: "#999", marginTop: "0.75rem" },
  input: { backgroundColor: "#141414", border: "1px solid #222", color: "#E8E0D0", padding: "0.7rem 0.9rem", borderRadius: "4px", fontSize: "0.9rem", outline: "none", fontFamily: "inherit" },
  hint: { fontSize: "0.75rem", color: "#555", marginTop: "0.15rem" },
  errorText: { color: "#ef5350", fontSize: "0.85rem", marginTop: "0.5rem" },
  formActions: { display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" },
  cancelBtn: { background: "none", border: "1px solid #222", color: "#999", padding: "0.6rem 1.4rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" },
  saveBtn: { backgroundColor: gold, color: "#000", border: "none", padding: "0.6rem 1.4rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 700 },
};
