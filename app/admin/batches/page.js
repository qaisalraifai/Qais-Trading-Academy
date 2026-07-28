"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import Link from "next/link";

const emptyForm = {
  course_id: "", name: "", instructor_id: "", start_date: "", end_date: "", seats_total: "",
};

export default function AdminBatchesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [transferBatch, setTransferBatch] = useState(null); // الدفعة المصدر
  const [transferStudents, setTransferStudents] = useState([]);
  const [transferStudentId, setTransferStudentId] = useState("");
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferError, setTransferError] = useState("");
  const [transferSaving, setTransferSaving] = useState(false);

  useEffect(() => {
    checkAdmin();
    fetchCourses();
  }, []);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    const url = selectedCourseId ? `/api/admin/batches?course_id=${selectedCourseId}` : "/api/admin/batches";
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) {
      setBatches(data.batches || []);
      setInstructors(data.instructors || []);
    } else {
      setError(data.error || "صار خطأ بجلب الدفعات");
    }
    setLoading(false);
  }, [selectedCourseId]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") router.push("/dashboard");
  }

  async function fetchCourses() {
    const res = await fetch("/api/admin/courses");
    const data = await res.json();
    if (res.ok) setCourses(data.courses || []);
  }

  function courseLabel(courseId) {
    const c = courses.find((c) => c.id === courseId);
    return c ? `${c.icon} ${c.title}` : "—";
  }

  function openAddForm() {
    setEditingId(null);
    setForm({ ...emptyForm, course_id: selectedCourseId || "" });
    setError("");
    setShowForm(true);
  }

  function openEditForm(batch) {
    setEditingId(batch.id);
    setForm({
      course_id: batch.course_id,
      name: batch.name || "",
      instructor_id: batch.instructor_id || "",
      start_date: batch.start_date || "",
      end_date: batch.end_date || "",
      seats_total: batch.seats_total ?? "",
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

    const url = editingId ? `/api/admin/batches/${editingId}` : "/api/admin/batches";
    const method = editingId ? "PUT" : "POST";
    const payload = editingId
      ? { name: form.name, instructor_id: form.instructor_id || null, start_date: form.start_date || null, end_date: form.end_date || null, seats_total: form.seats_total || null }
      : { ...form, instructor_id: form.instructor_id || null, seats_total: form.seats_total || null };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "صار خطأ، حاولي مرة تانية");
      setSaving(false);
      return;
    }

    setSaving(false);
    closeForm();
    fetchBatches();
  }

  async function runAction(batchId, action, payload = {}) {
    const res = await fetch(`/api/admin/batches/${batchId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "صار خطأ بتنفيذ الإجراء");
      return;
    }
    fetchBatches();
  }

  async function handleDelete(batch) {
    if (!confirm(`متأكدة إنك بدك تحذفي دفعة "${batch.name}"؟ هالإجراء ما ممكن يترجع.`)) return;
    const res = await fetch(`/api/admin/batches/${batch.id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) fetchBatches();
    else alert(data.error || "صار خطأ بالحذف");
  }

  async function openTransfer(batch) {
    setTransferBatch(batch);
    setTransferStudentId("");
    setTransferTargetId("");
    setTransferError("");
    const res = await fetch(`/api/admin/batches/${batch.id}/students`);
    const data = await res.json();
    setTransferStudents(res.ok ? data.students || [] : []);
  }

  function closeTransfer() {
    setTransferBatch(null);
    setTransferStudents([]);
  }

  async function handleTransfer(e) {
    e.preventDefault();
    if (!transferStudentId || !transferTargetId) return;
    setTransferSaving(true);
    setTransferError("");

    const student = transferStudents.find((s) => s.user_id === transferStudentId);
    const res = await fetch("/api/admin/batches/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: transferStudentId, to_batch_id: transferTargetId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setTransferError(data.error || "صار خطأ بالنقل");
      setTransferSaving(false);
      return;
    }

    setTransferSaving(false);
    alert(`تم نقل ${student?.username || "الطالب"} بنجاح`);
    closeTransfer();
    fetchBatches();
  }

  const otherBatchesInCourse = transferBatch
    ? batches.filter((b) => b.course_id === transferBatch.course_id && b.id !== transferBatch.id && !b.is_archived)
    : [];

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <header style={s.header}>
        <div>
          <p style={s.headerSub}>لوحة التحكم</p>
          <h1 style={s.headerTitle}>إدارة الدفعات</h1>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link href="/admin/lectures" style={s.backBtn}>← رجوع للمحاضرات</Link>
          <button onClick={openAddForm} style={s.addBtn}>+ إضافة دفعة</button>
        </div>
      </header>

      <div style={s.filterBar}>
        <label style={s.label}>فلترة حسب الدورة</label>
        <select style={{ ...s.input, maxWidth: "320px" }} value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
          <option value="">كل الدورات</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.title}</option>
          ))}
        </select>
      </div>

      {error && <p style={{ ...s.errorText, margin: "0 3rem" }}>{error}</p>}

      {/* -------------------- فورم إضافة/تعديل دفعة -------------------- */}
      {showForm && (
        <div style={s.overlay} onClick={closeForm}>
          <form style={s.formCard} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <h2 style={s.formTitle}>{editingId ? "تعديل دفعة" : "إضافة دفعة جديدة"}</h2>

            <label style={s.label}>الدورة</label>
            <select
              style={s.input}
              value={form.course_id}
              onChange={(e) => setForm({ ...form, course_id: e.target.value })}
              disabled={!!editingId}
              required
            >
              <option value="">اختاري الدورة</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.title}</option>
              ))}
            </select>
            {editingId && <p style={s.hint}>ما فيك تغيّري دورة الدفعة بعد إنشائها.</p>}

            <label style={s.label}>اسم الدفعة</label>
            <input
              style={s.input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثلاً: دفعة يناير 2026 — مسائي"
              required
            />

            <label style={s.label}>المدرب (اختياري)</label>
            <select
              style={s.input}
              value={form.instructor_id}
              onChange={(e) => setForm({ ...form, instructor_id: e.target.value })}
            >
              <option value="">بدون تحديد</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.username}</option>
              ))}
            </select>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>تاريخ البداية</label>
                <input
                  type="date"
                  style={s.input}
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>تاريخ النهاية</label>
                <input
                  type="date"
                  style={s.input}
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>

            <label style={s.label}>عدد المقاعد (اختياري)</label>
            <input
              type="number"
              min="1"
              style={s.input}
              value={form.seats_total}
              onChange={(e) => setForm({ ...form, seats_total: e.target.value })}
              placeholder="اتركيه فاضي = بدون حد أقصى"
            />

            {error && <p style={s.errorText}>{error}</p>}

            <div style={s.formActions}>
              <button type="button" onClick={closeForm} style={s.cancelBtn}>إلغاء</button>
              <button type="submit" disabled={saving} style={s.saveBtn}>
                {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة الدفعة"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------- فورم نقل طالب -------------------- */}
      {transferBatch && (
        <div style={s.overlay} onClick={closeTransfer}>
          <form style={s.formCard} onClick={(e) => e.stopPropagation()} onSubmit={handleTransfer}>
            <h2 style={s.formTitle}>نقل طالب من "{transferBatch.name}"</h2>

            <label style={s.label}>الطالب</label>
            <select style={s.input} value={transferStudentId} onChange={(e) => setTransferStudentId(e.target.value)} required>
              <option value="">اختاري الطالب</option>
              {transferStudents.map((st) => (
                <option key={st.user_id} value={st.user_id}>{st.username} — {st.email}</option>
              ))}
            </select>
            {transferStudents.length === 0 && <p style={s.hint}>ما في طلاب مسجلين بهاي الدفعة حاليًا.</p>}

            <label style={s.label}>الدفعة الجديدة</label>
            <select style={s.input} value={transferTargetId} onChange={(e) => setTransferTargetId(e.target.value)} required>
              <option value="">اختاري الدفعة</option>
              {otherBatchesInCourse.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.seats_total != null ? `(${b.seats_remaining} مقعد متاح)` : ""}
                </option>
              ))}
            </select>
            {otherBatchesInCourse.length === 0 && <p style={s.hint}>ما في دفعات ثانية متاحة لنفس الدورة.</p>}

            <p style={s.hint}>تقدم الطالب محفوظ بالسجل ومش رح يتصفّر — بس رح تصير الدفعة الجديدة هي المرجع من هلأ وطالع.</p>

            {transferError && <p style={s.errorText}>{transferError}</p>}

            <div style={s.formActions}>
              <button type="button" onClick={closeTransfer} style={s.cancelBtn}>إلغاء</button>
              <button type="submit" disabled={transferSaving || !transferStudentId || !transferTargetId} style={s.saveBtn}>
                {transferSaving ? "جاري النقل..." : "نقل الطالب"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------- جدول الدفعات -------------------- */}
      <div style={s.tableWrap}>
        {loading ? (
          <p style={s.loading}>جاري التحميل...</p>
        ) : batches.length === 0 ? (
          <p style={s.loading}>لا يوجد دفعات بعد.</p>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {["الدفعة", "الدورة", "المدرب", "المقاعد", "الحالة", "الفترة", "إجراءات"].map((h, i) => (
                  <th key={i} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => {
                const instructor = instructors.find((i) => i.id === batch.instructor_id);
                return (
                  <tr key={batch.id} style={s.tr}>
                    <td style={s.td}>
                      <span style={s.username}>{batch.name}</span>
                      {batch.is_default && <span style={s.badgeDefault}>افتراضية</span>}
                      {batch.is_archived && <span style={s.badgeArchived}>مؤرشفة</span>}
                    </td>
                    <td style={s.td}><span style={s.mono}>{courseLabel(batch.course_id)}</span></td>
                    <td style={s.td}><span style={s.mono}>{instructor?.username || "—"}</span></td>
                    <td style={s.td}>
                      <span style={s.mono}>
                        {batch.seats_taken}{batch.seats_total != null ? ` / ${batch.seats_total}` : ""}
                        {batch.is_full && <span style={s.badgeFull}> ممتلئة</span>}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={batch.registration_status === "open" ? s.badgeOpen : s.badgeClosed}>
                        {batch.registration_status === "open" ? "التسجيل مفتوح" : "التسجيل مغلق"}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={s.mono}>
                        {batch.start_date || "—"} → {batch.end_date || "—"}
                      </span>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", maxWidth: "260px" }}>
                        <button onClick={() => openEditForm(batch)} style={s.btnEdit}>تعديل</button>
                        <button onClick={() => openTransfer(batch)} style={s.btnEdit}>نقل طالب</button>
                        <button onClick={() => runAction(batch.id, "duplicate")} style={s.btnEdit}>نسخ</button>
                        {!batch.is_archived && (
                          <button
                            onClick={() => runAction(batch.id, batch.registration_status === "open" ? "close_registration" : "open_registration")}
                            style={s.btnEdit}
                          >
                            {batch.registration_status === "open" ? "إغلاق التسجيل" : "فتح التسجيل"}
                          </button>
                        )}
                        {!batch.is_default && (
                          <button
                            onClick={() => runAction(batch.id, batch.is_archived ? "unarchive" : "archive")}
                            style={s.btnEdit}
                          >
                            {batch.is_archived ? "فك الأرشفة" : "أرشفة"}
                          </button>
                        )}
                        {!batch.is_default && (
                          <button onClick={() => handleDelete(batch)} style={s.btnDanger}>حذف</button>
                        )}
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

const gold = "#D4AF37";
const ink = "#0B0E11";
const s = {
  page: { backgroundColor: ink, color: "#EAECEF", direction: "rtl", fontFamily: "'Inter', sans-serif", minHeight: "100vh", padding: "0 0 4rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2rem 3rem", borderBottom: "1px solid #181A20" },
  headerSub: { fontFamily: "'JetBrains Mono', monospace", color: gold, fontSize: "0.75rem", letterSpacing: "2px", marginBottom: "0.25rem" },
  headerTitle: { fontSize: "1.4rem", fontWeight: 800 },
  backBtn: { background: "none", border: "1px solid #222", color: "#999", padding: "0.6rem 1.2rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", textDecoration: "none", display: "flex", alignItems: "center" },
  addBtn: { backgroundColor: gold, color: "#000", border: "none", padding: "0.6rem 1.2rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 700 },
  filterBar: { display: "flex", flexDirection: "column", gap: "0.35rem", margin: "1.5rem 3rem 0" },
  tableWrap: { margin: "1.5rem 3rem 2rem", border: "1px solid #111", borderRadius: "4px", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { backgroundColor: "#181A20", padding: "1rem 1.25rem", textAlign: "right", fontSize: "0.78rem", color: "#444", fontWeight: 500, borderBottom: "1px solid #111", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid #0d0d0d" },
  td: { padding: "1rem 1.25rem", fontSize: "0.88rem", verticalAlign: "middle" },
  username: { color: "#EAECEF", fontWeight: 500 },
  mono: { fontFamily: "'JetBrains Mono', monospace", color: "#555", fontSize: "0.82rem" },
  btnEdit: { backgroundColor: "#1a2a3a", color: "#5b9bd5", border: "1px solid #2a3a5a", padding: "0.4rem 0.8rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.78rem" },
  btnDanger: { backgroundColor: "#2a1a1a", color: "#ef5350", border: "1px solid #4a2a2a", padding: "0.4rem 0.8rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.78rem" },
  loading: { textAlign: "center", padding: "3rem", color: "#444" },
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" },
  formCard: { backgroundColor: "#0d0d0d", border: `1px solid ${gold}44`, borderRadius: "8px", padding: "2rem", width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "90vh", overflowY: "auto" },
  formTitle: { fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.75rem" },
  label: { fontSize: "0.82rem", color: "#999", marginTop: "0.75rem" },
  input: { backgroundColor: "#181A20", border: "1px solid #222", color: "#EAECEF", padding: "0.7rem 0.9rem", borderRadius: "4px", fontSize: "0.9rem", outline: "none", fontFamily: "inherit" },
  hint: { fontSize: "0.75rem", color: "#555", marginTop: "0.15rem" },
  errorText: { color: "#ef5350", fontSize: "0.85rem", marginTop: "0.5rem" },
  formActions: { display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" },
  cancelBtn: { background: "none", border: "1px solid #222", color: "#999", padding: "0.6rem 1.4rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" },
  saveBtn: { backgroundColor: gold, color: "#000", border: "none", padding: "0.6rem 1.4rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 700 },
  badgeDefault: { marginRight: "0.5rem", fontSize: "0.68rem", backgroundColor: "#1a2a3a", color: "#5b9bd5", padding: "0.15rem 0.5rem", borderRadius: "3px" },
  badgeArchived: { marginRight: "0.5rem", fontSize: "0.68rem", backgroundColor: "#2a1a1a", color: "#999", padding: "0.15rem 0.5rem", borderRadius: "3px" },
  badgeFull: { color: "#ef5350", fontSize: "0.75rem" },
  badgeOpen: { fontSize: "0.75rem", color: "#02C076", backgroundColor: "#0a2a1e", padding: "0.25rem 0.6rem", borderRadius: "3px" },
  badgeClosed: { fontSize: "0.75rem", color: "#999", backgroundColor: "#181A20", padding: "0.25rem 0.6rem", borderRadius: "3px" },
};
